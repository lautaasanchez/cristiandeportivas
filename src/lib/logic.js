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
// Diferencia = total apostado − lo que ganó el cliente. Positiva: a favor de la banca (Cristian). Negativa: a favor del cliente.
export const diffLabel = (d) => (d > 0 ? `Diferencia a favor de ${BANCA}` : d < 0 ? 'Diferencia a favor del cliente' : 'Diferencia')
export const feeOf = (played, pct) => (played * (Number(pct) || 0)) / 100
export const balanceOf = (t, pct) => t.diff - feeOf(t.played, pct)

// Resumen de una semana completa (todos los clientes, cada uno con su comisión)
export const weekSummary = (week) =>
  Object.fromEntries(
    CURRENCIES.map((cur) => {
      const acc = { played: 0, won: 0, returned: 0, diff: 0, balance: 0, count: 0 }
      week.clients.forEach((c) => {
        const t = totals((week.bets[c] || []).filter((b) => (b.moneda || 'ARS') === cur))
        acc.played += t.played
        acc.won += t.won
        acc.returned += t.returned
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

// ---- Memoria de equipos y sugerencias ("¿Te referís a …?") ----
// nombre -> veces usado. Junta la memoria guardada (no se borra cuando se eliminan semanas viejas) con lo que hay en las jugadas.
export const buildFreq = (weeks, memory = {}) => {
  const m = new Map(Object.entries(memory || {}))
  const counts = new Map()
  weeks.forEach((w) => Object.values(w.bets || {}).forEach((l) => l.forEach((b) => betTeams(b).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)))))
  counts.forEach((n, t) => m.set(t, Math.max(m.get(t) || 0, n)))
  return m
}

const lev = (a, b) => { // distancia de edición (cuántas letras cambian entre dos palabras)
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
const toks = (t) => normText(t).split(' ').filter(Boolean)
// qué tan bien una palabra escrita coincide con una palabra del equipo (1 = empieza igual; menos = parecida con errores)
const tokenScore = (q, w) => {
  if (w.startsWith(q)) return 1
  if (q.length < 3) return 0
  const d = Math.min(lev(q, w), lev(q, w.slice(0, q.length)))
  const sim = 1 - d / q.length
  return sim >= 0.7 ? 0.9 * sim : 0
}
// { group, score } o null. group 0: el nombre empieza igual · 1: cada palabra empieza igual · 2: parecido (errores de tipeo, palabras pegadas)
const rank = (typed, name) => {
  const qn = normText(typed), nn = normText(name)
  if (!qn || nn === qn) return null
  if (nn.startsWith(qn)) return { group: 0, score: 1 }
  const best = toks(typed).map((q) => Math.max(0, ...toks(name).map((w) => tokenScore(q, w))))
  if (best.length && best.every((x) => x > 0)) return { group: best.every((x) => x === 1) ? 1 : 2, score: best.reduce((a, b) => a + b, 0) / best.length }
  const qj = qn.replace(/ /g, ''), nj = nn.replace(/ /g, '')
  if (qj.length >= 4) {
    const sim = 1 - lev(qj, nj.slice(0, qj.length)) / qj.length
    if (sim >= 0.8) return { group: 2, score: 0.8 * sim }
  }
  return null
}
// Hasta n equipos conocidos que se parecen a lo escrito, del más probable al menos probable
export const suggestMany = (freq, typed, n = 3) => {
  if (normText(typed).length < 2) return []
  const out = []
  freq.forEach((count, name) => { const r = rank(typed, name); if (r) out.push({ name, ...r, count }) })
  out.sort((a, b) => a.group - b.group || b.score - a.score || b.count - a.count || a.name.length - b.name.length)
  return out.slice(0, n).map((x) => x.name)
}
export const suggestFrom = (freq, typed) => suggestMany(freq, typed, 1)[0] || null
// Si lo escrito es un equipo ya conocido (sin importar mayúsculas ni tildes), se usa su forma guardada
export const canonicalTeam = (freq, typed) => {
  const qn = normText(typed)
  for (const name of freq.keys()) if (normText(name) === qn) return name
  return null
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
