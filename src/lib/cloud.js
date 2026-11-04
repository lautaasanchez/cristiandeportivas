// Conexión con Supabase (plan gratuito). Solo se activa si .env tiene VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
// Todo pasa por funciones SQL (supabase/schema.sql) que validan la sesión y los permisos en el servidor.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const SB_URL = env.VITE_SUPABASE_URL
const SB_KEY = env.VITE_SUPABASE_ANON_KEY

export const cloudConfigured = Boolean(SB_URL && SB_KEY)

let clientPromise = null
export function getClient() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
  }
  return clientPromise
}

// Llama a una función SQL. Los errores de permisos se convierten en { auth: true } para cerrar la sesión.
export async function rpc(name, params) {
  const sb = await getClient()
  const { data, error } = await sb.rpc(name, params)
  if (error) {
    const msg = String(error.message || '')
    const e = new Error(msg)
    if (msg.includes('unauthorized')) e.auth = true
    if (msg.includes('forbidden')) e.forbidden = true
    throw e
  }
  return Array.isArray(data) ? data : data == null ? [] : [data]
}

// Devuelve { get, set, subscribe, notify } (ver sync.js)
export async function makeBackend(token) {
  const sb = await getClient()
  let channel = null
  return {
    async get() {
      const row = (await rpc('state_get', { p_token: token }))[0]
      return row ? { state: row.out_state, version: Number(row.out_version) } : null
    },
    async set(state, expected) {
      const row = (await rpc('state_set', { p_token: token, p_state: state, p_expected: expected }))[0]
      return { ok: row.out_ok, state: row.out_state, version: Number(row.out_version) }
    },
    // Aviso instantáneo ("hay cambios", sin datos) para que los demás equipos se actualicen al momento; además se consulta cada pocos segundos.
    subscribe(cb) {
      channel = sb.channel('cristian-deportivas', { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'changed' }, () => cb())
        .subscribe()
      return () => { sb.removeChannel(channel); channel = null }
    },
    notify() {
      channel?.send({ type: 'broadcast', event: 'changed', payload: {} })
    },
  }
}
