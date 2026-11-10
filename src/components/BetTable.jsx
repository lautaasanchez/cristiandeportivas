import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  BANCA, CURRENCIES, DAYS, addDays, apostadoNeto, dayFromDate, diffLabel, fmtDate, fmtFull, houseNet, isCombo, money, parseOdds, payout, selections, shortcutOf, toAmount, totals,
} from '../lib/logic'
import { marketLabel } from '../lib/sports'
import StatusPill from './StatusPill'
import { MARKETS } from '../lib/sports'

// Verde = ganancia de la banca · carmesí = pago de la banca
const col = (n) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-muted')
const td = 'border border-line'
const HEAD = ['Fecha', 'Moneda', 'Evento', 'Tipo', 'Cuota', 'Línea', 'Estado', `Resultado ${BANCA}`, 'Pago al cliente', 'Registro', '']

// Campo que guarda al salir (blur) o con Enter. Con `suggest`, Tab autocompleta el nombre más frecuente.
function Cell({ value, onCommit, suggest, className = '', ...rest }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => String(v) !== String(value) && onCommit(v)
  const keys = (e) => {
    if (e.key === 'Enter') return e.currentTarget.blur()
    if (e.key === 'Tab' && suggest) {
      const sg = suggest(v)
      if (sg) { e.preventDefault(); setV(sg); onCommit(sg) }
    }
  }
  return <input {...rest} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={keys} className={`cell ${className}`} />
}

function Chip({ label, value, tone }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted font-semibold uppercase text-[10px]">{label}</span>
      <span className={`num font-bold ${tone}`}>{value}</span>
    </span>
  )
}

function Field({ label, children, tone = '' }) {
  return (
    <div className="rounded-lg bg-head/60 border border-line/50 px-2.5 py-1.5 min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num font-bold text-[13px] truncate ${tone}`}>{children}</div>
    </div>
  )
}

// Vista en tarjetas: se usa en split-screen y en el celular (sin scroll horizontal)
function BetCard({ b, canEdit, selected, onSelect, onEdit, onOpenEdit, onDelete, onSearchTeam, onShowCombo }) {
  const cur = b.moneda || 'ARS'
  const combo = isCombo(b)
  const legs = selections(b)
  return (
    <article data-nav={`bet:${b.id}`} onClick={onSelect} className={`bento-flat p-3 space-y-2.5 hover:-translate-y-0.5 hover:shadow-lg ${selected ? '!border-cyan ring-2 ring-cyan/60 bg-cyan/5' : ''}`}>
      <div className="flex items-center gap-1.5">
        <span className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'}`}>{cur}</span>
        <span className={`pill ${combo ? 'pill-cyan' : 'pill-indigo'}`}>{combo ? 'COMBINADA' : 'SIMPLE'}</span>
        <span className="ml-auto"><StatusPill disabled={!canEdit} value={b.estado} onChange={(estado) => onEdit(b.id, { estado })} /></span>
      </div>
      <button onClick={combo ? () => onShowCombo(b) : undefined} className={`block w-full text-left ${combo ? '' : 'cursor-default'}`}>
        <div className="font-extrabold text-base leading-tight break-words">
          {b.evento}
          {combo && <span className="text-cyan font-semibold text-xs ml-1.5">(+{legs.length - 1} {legs.length - 1 === 1 ? 'selección' : 'selecciones'})</span>}
        </div>
        <div className="text-xs text-muted mt-0.5">{fmtFull(b.fecha)} · {combo ? 'Combinada' : marketLabel(b.tipo) || 'Sin tipo de jugada'}</div>
      </button>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Cuota">{money(b.monto, cur)}</Field>
        <Field label={combo ? 'Línea combinada' : 'Línea'}>{b.linea.toFixed(2)}</Field>
        <Field label={`Resultado ${BANCA}`} tone={col(houseNet(b))}>{money(houseNet(b), cur)}</Field>
        <Field label="Pago al cliente">{money(payout(b), cur)}</Field>
      </div>
      <div className="flex items-center gap-1.5 border-t border-line/70 pt-2">
        {b.modBy ? <span className="pill pill-violet normal-case !tracking-normal !text-[10px] truncate">Mod. por {b.modBy}</span> : null}
        <span className="ml-auto" />
        <button onClick={() => (combo ? onShowCombo(b) : onSearchTeam(b.evento, b))} className="btn !px-2.5 !py-2" aria-label="Buscar equipo"><Search size={16} /></button>
        {canEdit && (
          <>
            <button onClick={() => onOpenEdit(b)} className="btn !px-2.5 !py-2" aria-label="Editar"><Pencil size={16} /></button>
            <button onClick={() => onDelete(b.id)} className="btn !px-2.5 !py-2 !text-loss" aria-label="Borrar"><Trash2 size={16} /></button>
          </>
        )}
      </div>
    </article>
  )
}

