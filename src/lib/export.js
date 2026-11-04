import { CURRENCIES, DAYS, eventoText, feeOf, fmtFull, isCombo, net, payout, selections, shortcutOf, totals } from './logic'
import { marketLabel } from './sports'

// Tipo de jugada para exportar (en combinadas: el de cada selección)
const tipoText = (b) => (isCombo(b) ? selections(b).map((x) => marketLabel(x.tipo) || '—').join(' / ') : marketLabel(b.tipo))

const download = (name, text, type) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export const exportJSON = (state) =>
  download('apuestas-respaldo.json', JSON.stringify(state, null, 2), 'application/json')

export const exportCSV = (week) => {
  const rows = [['Cliente', 'Dia', 'Fecha', 'Moneda', 'Monto', 'Evento', 'Tipo de jugada', 'Linea', 'Estado', 'Resultado Neto', 'Retorno Total', 'Modificado por']]
  week.clients.forEach((c) =>
    (week.bets[c] || []).forEach((b) =>
      rows.push([c, b.dia, b.fecha, b.moneda || 'ARS', b.monto, eventoText(b), tipoText(b), b.linea, b.estado, net(b), payout(b), b.modBy || ''])))
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
  download(`Semana_${week.weekStart}.csv`, '﻿' + csv, 'text/csv')
}

// ---- Excel (.xlsx): una hoja por cliente, mismo orden de columnas que la planilla original ----
// A DIA | B FECHA | C CUOTA (en miles, como la planilla) | D EVENTO | E LINEA | F ESTADO | G RESULTADO | H RETORNO | I MONEDA
// K/L: desglose del día (Total apostado / Perdido / Ganado / Balance final por moneda)
// Fila 1: cliente + totales ARS (E1 apostado, F1 comisión, G1 neto del apostador, H1 retorno) + USD + diferencia y balance (banca)
// Cuota: ARS en miles (como la planilla); USD en valor directo
const sheetRows = (client, bets, pct) => {
  const cur = (c) => bets.filter((b) => (b.moneda || 'ARS') === c)
  const T = Object.fromEntries(CURRENCIES.map((c) => [c, totals(cur(c))]))
  const fee = Object.fromEntries(CURRENCIES.map((c) => [c, feeOf(T[c].played, pct)]))
  const rows = []
  // Perdido = lo que perdieron los clientes, Ganado = lo que ganaron (ambos desde la banca). Balance final = diferencia − comisión (como H2 de la planilla)
  rows.push([
    client, null, null, null, T.ARS.played, fee.ARS, T.ARS.net, T.ARS.returned, 'TOTAL ARS', null,
    'TOTAL USD', T.USD.played, T.USD.net, T.USD.returned,
    'PERDIDO ARS', -T.ARS.lost, 'GANADO ARS', -T.ARS.won, 'BALANCE ARS', T.ARS.diff - fee.ARS,
    'PERDIDO USD', -T.USD.lost, 'GANADO USD', -T.USD.won, 'BALANCE USD', T.USD.diff - fee.USD,
  ])
  rows.push([null, 'FECHA', 'CUOTA', 'EVENTO', 'LINEA', 'ESTADO', 'RESULTADO', 'RETORNO', 'MONEDA', 'TIPO'])
  DAYS.forEach((d) => {
    const list = bets.filter((b) => b.dia === d).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const subs = []
    CURRENCIES.forEach((c) => {
      const t = totals(list.filter((b) => (b.moneda || 'ARS') === c))
      if (t.count) subs.push([`Total apostado ${c}`, t.played], [`Perdido ${c}`, -t.lost], [`Ganado ${c}`, -t.won],[`Balance final ${c}`, t.diff - feeOf(t.played, pct)])
    })
    const len = Math.max(list.length, subs.length, 1)
    for (let i = 0; i < len; i++) {
      const b = list[i]
      const row = [i === 0 ? d.toUpperCase() : null]
      if (b) row.push(fmtFull(b.fecha), shortcutOf(b), eventoText(b), b.lineaRaw || b.linea, b.estado, net(b), payout(b), b.moneda || 'ARS')
      else row.push(null, null, null, null, null, null, null, null)
      row.push(b ? tipoText(b) || null : null, subs[i]?.[0] ?? null, subs[i]?.[1] ?? null)
      rows.push(row)
    }
    rows.push([]) // fila en blanco entre días
  })
  return rows
}

export const exportXLSX = async (week) => {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const used = new Set()
  week.clients.forEach((c) => {
    let name = (c.replace(/[\\/?*[\]:]/g, '').trim() || 'CLIENTE').slice(0, 31)
    while (used.has(name.toLowerCase())) name = name.slice(0, 28) + '_' + (used.size % 100)
    used.add(name.toLowerCase())
    const ws = XLSX.utils.aoa_to_sheet(sheetRows(c, week.bets[c] || [], (week.fees || {})[c]))
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]
    ws['!cols'] = [12, 11, 10, 34, 14, 12, 14, 14, 9, 16, 22, 14, 14, 14, 16, 14, 16, 14, 16, 14, 16, 14].map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  })
  XLSX.writeFile(wb, `Semana_${week.weekStart}.xlsx`)
}
