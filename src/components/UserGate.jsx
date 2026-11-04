import { useState } from 'react'
import { UserPlus, User, Eye, Pencil, X } from 'lucide-react'

export default function UserGate({ users, onPick, onAdd, onClose }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [perm, setPerm] = useState('edit')

  const create = () => {
    const n = name.trim()
    if (!n) return
    onAdd(n, perm)
    setName('')
    setAdding(false)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface border border-line rounded-lg w-full max-w-sm p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">¿Quién está usando la planilla?</h2>
            <p className="text-muted text-sm">Elegí tu usuario para registrar tus cambios.</p>
          </div>
          {onClose && <button onClick={onClose} className="p-1 text-muted hover:text-ink" aria-label="Cerrar"><X size={20} /></button>}
        </div>

        <div className="space-y-2">
          {users.map((u) => (
            <button key={u.id} onClick={() => onPick(u.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-line hover:border-cta hover:bg-head text-left">
              <User size={20} className="text-cta" />
              <span className="font-bold text-base flex-1">{u.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted">
                {u.perm === 'edit' ? <><Pencil size={13} /> Edición completa</> : <><Eye size={13} /> Solo lectura</>}
              </span>
            </button>
          ))}
        </div>

        {adding ? (
          <div className="space-y-2 border-t border-line pt-3">
            <input autoFocus className="field" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
            <select className="field" value={perm} onChange={(e) => setPerm(e.target.value)}>
              <option value="edit">Edición completa</option>
              <option value="read">Solo lectura</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="btn">Cancelar</button>
              <button onClick={create} disabled={!name.trim()} className="btn-primary">Agregar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="btn w-full justify-center"><UserPlus size={16} /> Agregar usuario</button>
        )}
      </div>
    </div>
  )
}