function BetCards({ bets, weekStart, pct, canEdit, sel, setSel, onEdit, onOpenEdit, onDelete, onAdd, onSearchTeam, onShowCombo }) {
  return (
    <div className="wide:hidden space-y-4">
      {DAYS.map((d, i) => {
        const date = addDays(weekStart, i)
        const list = bets.filter((b) => b.dia === d).sort((a, b) => a.fecha.localeCompare(b.fecha))
        return (
          <section key={d} className="space-y-2">
            <div className="rounded-xl bg-strong text-onstrong px-3 py-2 font-extrabold text-xs tracking-wide">
              <span className="text-amber-300">{d.toUpperCase()}</span> <span className="num text-onstrong/70 font-medium ml-1">{fmtDate(date)}</span>
              {list.length === 0 && <span className="ml-3 text-onstrong/60 font-normal">Sin jugadas</span>}
            </div>
            {list.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {list.map((b) => (
                  <BetCard key={b.id} b={b} canEdit={canEdit} selected={sel === `bet:${b.id}`} onSelect={() => setSel(`bet:${b.id}`)} onEdit={onEdit} onOpenEdit={onOpenEdit} onDelete={onDelete} onSearchTeam={onSearchTeam} onShowCombo={onShowCombo} />
                ))}
              </div>
            )}
            {canEdit && (
              <button data-nav={`add:${date}`} onClick={() => { setSel(`add:${date}`); onAdd(date) }} className={`w-full rounded-xl border border-dashed py-2.5 text-sm font-bold text-cyan hover:border-cyan flex items-center justify-center gap-1.5 ${sel === `add:${date}` ? 'border-cyan bg-cyan/10 ring-2 ring-cyan/60' : 'border-line'}`}>
                <Plus size={16} /> Agregar jugada
              </button>
            )}
            {CURRENCIES.map((c) => {
              const sub = list.filter((b) => (b.moneda || 'ARS') === c)
              if (!sub.length) return null
              const t = totals(sub)
              return (
                <div key={c} className="bento-flat px-3 py-2 text-xs flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-bold text-muted mr-auto">Subtotal {d} · {c}</span>
                  <Chip label="Apostado" value={money(apostadoNeto(t, pct), c)} tone="" />
                  <Chip label="Ganó el cliente" value={money(t.returned, c)} tone={t.returned > 0 ? 'text-loss' : 'text-muted'} />
                  <Chip label={diffLabel(apostadoNeto(t, pct) - t.returned)} value={money(apostadoNeto(t, pct) - t.returned, c)} tone={col(apostadoNeto(t, pct) - t.returned)} />
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

// Mueve la pantalla lo justo para que la fila elegida se vea (sin quedar tapada por la franja fija de arriba)
const reveal = (key) => {
  const el = [...document.querySelectorAll('[data-nav]')].find((x) => x.dataset.nav === key && x.offsetParent !== null)
  if (!el) return
  const hdr = document.querySelector('[data-sticky-header]')
  const top = hdr && getComputedStyle(hdr).position === 'sticky' ? hdr.getBoundingClientRect().bottom + 8 : 8
  const r = el.getBoundingClientRect()
  if (r.top < top) window.scrollBy({ top: r.top - top })
  else if (r.bottom > window.innerHeight - 8) window.scrollBy({ top: r.bottom - window.innerHeight + 8 })
}

// Elementos navegables que están a la vista, agrupados por fila de la pantalla (en split-screen las tarjetas van de a dos por fila)
const screenRows = () => {
  const items = [...document.querySelectorAll('[data-nav]')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { key: el.dataset.nav, top: r.top + window.scrollY, left: r.left, cx: r.left + r.width / 2 } })
    .sort((a, b) => a.top - b.top || a.left - b.left)
  const rows = []
  items.forEach((it) => {
    const last = rows[rows.length - 1]
    if (last && Math.abs(it.top - last[0].top) < 8) last.push(it); else rows.push([it])
  })
  rows.forEach((r) => r.sort((a, b) => a.left - b.left))
  return rows
}

// Siguiente elemento al mover en una dirección. En una sola columna, izquierda y derecha no hacen nada.
const nextByDirection = (rows, sel, dir, colX) => {
  const ri = rows.findIndex((r) => r.some((i) => i.key === sel))
  if (ri < 0) return null
  const row = rows[ri]
  const ci = row.findIndex((i) => i.key === sel)
  if (dir === 'ArrowRight') return ci < row.length - 1 ? row[ci + 1] : row.length > 1 ? rows[ri + 1]?.[0] ?? null : null
  if (dir === 'ArrowLeft') return ci > 0 ? row[ci - 1] : row.length > 1 ? (rows[ri - 1] ? rows[ri - 1][rows[ri - 1].length - 1] : null) : null
  const target = rows[ri + (dir === 'ArrowDown' ? 1 : -1)]
  if (!target) return null
  const x = colX ?? row[ci].cx
  return target.reduce((best, i) => (Math.abs(i.cx - x) < Math.abs(best.cx - x) ? i : best), target[0])
}

export default function BetTable({ bets, weekStart, pct, canEdit, suggest, enabled = true, onEdit, onOpenEdit, onDelete, onAdd, onSearchTeam, onShowCombo }) {
  const ro = !canEdit
  const [sel, setSel] = useState(null) // fila elegida con el teclado: 'bet:<id>' o 'add:<fecha>'
  const colX = useRef(null) // columna en la que veníamos (para subir y bajar sin saltar de columna)

  // Orden de recorrido: las jugadas de cada día y, al final del día, "Agregar jugada"
  const order = useMemo(
    () => DAYS.flatMap((d, i) => {
      const list = bets.filter((b) => b.dia === d).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((b) => `bet:${b.id}`)
      return canEdit ? [...list, `add:${addDays(weekStart, i)}`] : list
    }),
    [bets, weekStart, canEdit]
  )

  useEffect(() => { if (sel && !order.includes(sel)) setSel(null) }, [order, sel])
  useEffect(() => { if (sel) reveal(sel) }, [sel])

  // ↑ ↓ para moverse, Enter para editar (o agregar), Esc para soltar. No actúa mientras se escribe en un campo.
  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => {
      const t = e.target
      if (!t || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const vertical = e.key === 'ArrowDown' || e.key === 'ArrowUp'
        if (!order.length) return
        const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight'
        if (!sel) { e.preventDefault(); setSel(forward ? order[0] : order[order.length - 1]); return }
        const rows = screenRows()
        const next = nextByDirection(rows, sel, e.key, colX.current)
        if (!vertical && !next) return // una sola columna: se deja el comportamiento normal de la flecha
        e.preventDefault()
        if (next) {
          if (rows.find((r) => r.some((i) => i.key === next.key)).length > 1) colX.current = next.cx // quedó en una fila de varias tarjetas
          setSel(next.key)
        }
      } else if (e.key === 'Enter' && sel && !['BUTTON', 'A'].includes(t.tagName)) {
        e.preventDefault()
        if (sel.startsWith('add:')) { if (canEdit) onAdd(sel.slice(4)) }
        else {
          const bet = bets.find((b) => `bet:${b.id}` === sel)
          if (bet) canEdit ? onOpenEdit(bet) : isCombo(bet) && onShowCombo(bet)
        }
      } else if (e.key === 'Escape' && sel) setSel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, order, sel, bets, canEdit, onAdd, onOpenEdit, onShowCombo])

  const navRow = (key) => (sel === key ? 'outline outline-2 -outline-offset-2 outline-cyan !bg-cyan/15' : '')
  return (
    <>
    <div className="hidden wide:block border border-line rounded-2xl overflow-hidden bg-surface/80">
      <table className="w-full table-fixed text-left border-collapse">
        <colgroup>
          {[120, 76, null, 132, 104, 84, 116, 120, 120, 142, 88].map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-strong text-onstrong text-[11px] uppercase">
          <tr>
            {HEAD.map((h, i) => (
              <th key={i} className={`${td} px-3 py-2.5 font-bold ${[4, 5, 7, 8].includes(i) ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        {DAYS.map((d, i) => {
          const date = addDays(weekStart, i)
          const list = bets.filter((b) => b.dia === d).sort((a, b) => a.fecha.localeCompare(b.fecha))
          return (
            <tbody key={d}>
              <tr className="bg-strong text-onstrong">
                <td colSpan={11} className={`${td} px-2 py-1 font-extrabold tracking-wide text-xs`}>
                  <span className="text-amber-300">{d.toUpperCase()}</span> <span className="num text-onstrong/70 font-medium ml-1">{fmtDate(date)}</span>
                  {list.length === 0 && <span className="ml-3 text-onstrong/60 font-normal">Sin jugadas</span>}
                </td>
              </tr>
              {list.map((b, n) => {
                const cur = b.moneda || 'ARS'
                const combo = isCombo(b)
                const legs = selections(b)
                return (
                  <tr key={b.id} data-nav={`bet:${b.id}`} onClick={() => { colX.current = null; setSel(`bet:${b.id}`) }} className={`${n % 2 ? 'bg-zebra/80' : 'bg-surface/60'} transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan/5 hover:shadow-lg hover:relative hover:z-[1] ${navRow(`bet:${b.id}`)}`}>
                    <td className={td}>
                      <input
                        type="date" value={b.fecha} readOnly={ro}
                        onChange={(e) => e.target.value && onEdit(b.id, { fecha: e.target.value, dia: dayFromDate(e.target.value) })}
                        className="cell num text-xs w-full"
                      />
                    </td>
                    <td className={td}>
                      <select
                        disabled={ro} value={cur}
                        onChange={(e) => onEdit(b.id, { moneda: e.target.value, monto: toAmount(shortcutOf(b), e.target.value) })}
                        className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'} w-full !py-1.5 appearance-none text-center cursor-pointer disabled:cursor-default`}
                        title="Al cambiar de moneda se mantiene el número de la cuota"
                      >
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      {combo ? (
                        <button
                          onClick={() => onShowCombo(b)} className="w-full text-left px-1.5 py-1 rounded hover:bg-head/70 flex items-center gap-1.5"
                          title={legs.map((x, i) => `${i + 1}) ${x.evento}${x.tipo ? ' · ' + marketLabel(x.tipo) : ''} @ ${Number(x.linea).toFixed(2)}`).join(' | ')}
                        >
                          <span className="pill pill-cyan shrink-0">COMBINADA</span>
                          <span className="font-semibold truncate">{b.evento}</span>
                          <span className="shrink-0 text-[11px] text-muted">(+{legs.length - 1} {legs.length - 1 === 1 ? 'selección' : 'selecciones'})</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 pl-2">
                          <span className="pill pill-indigo shrink-0">SIMPLE</span>
                          <Cell value={b.evento} readOnly={ro} suggest={ro ? null : suggest} onCommit={(v) => v.trim() && onEdit(b.id, { evento: v.trim().toUpperCase() })} className="font-semibold" />
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      {combo ? (
                        <span className="px-2.5 text-xs text-muted">Combinada</span>
                      ) : (
                        <select
                          disabled={ro} value={b.tipo || ''}
                          onChange={(e) => onEdit(b.id, { tipo: e.target.value })}
                          className="cell text-xs w-full" title="Tipo de jugada"
                        >
                          {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className={td}>
                      <Cell
                        value={shortcutOf(b)} readOnly={ro} inputMode="decimal" title={`= ${money(b.monto, cur)}`}
                        onCommit={(v) => toAmount(v, cur) > 0 && onEdit(b.id, { monto: toAmount(v, cur) })}
                        className="num text-right"
                      />
                      <div className="num text-[10px] text-muted text-right px-1.5 -mt-1">{money(b.monto, cur)}</div>
                    </td>
                    <td className={td}>
                      {combo ? (
                        <>
                          <div className="num text-xs text-right px-1.5 pt-1 text-muted">{b.lineaRaw || legs.map((x) => Number(x.linea).toFixed(2)).join(' x ')}</div>
                          <div className="num text-[11px] text-cyan text-right px-1.5 pb-0.5 font-bold">= {b.linea.toFixed(2)}</div>
                        </>
                      ) : (
                        <Cell
                          value={b.linea} readOnly={ro} inputMode="decimal"
                          onCommit={(v) => { const o = parseOdds(v); o && o.parts === 1 && onEdit(b.id, { linea: o.value, lineaRaw: null }) }}
                          className="num text-right"
                        />
                      )}
                    </td>
                    <td className={`${td} px-3`}><StatusPill disabled={ro} value={b.estado} onChange={(estado) => onEdit(b.id, { estado })} /></td>
                    <td className={`${td} px-3 py-2 text-right num font-bold ${col(houseNet(b))}`}>{money(houseNet(b), cur)}</td>
                    <td className={`${td} px-3 py-2 text-right num`}>{money(payout(b), cur)}</td>
                    <td className={`${td} px-3 text-[11px] text-muted whitespace-nowrap overflow-hidden text-ellipsis`}
                        title={b.modAt ? `${new Date(b.modAt).toLocaleString('es-AR')}${b.createdBy ? ` · Creada por ${b.createdBy}` : ''}` : ''}>
                      {b.modBy ? <span className="pill pill-violet normal-case !tracking-normal !text-[10px]">Mod. por {b.modBy}</span> : '—'}
                    </td>
                    <td className={`${td} px-1 whitespace-nowrap text-center`}>
                      <button
                        onClick={() => (combo ? onShowCombo(b) : onSearchTeam(b.evento, b))}
                        className="p-1 text-muted hover:text-cyan" aria-label="Buscar equipo" title={combo ? 'Ver las selecciones de la combinada' : 'Buscar este equipo en todas las jugadas y en Google'}
                      ><Search size={15} /></button>
                      {canEdit && (
                        <>
                          <button onClick={() => onOpenEdit(b)} className="p-1 text-muted hover:text-gold" aria-label="Editar" title="Editar jugada">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => onDelete(b.id)} className="p-1 text-muted hover:text-loss" aria-label="Borrar" title="Borrar">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
              {canEdit && (
                <tr data-nav={`add:${date}`} onClick={() => setSel(`add:${date}`)} className={`bg-surface/40 ${navRow(`add:${date}`)}`}>
                  <td colSpan={11} className={`${td} px-2 py-0.5`}>
                    <button onClick={() => onAdd(date)} className="inline-flex items-center gap-1 text-xs font-bold text-cyan hover:underline py-0.5">
                      <Plus size={14} /> Agregar jugada
                    </button>
                  </td>
                </tr>
              )}
              {CURRENCIES.map((c) => {
                const sub = list.filter((b) => (b.moneda || 'ARS') === c)
                if (!sub.length) return null
                const t = totals(sub)
                return (
                  <tr key={c} className="bg-head/50">
                    <td colSpan={11} className={`${td} px-3 py-1 text-xs`}>
                      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-0.5 justify-end">
                        <span className="font-bold text-muted mr-auto">Subtotal {d} · {c}</span>
                        <Chip label="Total apostado" value={money(apostadoNeto(t, pct), c)} tone="" />
                        <Chip label="Ganó el cliente" value={money(t.returned, c)} tone={t.returned > 0 ? 'text-loss' : 'text-muted'} />
                        <Chip label={diffLabel(apostadoNeto(t, pct) - t.returned)} value={money(apostadoNeto(t, pct) - t.returned, c)} tone={col(apostadoNeto(t, pct) - t.returned)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
    <BetCards
      sel={sel} setSel={(k) => { colX.current = null; setSel(k) }}
      bets={bets} weekStart={weekStart} pct={pct} canEdit={canEdit}
      onEdit={onEdit} onOpenEdit={onOpenEdit} onDelete={onDelete} onAdd={onAdd} onSearchTeam={onSearchTeam} onShowCombo={onShowCombo}
    />
    </>
  )
}
