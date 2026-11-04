import { useState } from 'react'
import { KeyRound, Loader2, X } from 'lucide-react'
import { useExit } from '../lib/useExit'

// Formulario para elegir una contraseña nueva. En modo "forced" (clave temporal) no pide la actual: ya la tiene la sesión.
function Form({ auth, forced, onDone }) {
  const [old, setOld] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const oldValue = forced ? auth.tempPass : old
  const valid = oldValue && pass.length >= 8 && pass === pass2 && pass !== oldValue

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true); setError('')
    const r = await auth.changePassword(oldValue, pass)
    setBusy(false)
    if (!r.ok) setError(r.error); else onDone?.()
  }

  return (
    <div className="space-y-3" onKeyDown={(e) => e.key === 'Enter' && submit()}>
      {!forced && (
        <label className="block text-xs font-semibold text-muted">Contraseña actual
          <input type="password" autoFocus className="field mt-1" value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" />
        </label>
      )}
      <label className="block text-xs font-semibold text-muted">Contraseña nueva (mínimo 8 caracteres)
        <input type="password" autoFocus={forced} className="field mt-1" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="block text-xs font-semibold text-muted">Repetí la contraseña nueva
        <input type="password" className="field mt-1" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        {pass2 && pass !== pass2 && <span className="text-loss text-xs">Las contraseñas no coinciden.</span>}
      </label>
      {error && <div className="rounded-xl border border-loss/50 bg-loss/10 p-2.5 text-sm text-loss">{error}</div>}
      <button onClick={submit} disabled={!valid || busy} className="btn-primary w-full justify-center">
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Guardar contraseña nueva
      </button>
    </div>
  )
}

// Pantalla obligatoria después de entrar con una clave temporal
export function ForcePasswordScreen({ auth }) {
  return (
    <div className="fixed inset-0 z-[70] bg-bg flex items-center justify-center p-4 modal-ov">
      <div className="bento w-full max-w-sm p-6 space-y-3 shadow-2xl modal-card">
        <div className="flex items-center gap-2"><KeyRound size={20} className="text-gold" /><h1 className="text-lg font-extrabold">Elegí tu contraseña nueva</h1></div>
        <p className="text-sm text-muted">Entraste con una clave temporal que te dio Cris o Vale. Elegí una contraseña propia para seguir.</p>
        <Form auth={auth} forced />
        <button onClick={auth.logout} className="w-full text-center text-xs text-muted underline">Cerrar sesión</button>
      </div>
    </div>
  )
}

// Ventana para cambiar la contraseña desde el menú de la cuenta
export default function ChangePasswordModal({ auth, onClose }) {
  const [done, setDone] = useState(false)
  const { close, ov, card } = useExit(onClose)
  return (
    <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 ${ov}`} onClick={close}>
      <div className={`glass border rounded-2xl w-full max-w-sm p-5 space-y-3 shadow-2xl ${card}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-gold" />
          <h2 className="font-extrabold flex-1">Cambiar contraseña</h2>
          <button onClick={close} className="p-1 text-muted hover:text-ink" aria-label="Cerrar"><X size={20} /></button>
        </div>
        {done ? (
          <>
            <p className="text-sm text-win font-semibold">Listo: tu contraseña se cambió. Si tenías la sesión abierta en otros equipos, se cerraron.</p>
            <button onClick={close} className="btn w-full justify-center">Cerrar</button>
          </>
        ) : <Form auth={auth} onDone={() => setDone(true)} />}
      </div>
    </div>
  )
}
