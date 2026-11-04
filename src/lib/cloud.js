// Conexión con Supabase (plan gratuito). Solo se activa si .env tiene VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
// La planilla se guarda en una "sala" identificada por el hash del código de acceso: el código nunca viaja ni se guarda en claro.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const SB_URL = env.VITE_SUPABASE_URL
const SB_KEY = env.VITE_SUPABASE_ANON_KEY

export const cloudConfigured = Boolean(SB_URL && SB_KEY)

export async function roomKey(code) {
  const data = new TextEncoder().encode(`cristian-deportivas:${String(code).trim()}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Devuelve { get, set, subscribe, notify } (ver sync.js). Las lecturas y escrituras van por funciones SQL (supabase/schema.sql):
// sin el código de sala no se puede leer ni escribir nada.
export async function makeBackend(room) {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  let channel = null

  return {
    async get() {
      const { data, error } = await sb.rpc('room_get', { p_code: room })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row ? { state: row.out_state, version: Number(row.out_version) } : null
    },
    async set(state, expected) {
      const { data, error } = await sb.rpc('room_set', { p_code: room, p_state: state, p_expected: expected })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return { ok: row.out_ok, state: row.out_state, version: Number(row.out_version) }
    },
    // Aviso instantáneo ("hay cambios") para que los demás equipos se actualicen al momento; además se consulta cada pocos segundos.
    subscribe(cb) {
      channel = sb.channel(`room:${room.slice(0, 32)}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'changed' }, () => cb())
        .subscribe()
      return () => { sb.removeChannel(channel); channel = null }
    },
    notify() {
      channel?.send({ type: 'broadcast', event: 'changed', payload: {} })
    },
  }
}
