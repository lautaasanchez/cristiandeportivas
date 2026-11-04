import { useState } from 'react'
import { Cloud, Eye, Loader2, LockKeyhole, Pencil, UserRound } from 'lucide-react'

function Field({ label, children }) {
  return <label className="block text-xs font-semibold text-muted">{label}<div className="mt-1">{children}</div></label>
}

// Pantalla de entrada: iniciar sesión o registrarse
export default function AuthGate({ auth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [f, setF] = useState({ username: '', password: '', password2: '', display: '', wantsEdit: false, remember: true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const valid =
    f.username.trim().length >= 3 && f.password.length >= (mode === 'register' ? 8 : 1) &&
    (mode === 'login' || (f.display.trim().length >= 2 && f.password === f.password2))

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true); setError('')
    const r = mode === 'login'
      ? await auth.login(f.username, f.password, f.remember)
      : await auth.register({ username: f.username, password: f.password, display: f.display, wantsEdit: f.wantsEdit, remember: f.remember })
    setBusy(false)
    if (!r.ok) setError(r.error)
  }

  return (
    <div className="fixed inset-0 z-[70] bg-bg overflow-y-auto flex items-center justify-center p-4">
      <div className="bento w-full max-w-sm p-6 space-y-4 shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && submit()}>
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-cta/20 p-2 text-cyan"><Cloud size={22} /></span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">Cristian Deportivas</h1>
            <p className="text-muted text-xs">Planilla compartida en la nube</p>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-line p-1 gap-1 bg-head/60">
          {[['login', 'Ingresar'], ['register', 'Registrarme']].map(([id, label]) => (
            <button key={id} onClick={() => { setMode(id); setError('') }}
              className={`py-1.5 rounded-lg text-sm font-bold transition ${mode === id ? 'bg-cta text-oncta shadow' : 'text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </div>

        {mode === 'register' && (
          <Field label="Tu nombre (así se muestra en los cambios)">
            <input className="field" value={f.display} onChange={set('display')} placeholder="Ej: Cris" maxLength={30} autoComplete="name" />
          </Field>
        )}
        <Field label="Usuario">
          <div className="relative">
            <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan" />
            <input autoFocus className="field !pl-9" value={f.username} onChange={set('username')} placeholder="usuario" autoCapitalize="none" autoComplete="username" />
          </div>
        </Field>
        <Field label={mode === 'register' ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña'}>
          <div className="relative">
            <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan" />
            <input type="password" className="field !pl-9" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
        </Field>
        {mode === 'register' && (
          <>
            <Field label="Repetí la contraseña">
              <input type="password" className="field" value={f.password2} onChange={set('password2')} autoComplete="new-password" />
              {f.password2 && f.password !== f.password2 && <span className="text-loss text-xs">Las contraseñas no coinciden.</span>}
            </Field>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted">¿Qué necesitás hacer?</div>
              <label className={`flex gap-2.5 rounded-xl border p-2.5 cursor-pointer ${!f.wantsEdit ? 'border-cyan bg-cyan/10' : 'border-line'}`}>
                <input type="radio" name="perm" checked={!f.wantsEdit} onChange={() => setF({ ...f, wantsEdit: false })} className="mt-1" />
                <span className="text-sm"><b className="flex items-center gap-1"><Eye size={14} /> Solo ver</b><span className="text-muted text-xs">Cris o Vale tienen que aprobar tu cuenta.</span></span>
              </label>
              <label className={`flex gap-2.5 rounded-xl border p-2.5 cursor-pointer ${f.wantsEdit ? 'border-gold bg-gold/10' : 'border-line'}`}>
                <input type="radio" name="perm" checked={f.wantsEdit} onChange={() => setF({ ...f, wantsEdit: true })} className="mt-1" />
                <span className="text-sm"><b className="flex items-center gap-1"><Pencil size={14} /> Ver y editar</b><span className="text-muted text-xs">Cris o Vale tienen que aprobar tu cuenta y el permiso para editar.</span></span>
              </label>
            </div>
          </>
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={f.remember} onChange={set('remember')} /> Recordarme en este equipo
        </label>

        {error && <div className="rounded-xl border border-loss/50 bg-loss/10 p-2.5 text-sm text-loss">{error}</div>}

        <button onClick={submit} disabled={!valid || busy} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} {mode === 'login' ? 'Ingresar' : 'Crear cuenta y entrar'}
        </button>
      </div>
    </div>
  )
}

// Cuenta registrada pero sin acceso todavía (lectura automática desactivada) o bloqueada
export function WaitingScreen({ auth }) {
  return (
    <div className="fixed inset-0 z-[70] bg-bg flex items-center justify-center p-4">
      <div className="bento w-full max-w-sm p-6 space-y-3 text-center shadow-2xl">
        <h1 className="text-lg font-extrabold">Hola, {auth.user.displayName}</h1>
        <p className="text-sm text-muted">
          {auth.user.role === 'blocked'
            ? 'Tu cuenta está bloqueada. Hablá con Cris o Vale.'
            : 'Tu cuenta está esperando la aprobación de Cris o Vale. Esta pantalla se actualiza sola cuando te den acceso. Si olvidaste tu contraseña, pedile a Cris o Vale que te la restablezcan.'}
        </p>
        <button onClick={auth.logout} className="btn w-full justify-center">Cerrar sesión</button>
      </div>
    </div>
  )
}
