import { useEffect, useState } from 'react'
import { CLIENTS, addDays, betTeams, fmtFull, localISO, mondayOf, uid } from './logic'

const KEY = 'apuestas-v3'
const OLD_KEY = 'apuestas-v2'
export const MAX_HISTORY = 3

const fresh = () => ({
  users: [
    { id: 'cris', name: 'Cris', perm: 'edit' },
    { id: 'vale', name: 'Vale', perm: 'edit' },
  ],
  clients: [...CLIENTS],
  bets: Object.fromEntries(CLIENTS.map((c) => [c, []])),
  fees: {}, // % de comisión por cliente (0 / ausente = desactivada)
  weekStart: mondayOf(localISO(new Date())),
  history: [], // últimas 3 semanas cerradas (editables)
  notice: null, // aviso de borrado automático
  teams: {}, // memoria de equipos: nombre -> veces usado (no se borra con las semanas viejas)
})

const normBets = (bets, clients) => {
  const out = {}
  clients.forEach((c) => { out[c] = ((bets || {})[c] || []).map((b) => ({ moneda: 'ARS', ...b })) })
  return out
}

// Completa lo que falte (respaldos o datos de versiones anteriores)
export const normalize = (s) => {
  const base = fresh()
  const clients = Array.isArray(s.clients) ? s.clients : base.clients
  return {
    users: s.users?.length ? s.users : base.users,
    clients,
    bets: normBets(s.bets, clients),
    fees: s.fees || {},
    weekStart: s.weekStart || base.weekStart,
    history: (Array.isArray(s.history) ? s.history : []).slice(0, MAX_HISTORY).map((w) => ({
      ...w,
      fees: w.fees || {},
      bets: normBets(w.bets, w.clients || []),
    })),
    notice: s.notice || null,
    teams: s.teams || {},
  }
}

// Memoria de equipos: al cargar suma 1; al editar solo agrega los que todavía no se conocían
const remember = (teams, names, bump) => {
  const next = { ...(teams || {}) }
  names.forEach((n) => { next[n] = bump ? (next[n] || 0) + 1 : Math.max(next[n] || 0, 1) })
  return next
}

const load = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY))
    return s && s.clients ? normalize(s) : fresh()
  } catch {
    return fresh()
  }
}

export function useStore(externalUser) {
  const [state, setState] = useState(load)
  const [viewRaw, setView] = useState('current')
  const [userId, setUserIdState] = useState(() => {
    try { return sessionStorage.getItem('apuestas-user') } catch { return null }
  })
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
  }, [state])

  const localUser = state.users.find((u) => u.id === userId) || null
  const user = externalUser !== undefined ? externalUser : localUser // con la nube, manda la persona que inició sesión
  const userName = user?.name
  const setUserId = (id) => {
    setUserIdState(id)
    try { sessionStorage.setItem('apuestas-user', id) } catch {}
  }

  // Semana que se está viendo: la actual o una cerrada (también editable)
  const past = viewRaw === 'current' ? null : state.history.find((w) => w.id === viewRaw)
  const view = past ? viewRaw : 'current'
  const week = past
    ? { ...past, closed: true }
    : { id: 'current', closed: false, weekStart: state.weekStart, clients: state.clients, bets: state.bets, fees: state.fees }

  const stamp = (patch) => ({ ...patch, modBy: userName, modAt: Date.now() })
  // Aplica un cambio parcial {bets?, fees?} a una semana (la actual o una cerrada)
  const updAt = (target, fn) =>
    setState((s) =>
      target === 'current'
        ? { ...s, ...fn(s) }
        : { ...s, history: s.history.map((w) => (w.id === target ? { ...w, ...fn(w) } : w)) })
  const updWeek = (fn) => updAt(view, fn)
  const upd = (client, fn) => updWeek((w) => ({ bets: { ...w.bets, [client]: fn(w.bets[client] || []) } }))

  return {
    state, week, view, setView, user, setUserId,
    replaceAll: (s) => { setState(normalize(s)); setView('current') },
    applyRemote: (s) => setState(normalize(s)), // cambios que llegan de la nube
    setWeekStart: (iso) => setState((s) => ({ ...s, weekStart: mondayOf(iso) })),
    dismissNotice: () => setState((s) => ({ ...s, notice: null })),

    add: (c, bet) => {
      upd(c, (l) => [...l, { ...bet, ...stamp({}), createdBy: userName }])
      setState((s) => ({ ...s, teams: remember(s.teams, betTeams(bet), true) })) // suma una vez más a cada equipo de la jugada
    },
    edit: (c, id, patch) => {
      upd(c, (l) => l.map((b) => (b.id === id ? { ...b, ...stamp(patch) } : b)))
      if (patch.evento || patch.selecciones) setState((s) => ({ ...s, teams: remember(s.teams, betTeams(patch.selecciones ? { modo: 'combinada', selecciones: patch.selecciones } : patch), false) }))
    },
    // Edita una jugada de cualquier semana (lo usa la búsqueda por equipo)
    editAt: (target, c, id, patch) =>
      updAt(target, (w) => ({ bets: { ...w.bets, [c]: (w.bets[c] || []).map((b) => (b.id === id ? { ...b, ...stamp(patch) } : b)) } })),
    remove: (c, id) => upd(c, (l) => l.filter((b) => b.id !== id)),
    setFee: (c, pct) => updWeek((w) => ({ fees: { ...w.fees, [c]: pct } })),

    // Clientes (solo semana actual)
    addClient: (name) =>
      setState((s) =>
        s.clients.includes(name) ? s : { ...s, clients: [...s.clients, name], bets: { ...s.bets, [name]: [] } }),
    renameClient: (from, to) =>
      setState((s) => {
        if (!to || from === to || s.clients.includes(to)) return s
        const { [from]: list, ...rest } = s.bets
        const { [from]: fee, ...fees } = s.fees
        return {
          ...s,
          clients: s.clients.map((c) => (c === from ? to : c)),
          bets: { ...rest, [to]: list || [] },
          fees: fee ? { ...fees, [to]: fee } : fees,
        }
      }),
    deleteClient: (name) =>
      setState((s) => {
        if (s.clients.length <= 1) return s
        const { [name]: _b, ...bets } = s.bets
        const { [name]: _f, ...fees } = s.fees
        return { ...s, clients: s.clients.filter((c) => c !== name), bets, fees }
      }),

    addUser: (name, perm) =>
      setState((s) =>
        s.users.some((u) => u.name.toLowerCase() === name.toLowerCase())
          ? s
          : { ...s, users: [...s.users, { id: uid(), name, perm }] }),

    // Archiva la semana actual; si ya hay 3 cerradas, la más antigua se borra sola y queda un aviso
    newWeek: () => {
      setState((s) => {
        const snap = { id: uid(), weekStart: s.weekStart, closedAt: Date.now(), closedBy: userName, clients: s.clients, bets: s.bets, fees: s.fees }
        const all = [snap, ...s.history]
        const dropped = all.slice(MAX_HISTORY)
        return {
          ...s,
          history: all.slice(0, MAX_HISTORY),
          bets: Object.fromEntries(s.clients.map((c) => [c, []])),
          weekStart: addDays(s.weekStart, 7),
          notice: dropped.length
            ? { at: Date.now(), text: `Se eliminó automáticamente la semana del ${fmtFull(dropped[0].weekStart)}: solo se conservan las últimas ${MAX_HISTORY} semanas.` }
            : s.notice,
        }
      })
      setView('current')
    },
  }
}
