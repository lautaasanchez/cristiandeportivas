import { useEffect, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  BANCA, CURRENCIES, DAYS, addDays, balanceOf, dayFromDate, fmtDate, fmtFull, houseNet, isCombo, money, parseOdds, payout, selections, shortcutOf, toAmount, totals,
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
function BetCard({ b, canEdit, onEdit, onOpenEdit, onDelete, onSearchTeam, onShowCombo }) {
  const cur = b.moneda || 'ARS'
  const combo = isCombo(b)
  const legs = selections(b)
  return (
    <article className="bento p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <span className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'}`}>{cur}</span>
        <span className={`pill ${combo ? 'pill-cyan' : 'pill-mute'}`}>{combo ? 'COMBINADA' : 'SIMPLE'}</span>
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
        {b.modBy ? <span className="pill pill-indigo normal-case !tracking-normal !text-[10px] truncate">Mod. por {b.modBy}</span> : null}
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

function BetCards({ bets, weekStart, pct, canEdit, onEdit, onOpenEdit, onDelete, onAdd, onSearchTeam, onShowCombo }) {
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
                  <BetCard key={b.id} b={b} canEdit={canEdit} onEdit={onEdit} onOpenEdit={onOpenEdit} onDelete={onDelete} onSearchTeam={onSearchTeam} onShowCombo={onShowCombo} />
                ))}
              </div>
            )}
            {canEdit && (
              <button onClick={() => onAdd(date)} className="w-full rounded-xl border border-dashed border-line py-2.5 text-sm font-bold text-cyan hover:border-cyan flex items-center justify-center gap-1.5">
                <Plus size={16} /> Agregar jugada
              </button>
            )}
            {CURRENCIES.map((c) => {
              const sub = list.filter((b) => (b.moneda || 'ARS') === c)
              if (!sub.length) return null
              const t = totals(sub)
              const bal = balanceOf(t, pct)
              return (
                <div key={c} className="bento px-3 py-2 text-xs flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-bold text-muted mr-auto">Subtotal {d} · {c}</span>
                  <Chip label="Apostado" value={money(t.played, c)} tone="" />
                  <Chip label="Perdido" value={money(-t.lost, c)} tone={t.lost < 0 ? 'text-win' : 'text-muted'} />
                  <Chip label="Ganado" value={money(-t.won, c)} tone={t.won > 0 ? 'text-loss' : 'text-muted'} />
                  <Chip label="Balance" value={money(bal, c)} tone={col(bal)} />
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

export default function BetTable({ bets, weekStart, pct, canEdit, suggest, onEdit, onOpenEdit, onDelete, onAdd, onSearchTeam, onShowCombo }) {
  const ro = !canEdit
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
                  <tr key={b.id} className={n % 2 ? 'bg-zebra/80' : 'bg-surface/60'}>
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
                          <span className="pill pill-mute shrink-0">SIMPLE</span>
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
                      {b.modBy ? <span className="pill pill-indigo normal-case !tracking-normal !text-[10px]">Mod. por {b.modBy}</span> : '—'}
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
                <tr className="bg-surface/40">
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
                const bal = balanceOf(t, pct)
                return (
                  <tr key={c} className="bg-head/50">
                    <td colSpan={11} className={`${td} px-3 py-1 text-xs`}>
                      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-0.5 justify-end">
                        <span className="font-bold text-muted mr-auto">Subtotal {d} · {c}</span>
                        <Chip label="Total apostado" value={money(t.played, c)} tone="" />
                        <Chip label="Perdido" value={money(-t.lost, c)} tone={t.lost < 0 ? 'text-win' : 'text-muted'} />
                        <Chip label="Ganado" value={money(-t.won, c)} tone={t.won > 0 ? 'text-loss' : 'text-muted'} />
                        <Chip label="Balance final" value={money(bal, c)} tone={col(bal)} />
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
      bets={bets} weekStart={weekStart} pct={pct} canEdit={canEdit}
      onEdit={onEdit} onOpenEdit={onOpenEdit} onDelete={onDelete} onAdd={onAdd} onSearchTeam={onSearchTeam} onShowCombo={onShowCombo}
    />
    </>
  )
}
