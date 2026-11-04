import { useCallback, useEffect, useState } from 'react'
import { cloudConfigured, rpc } from './cloud'

const TOKEN_KEY = 'apuestas-sesion'
const PROFILE_KEY = 'apuestas-perfil'

const get = (store, k) => { try { return store.getItem(k) } catch { return null } }
const put = (store, k, v) => { try { v == null ? store.removeItem(k) : store.setItem(k, v) } catch {} }

const toUser = (r) => ({ username: r.out_username, displayName: r.out_display, role: r.out_role, isAdmin: r.out_admin, wantsEdit: r.out_wants, mustChange: !!r.out_must_change })

// Sesión del usuario: "Recordarme" guarda la sesión 30 días en este equipo; si no, dura hasta cerrar la pestaña.
export function useAuth() {
  const enabled = cloudConfigured
  const [token, setToken] = useState(() => (enabled ? get(localStorage, TOKEN_KEY) || get(sessionStorage, TOKEN_KEY) : null))
  const [user, setUser] = useState(() => {
    try { return enabled && token ? JSON.parse(get(localStorage, PROFILE_KEY) || get(sessionStorage, PROFILE_KEY) || 'null') : null } catch { return null }
  })
  const [loading, setLoading] = useState(enabled && !!token)
  const [tempPass, setTempPass] = useState('') // clave temporal recién usada (solo en memoria) para poder cambiarla

  const clear = useCallback(() => {
    for (const s of [localStorage, sessionStorage]) { put(s, TOKEN_KEY, null); put(s, PROFILE_KEY, null) }
    setToken(null); setUser(null)
  }, [])

  const keep = (profile, tk) => {
    const store = get(localStorage, TOKEN_KEY) ? localStorage : sessionStorage
    put(store, PROFILE_KEY, JSON.stringify(profile))
    if (tk) put(store, TOKEN_KEY, tk)
  }

  // Confirma la sesión y los permisos con el servidor (así una aprobación se nota sin volver a entrar)
  useEffect(() => {
    if (!enabled || !token) { setLoading(false); return }
    let dead = false
    const check = async () => {
      try {
        const row = (await rpc('app_me', { p_token: token }))[0]
        if (dead) return
        if (!row) { clear(); return }
        const profile = toUser(row)
        setUser(profile); keep(profile)
      } catch { /* sin conexión: se sigue con el perfil guardado */ }
      finally { if (!dead) setLoading(false) }
    }
    check()
    const id = setInterval(check, 20000)
    return () => { dead = true; clearInterval(id) }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (username, password, remember) => {
    try {
      const r = (await rpc('app_login', { p_username: username, p_password: password, p_remember: !!remember }))[0]
      if (!r?.out_ok) return { ok: false, error: r?.out_error || 'No se pudo iniciar sesión.' }
      const profile = toUser(r)
      const store = remember ? localStorage : sessionStorage
      for (const s of [localStorage, sessionStorage]) { put(s, TOKEN_KEY, null); put(s, PROFILE_KEY, null) }
      put(store, TOKEN_KEY, r.out_token); put(store, PROFILE_KEY, JSON.stringify(profile))
      setToken(r.out_token); setUser(profile); setTempPass(profile.mustChange ? password : '')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.' }
    }
  }

  const register = async ({ username, password, display, wantsEdit, remember }) => {
    try {
      const r = (await rpc('app_register', { p_username: username, p_password: password, p_display: display, p_wants_edit: !!wantsEdit }))[0]
      if (!r?.out_ok) return { ok: false, error: r?.out_message || 'No se pudo registrar.' }
      return login(username, password, remember)
    } catch {
      return { ok: false, error: 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.' }
    }
  }

  // Cambiar la propia contraseña (también reemplaza una clave temporal)
  const changePassword = async (oldPassword, newPassword) => {
    try {
      const r = (await rpc('app_change_password', { p_token: token, p_old: oldPassword, p_new: newPassword }))[0]
      if (!r?.out_ok) return { ok: false, error: r?.out_message || 'No se pudo cambiar la contraseña.' }
      const profile = { ...user, mustChange: false }
      setUser(profile); keep(profile); setTempPass('')
      return { ok: true }
    } catch {
      return { ok: false, error: 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.' }
    }
  }

  const logout = async () => {
    try { if (token) await rpc('app_logout', { p_token: token }) } catch {}
    clear()
    // la copia local de la planilla se borra al salir (otra persona podría usar este equipo)
    try { localStorage.removeItem('apuestas-v3') } catch {}
    window.location.reload()
  }

  return {
    enabled, token, user, loading,
    login, register, logout, changePassword, tempPass,
    expire: clear, // la sesión venció o fue revocada
    storeUser: user ? { id: user.username, name: user.displayName, perm: user.role === 'edit' ? 'edit' : 'read' } : null,
  }
}
