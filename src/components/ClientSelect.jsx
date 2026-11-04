import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2, Users } from 'lucide-react'

// Selector de cliente desplegable (reemplaza la fila larga de pestañas)
export default function ClientSelect({ clients, active, onChange, onAdd, onRename, onDelete, canManage }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(null) // 'add' | 'rename'
  const [name, setName] = useState('')
  const box = useRef()

  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setMode(null) } }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const start = (m, initial = '') => { setMode(m); setName(initial) }
  const submit = () => {
    const n = name.trim().toUpperCase()
    if (n && !clients.includes(n)) {
      if (mode === 'add') { onAdd(n); onChange(n) }
      if (mode === 'rename') { onRename(active, n); onChange(n) }
    }
    setMode(null)
  }

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="bento flex items-center gap-2.5 w-full sm:w-64 px-3.5 py-2.5 text-left hover:!border-cyan transition"
        aria-haspopup="listbox" aria-expanded={open}
      >
        <Users size={18} className="text-cyan shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted leading-none">Cliente</span>
          <span className="block font-extrabold text-gold truncate leading-tight">{active}</span>
        </span>
        <ChevronDown size={18} className={`text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[min(92vw,380px)] glass border rounded-2xl shadow-2xl p-2 space-y-2">
          {mode ? (
            <div className="flex gap-2">
              <input
                autoFocus value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => (e.key === 'Enter' ? submit() : e.key === 'Escape' && setMode(null))}
                placeholder={mode === 'add' ? 'Nombre del cliente nuevo' : 'Nuevo nombre'} className="field !py-1.5 !text-sm"
              />
              <button onClick={submit} className="btn-primary !px-3 !py-1.5">OK</button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-1 max-h-[46vh] overflow-y-auto" role="listbox">
            {clients.map((c) => (
              <button
                key={c} role="option" aria-selected={c === active}
                onClick={() => { onChange(c); setOpen(false); setMode(null) }}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold text-left transition ${
                  c === active ? 'bg-gold/15 text-gold border border-gold/50' : 'border border-transparent hover:bg-head'
                }`}
              >
                <span className="truncate">{c}</span>
                {c === active && <Check size={15} className="shrink-0" />}
              </button>
            ))}
          </div>

          {canManage && !mode && (
            <div className="flex flex-wrap gap-1.5 border-t border-line pt-2">
              <button onClick={() => start('add')} className="btn !py-1 text-xs !text-cyan"><Plus size={14} /> Agregar cliente</button>
              <button onClick={() => start('rename', active)} className="btn !py-1 text-xs"><Pencil size={13} /> Editar nombre</button>
              <button
                onClick={() => { setOpen(false); onDelete(active) }} disabled={clients.length <= 1}
                className="btn !py-1 text-xs !text-loss hover:!border-loss"
              ><Trash2 size={13} /> Eliminar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
