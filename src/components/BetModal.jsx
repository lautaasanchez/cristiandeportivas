import { useEffect, useRef, useState } from 'react'
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

// Controles del formulario que se pueden enfocar, con su posición en pantalla
const controlsOf = (root) =>
  [...root.querySelectorAll('button, input, select')]
    .filter((el) => !el.disabled && el.tabIndex !== -1 && el.type !== 'hidden' && el.getClientRects().length > 0)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))

const sameRow = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) >= 0.5 * Math.min(a.height, b.height)

// Siguiente control al mover con una flecha: ← → dentro de la misma fila; ↑ ↓ a la fila de arriba o abajo (el más cercano en horizontal)
const nextControl = (root, from, key) => {
  const all = controlsOf(root)
  const cur = all.find((c) => c.el === from)
  if (!cur) return null
  const cx = cur.r.left + cur.r.width / 2
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    const row = all.filter((c) => c.el !== from && sameRow(c.r, cur.r))
    const side = key === 'ArrowRight' ? row.filter((c) => c.r.left >= cur.r.right - 4) : row.filter((c) => c.r.right <= cur.r.left + 4)
    side.sort((a, b) => (key === 'ArrowRight' ? a.r.left - b.r.left : b.r.right - a.r.right))
    return side[0]?.el ?? null
  }
  const down = key === 'ArrowDown'
  const cand = all.filter((c) => !sameRow(c.r, cur.r) && (down ? c.r.top >= cur.r.bottom - 4 : c.r.bottom <= cur.r.top + 4))
  if (!cand.length) return null
  cand.sort((a, b) => (down ? a.r.top - b.r.top : b.r.bottom - a.r.bottom))
  const band = cand.filter((c) => sameRow(c.r, cand[0].r))
  return band.reduce((best, c) => (Math.abs(c.r.left + c.r.width / 2 - cx) < Math.abs(best.r.left + best.r.width / 2 - cx) ? c : best), band[0]).el
}

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

  // Al abrir con Enter desde la planilla el foco seguía afuera y las flechas movían la pantalla de atrás.
  // Ahora el foco entra al formulario (en "Editar", al primer equipo con el cursor al final) y, si se pierde
  // (por ejemplo al tocar un espacio vacío), la primera flecha lo devuelve en vez de desplazar la página.
  useEffect(() => {
    const first = () => box.current?.querySelector('[data-f="evento-0"]')
    if (editing) {
      const el = first()
      if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length) } catch { /* sin cursor */ } }
    }
    const rescue = (e) => {
      if (!e.key.startsWith('Arrow') || !box.current || box.current.contains(document.activeElement)) return
      e.preventDefault()
      first()?.focus()
    }
    window.addEventListener('keydown', rescue, true)
    return () => window.removeEventListener('keydown', rescue, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  // Flechas: ↑ ↓ ← → pasan de un campo al de al lado. En un campo de texto, ← y → mueven el cursor y recién saltan
  // cuando el cursor ya está en el borde; en la fecha, ← y → recorren día, mes y año.
  const onArrows = (e) => {
    const t = e.target
    if (!box.current?.contains(t) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false
    const isText = t.tagName === 'INPUT' && !['date', 'checkbox', 'radio', 'button'].includes(t.type)
    const isDate = t.tagName === 'INPUT' && t.type === 'date'
    const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
    if (horizontal && isDate) return false
    if (horizontal && isText) {
      const len = t.value.length
      if (e.key === 'ArrowLeft' && !(t.selectionStart === 0 && t.selectionEnd === 0)) return false
      if (e.key === 'ArrowRight' && !(t.selectionStart === len && t.selectionEnd === len)) return false
    }
    const next = nextControl(box.current, t, e.key)
    if (next) {
      e.preventDefault()
      next.focus()
      if (next.tagName === 'INPUT' && next.type !== 'date') { // el cursor queda del lado por el que se entra
        const at = e.key === 'ArrowRight' ? 0 : next.value.length
        try { next.setSelectionRange(at, at) } catch { /* algunos tipos no lo permiten */ }
      }
    } else if (!horizontal && (isText || isDate || t.tagName === 'SELECT')) {
      e.preventDefault() // sin fila arriba/abajo: no cambiar el valor del campo sin querer
    }
    return true
  }

  const onEnter = (e) => {
    if (e.key === 'Escape') return close()
    if (e.key.startsWith('Arrow')) return onArrows(e)
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
        <p className="text-[11px] text-muted">Enter guarda · Ctrl + Enter guarda y abre otra · ↑ ↓ ← → te mueven entre campos · Tab completa el equipo sugerido · Esc cierra</p>
      </div>
    </div>
  )
}
