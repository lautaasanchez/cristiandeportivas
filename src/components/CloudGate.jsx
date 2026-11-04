import { useState } from 'react'
import { Cloud, KeyRound } from 'lucide-react'

// Pantalla de acceso: el código de la familia identifica la planilla compartida en la nube.
export default function CloudGate({ onConnect, onLocal }) {
  const [code, setCode] = useState('')
  const ok = code.trim().length >= 12
  return (
    <div className="fixed inset-0 z-[70] bg-bg flex items-center justify-center p-4">
      <div className="bento w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-cta/20 p-2 text-cyan"><Cloud size={22} /></span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">Cristian Deportivas</h1>
            <p className="text-muted text-xs">Planilla compartida en la nube</p>
          </div>
        </div>
        <p className="text-sm text-muted">Ingresá el <b className="text-ink">código de acceso</b> para ver y editar la misma planilla desde cualquier dispositivo. Pedíselo a quien lo creó.</p>
        <label className="block text-xs font-semibold text-muted">Código de acceso
          <div className="relative mt-1">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan" />
            <input
              autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok && onConnect(code)}
              className="field !pl-9" placeholder="Ej: mi-codigo-largo-y-secreto" autoComplete="off"
            />
          </div>
        </label>
        <p className="text-[11px] text-muted">Mínimo 12 caracteres. Todos los que usen el mismo código comparten la misma planilla; con un código nuevo se crea una planilla nueva.</p>
        <button onClick={() => onConnect(code)} disabled={!ok} className="btn-primary w-full justify-center">Entrar</button>
        <button onClick={onLocal} className="w-full text-center text-xs text-muted underline">Usar solo en este equipo (sin nube)</button>
      </div>
    </div>
  )
}
