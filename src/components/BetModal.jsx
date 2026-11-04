import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  CURRENCIES, CUR_LABEL, comboLine, dayFromDate, isCombo, localISO, money, parseOdds, shortcutOf, toAmount, uid,
} from '../lib/logic'
import { MARKETS } from '../lib/sports'

const blank = () => ({ evento: '', tipo: '', linea: '' })

// Selecciones iniciales según la jugada (simple o combinada)
const initialSels = (bet) => {
  if (!bet) return [blank(), blank()]
  if (isCombo(bet)) return bet.selecciones.map((s) => ({ evento: s.evento, tipo: s.tipo || '', linea: String(s.linea) }))
  const parts = bet.lineaRaw ? bet.lineaRaw.split(/\s*x\s*/i) : null // jugadas viejas con "1.3 x 1.4"
  if (parts && parts.length > 1) return parts.map((p, i) => ({ evento: i === 0 ? bet.evento : '', tipo: bet.tipo || '', linea: p }))
  return [{ evento: bet.evento, tipo: bet.tipo || '', linea: bet.linea > 1 ? String(bet.linea) : '' }, blank()]
}
const startsCombo = (bet) => !!bet && (isCombo(bet) || (bet.lineaRaw && /x/i.test(bet.lineaRaw)))

const single = (text) => { const o = parseOdds(text); return o && o.parts === 1 ? o.value : null }

// Sirve para "Nueva jugada" y, con `bet`, para "Editar jugada". Dos modos: Simple y Combinada.
export default function BetModal({ bet, initialDate, suggest, onSave, onClose }) {
  const editing = !!bet
  const [modo, setModo] = useState(startsCombo(bet) ? 'combinada' : 'simple')
  const [sels, setSels] = useState(() => initialSels(bet))
  const [f, setF] = useState(
    bet
      ? { fecha: bet.fecha, moneda: bet.moneda || 'ARS', cuota: String(shortcutOf(bet)) }
      : { fecha: initialDate || localISO(new Date()), moneda: 'ARS', cuota: '' }
  )
  const combo = modo === 'combinada'
  const active = combo ? sels : sels.slice(0, 1)
  const lines = active.map((s) => single(s.linea))
  const monto = toAmount(f.cuota, f.moneda)
  const total = lines.every((n) => n) ? comboLine(lines) : null
  const ok = monto > 0 && total > 1 && active.every((s) => s.evento.trim()) && (!combo || active.length >= 2)

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setSel = (i, patch) => setSels((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const tab = (i) => (e) => {
    const hint = suggest(sels[i].evento)
    if (e.key === 'Tab' && hint) { e.preventDefault(); setSel(i, { evento: hint }) }
  }

  const save = () => {
    if (!ok) return
    const list = active.map((s, i) => ({ evento: s.evento.trim().toUpperCase(), tipo: s.tipo, linea: lines[i] }))
    onSave({
      ...(editing ? {} : { id: uid(), estado: 'PENDIENTE' }),
      fecha: f.fecha, dia: dayFromDate(f.fecha), moneda: f.moneda, monto,
      modo: combo ? 'combinada' : 'simple',
      evento: list[0].evento,
      tipo: combo ? '' : list[0].tipo,
      selecciones: combo ? list : null,
      linea: total,
      lineaRaw: combo ? list.map((s) => s.linea).join(' x ') : null,
    })
  }

  const row = (s, i) => (
    <div key={i} className="rounded-xl border border-line p-2.5 space-y-2 bg-surface/50">
      <div className="flex items-center gap-2">
        {combo && <span className="text-xs font-extrabold text-gold w-5">{i + 1}</span>}
        <input
          className="field !py-1.5" placeholder={combo ? 'Equipo / evento' : 'Ej: INSTITUTO'} value={s.evento}
          autoFocus={!editing && i === 0}
          onChange={(e) => setSel(i, { evento: e.target.value })} onKeyDown={tab(i)}
        />
        {combo && sels.length > 2 && (
          <button onClick={() => setSels((l) => l.filter((_, j) => j !== i))} className="p-1.5 text-muted hover:text-loss" aria-label="Quitar selección">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {suggest(s.evento) && <div className="text-xs text-gold">Tab ⇥ para completar: <b>{suggest(s.evento)}</b></div>}
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <select className="field !py-1.5 !text-sm" value={s.tipo} onChange={(e) => setSel(i, { tipo: e.target.value })}>
          {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.id ? m.label : 'Tipo de jugada'}</option>)}
        </select>
        <input className="field num !py-1.5 text-right" inputMode="decimal" placeholder="Línea" value={s.linea} onChange={(e) => setSel(i, { linea: e.target.value })} />
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div
        className="glass border rounded-2xl w-full max-w-md max-h-[94vh] overflow-y-auto p-5 space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Enter' && e.target.tagName === 'INPUT' && save()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold">{editing ? 'Editar jugada' : 'Nueva jugada'}</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-ink" aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-line p-1 gap-1 bg-head/60">
          {[['simple', 'Simple'], ['combinada', 'Combinada']].map(([id, label]) => (
            <button
              key={id} onClick={() => setModo(id)}
              className={`py-1.5 rounded-lg text-sm font-bold transition ${modo === id ? 'bg-cta text-oncta shadow' : 'text-muted hover:text-ink'}`}
            >{label}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setF({ ...f, moneda: c })}
              className={`py-2 rounded-xl border text-sm font-bold ${f.moneda === c ? 'bg-cta text-oncta border-cta' : 'border-line hover:border-cyan'}`}
            >
              {CUR_LABEL[c]} ($ {c})
            </button>
          ))}
        </div>

        <label className="block font-semibold">
          Fecha <span className="text-muted font-normal">({dayFromDate(f.fecha)})</span>
          <input type="date" className="field mt-1" value={f.fecha} onChange={set('fecha')} />
        </label>
        <label className="block font-semibold">
          Cuota (monto jugado) {f.moneda === 'USD' && <span className="text-muted font-normal">· dólares, valor directo</span>}
          <input inputMode="decimal" className="field num mt-1" placeholder="Ej: 100" value={f.cuota} onChange={set('cuota')} />
          <span className="num text-win text-sm">(Equivale a {money(monto, f.moneda)})</span>
        </label>

        <div className="space-y-2">
          <div className="font-semibold">{combo ? 'Selecciones de la combinada' : 'Evento, tipo y línea'}</div>
          {active.map(row)}
          {combo && (
            <button onClick={() => setSels((l) => [...l, blank()])} className="btn w-full justify-center !text-cyan"><Plus size={16} /> Agregar selección</button>
          )}
          {combo && total && (
            <div className="num text-cyan text-sm">
              {lines.map((n) => n.toFixed(2)).join(' x ')} = <b>{total.toFixed(2)}</b>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1 justify-end">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={save} disabled={!ok} className="btn-primary">{editing ? 'Guardar cambios' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
