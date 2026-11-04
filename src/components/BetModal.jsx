import { useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  CURRENCIES, CUR_LABEL, comboLine, dayFromDate, isCombo, localISO, money, parseOdds, shortcutOf, toAmount, uid,
} from '../lib/logic'
import { MARKETS } from '../lib/sports'
import { useExit } from '../lib/useExit'

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
export default function BetModal({ bet, initialDate, suggestAll, canon, onSave, onClose }) {
  const editing = !!bet
  const box = useRef()
  const { close, ov, card } = useExit(onClose)
  const [saved, setSaved] = useState(0) // jugadas cargadas seguidas con "guardar y cargar otra"
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
  // Tab acepta el primer equipo sugerido ("¿Te referís a …?")
  const tab = (i) => (e) => {
    const first = suggestAll(sels[i].evento)[0]
    if (e.key === 'Tab' && !e.shiftKey && first) { e.preventDefault(); setSel(i, { evento: first }) }
  }

  const focusField = (name) => setTimeout(() => box.current?.querySelector(`[data-f="${name}"]`)?.focus(), 0)

  // again = guardar y dejar el formulario listo para la jugada siguiente (se conservan fecha, moneda, modo y cuota)
  const save = (again = false) => {
    if (!ok) return
    const list = active.map((s, i) => ({ evento: canon(s.evento) || s.evento.trim().toUpperCase(), tipo: s.tipo, linea: lines[i] }))
    onSave({
      ...(editing ? {} : { id: uid(), estado: 'PENDIENTE' }),
      fecha: f.fecha, dia: dayFromDate(f.fecha), moneda: f.moneda, monto,
      modo: combo ? 'combinada' : 'simple',
      evento: list[0].evento,
      tipo: combo ? '' : list[0].tipo,
      selecciones: combo ? list : null,
      linea: total,
      lineaRaw: combo ? list.map((s) => s.linea).join(' x ') : null,
    }, { again: again && !editing })
    if (again && !editing) {
      setSels([blank(), blank()])
      setSaved((n) => n + 1)
      focusField('evento-0')
    } else close()
  }

  // Enter guarda si está todo completo; si falta algo, salta al primer dato que falta
  const onEnter = (e) => {
    if (e.key === 'Escape') return close()
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return
    e.preventDefault()
    if (ok) return save(e.ctrlKey || e.metaKey)
    if (!(monto > 0)) return focusField('cuota')
    const iEv = active.findIndex((x) => !x.evento.trim())
    if (iEv >= 0) return focusField(`evento-${iEv}`)
    const iLn = lines.findIndex((n) => !n)
    if (iLn >= 0) return focusField(`linea-${iLn}`)
  }

  const row = (s, i) => (
    <div key={i} className="rounded-xl border border-line p-2.5 space-y-2 bg-surface/50">
      <div className="flex items-center gap-2">
        {combo && <span className="text-xs font-extrabold text-gold w-5">{i + 1}</span>}
        <input
          className="field !py-1.5" placeholder={combo ? 'Equipo / evento' : 'Ej: INSTITUTO'} value={s.evento} data-f={`evento-${i}`}
          autoFocus={!editing && i === 0}
          onChange={(e) => setSel(i, { evento: e.target.value })} onKeyDown={tab(i)}
        />
        {combo && sels.length > 2 && (
          <button onClick={() => setSels((l) => l.filter((_, j) => j !== i))} className="p-1.5 text-muted hover:text-loss" aria-label="Quitar selección">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {(() => {
        const opts = suggestAll(s.evento)
        return opts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-gold font-semibold">¿Te referís a</span>
            {opts.map((name, k) => (
              <button key={name} type="button" onClick={() => setSel(i, { evento: name })} tabIndex={-1}
                className="rounded-full border border-gold/60 bg-gold/10 px-2 py-0.5 font-bold text-gold hover:bg-gold/20">
                {name}{k === 0 && <span className="font-normal opacity-70"> · Tab ⇥</span>}
              </button>
            ))}
            <span className="text-gold font-semibold">?</span>
          </div>
        )
      })()}
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <select className="field !py-1.5 !text-sm" value={s.tipo} onChange={(e) => setSel(i, { tipo: e.target.value })}>
          {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.id ? m.label : 'Tipo de jugada'}</option>)}
        </select>
        <input className="field num !py-1.5 text-right" inputMode="decimal" placeholder="Línea" value={s.linea} data-f={`linea-${i}`} onChange={(e) => setSel(i, { linea: e.target.value })} />
      </div>
    </div>
  )

  return (
    <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 ${ov}`} onClick={close}>
      <div
        ref={box}
        className={`glass border rounded-2xl w-full max-w-md max-h-[94vh] overflow-y-auto p-5 space-y-3 shadow-2xl ${card}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onEnter}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold">{editing ? 'Editar jugada' : 'Nueva jugada'}</h2>
          <button onClick={close} className="p-1 text-muted hover:text-ink" aria-label="Cerrar"><X size={20} /></button>
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
          <input inputMode="decimal" className="field num mt-1" placeholder="Ej: 100" value={f.cuota} data-f="cuota" onChange={set('cuota')} />
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

        {saved > 0 && <div className="text-sm font-semibold text-win">✓ {saved === 1 ? 'Jugada guardada' : `${saved} jugadas guardadas`}. Cargá la siguiente.</div>}

        <div className="flex flex-wrap gap-2 pt-1 justify-end">
          <button onClick={close} className="btn">{saved > 0 ? 'Listo' : 'Cancelar'}</button>
          {!editing && <button onClick={() => save(true)} disabled={!ok} className="btn" title="Atajo: Ctrl + Enter">Guardar y cargar otra</button>}
          <button onClick={() => save(false)} disabled={!ok} className="btn-primary" title="Atajo: Enter">{editing ? 'Guardar cambios' : 'Guardar'}</button>
        </div>
        <p className="text-[11px] text-muted">Enter guarda · Ctrl + Enter guarda y abre otra · Tab completa el equipo sugerido · Esc cierra</p>
      </div>
    </div>
  )
}
