// Nombre de La Banca (la casa) en las etiquetas de la planilla
export const BANCA = 'Cristian'
export const CLIENTS = ['PIPO','LUJAN JAURE','ALE','PERRO','GIMNASIA','ALFREDO','BUCHI','TRIO','MARTIN','NORBERTO','DESCARGA']
export const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
export const STATES = ['PENDIENTE','GANADA','PERDIDA']
export const CURRENCIES = ['ARS','USD']
export const CUR_LABEL = { ARS: 'Pesos Argentinos', USD: 'Dólares' }
const PREFIX = { ARS: '$', USD: 'US$' }

// ARS usa el atajo (100 -> 100.000). USD va directo (100 -> 100 USD).
export const toAmount = (shortcut, cur = 'ARS') => {
  const n = Number(String(shortcut).replace(',', '.')) || 0
  return cur === 'USD' ? n : n * 1000
}
export const shortcutOf = (b) => ((b.moneda || 'ARS') === 'USD' ? b.monto : b.monto / 1000)

export const money = (n, cur = 'ARS') => {
  const v = Math.round(n || 0)
  return `${v < 0 ? '-' : ''}${PREFIX[cur] || '$'} ${Math.abs(v).toLocaleString('es-AR')}`
}

// Combinadas: "1.3 x 1.4 x 1.5" -> 2.73. Devuelve { value, parts } o null si no es válido.
export const parseOdds = (text) => {
  const parts = String(text ?? '').split(/[x×*]/i).map((p) => parseFloat(p.trim().replace(',', '.')))
  if (!parts.length || parts.some((p) => !(p > 0))) return null
  const value = Math.round(parts.reduce((a, p) => a * p, 1) * 1e6) / 1e6
  return value > 1 ? { value, parts: parts.length } : null
}
export const oddsText = (b) => b.lineaRaw || String(b.linea)

// Resultado del apostador (GANADA = ganancia, PERDIDA = -monto)
export const net = (b) =>
  b.estado === 'GANADA' ? b.monto * b.linea - b.monto : b.estado === 'PERDIDA' ? -b.monto : 0
// Resultado de LA BANCA: lo que pierde el apostador lo gana la casa, y viceversa
export const houseNet = (b) => -net(b)
export const payout = (b) => (b.estado === 'PENDIENTE' ? 0 : Math.max(0, b.monto + net(b)))

// played = Total apostado · diff = Diferencia (resultado de la banca) · returned = pagado a clientes
export const totals = (bets) => {
  const lost = -bets.filter((b) => b.estado === 'PERDIDA').reduce((s, b) => s + b.monto, 0)
  const won = bets.filter((b) => b.estado === 'GANADA').reduce((s, b) => s + net(b), 0)
  return {
    played: bets.reduce((s, b) => s + b.monto, 0),
    lost,
    won,
    net: won + lost,
    diff: -(won + lost),
    returned: bets.reduce((s, b) => s + payout(b), 0),
    count: bets.length,
  }
}
export const totalsByCur = (bets) =>
  Object.fromEntries(CURRENCIES.map((c) => [c, totals(bets.filter((b) => (b.moneda || 'ARS') === c))]))

// Comisión del cliente: % sobre lo apostado. Balance final = Diferencia − comisión (igual que H2 de la planilla)
export const feeOf = (played, pct) => (played * (Number(pct) || 0)) / 100
export const balanceOf = (t, pct) => t.diff - feeOf(t.played, pct)

// Resumen de una semana completa (todos los clientes, cada uno con su comisión)
export const weekSummary = (week) =>
  Object.fromEntries(
    CURRENCIES.map((cur) => {
      const acc = { played: 0, diff: 0, balance: 0, count: 0 }
      week.clients.forEach((c) => {
        const t = totals((week.bets[c] || []).filter((b) => (b.moneda || 'ARS') === cur))
        acc.played += t.played
        acc.diff += t.diff
        acc.balance += balanceOf(t, (week.fees || {})[c])
        acc.count += t.count
      })
      return [cur, acc]
    })
  )

// ---- Simple / Combinada ----
// Simple: { evento, tipo, linea }. Combinada: { modo: 'combinada', selecciones: [{ evento, tipo, linea }], evento = primer equipo, linea = producto }
export const isCombo = (b) => b.modo === 'combinada' && Array.isArray(b.selecciones) && b.selecciones.length > 0
export const selections = (b) => (isCombo(b) ? b.selecciones : [{ evento: b.evento, tipo: b.tipo || '', linea: b.linea }])
export const betTeams = (b) => selections(b).map((s) => s.evento).filter(Boolean)
export const eventoText = (b) => (isCombo(b) ? `COMBINADA: ${betTeams(b).join(' + ')}` : b.evento)
export const comboLine = (lines) => Math.round(lines.reduce((a, n) => a * n, 1) * 1e6) / 1e6

// Búsqueda de equipos: sin acentos ni mayúsculas, por fragmento ("madrid" encuentra "REAL MADRID")
export const normText = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const teamMatches = (query, name) => {
  const q = normText(query)
  return q.length > 0 && normText(name).includes(q)
}

// Autocompletado de eventos: el nombre más frecuente que empiece con lo escrito (cuenta también cada equipo de las combinadas)
export const buildFreq = (weeks) => {
  const m = new Map()
  weeks.forEach((w) => Object.values(w.bets || {}).forEach((l) => l.forEach((b) => betTeams(b).forEach((t) => m.set(t, (m.get(t) || 0) + 1)))))
  return m
}
export const suggestFrom = (freq, typed) => {
  const p = String(typed || '').trim().toUpperCase()
  if (!p) return null
  let best = null
  freq.forEach((n, name) => {
    if (name.startsWith(p) && name !== p && (!best || n > best[1] || (n === best[1] && name.length < best[0].length))) best = [name, n]
  })
  return best ? best[0] : null
}

export const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dayFromDate = (iso) => DAYS[(new Date(iso + 'T12:00:00').getDay() + 6) % 7]
export const mondayOf = (iso) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return localISO(d)
}
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localISO(d)
}
export const fmtDate = (iso) => iso.split('-').reverse().slice(0, 2).join('/')
export const fmtFull = (iso) => iso.split('-').reverse().join('/')
export const uid = () => Math.random().toString(36).slice(2, 10)
