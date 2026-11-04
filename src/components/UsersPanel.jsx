import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff, ShieldPlus, Trash2, X } from 'lucide-react'
import { rpc } from '../lib/cloud'
import { useExit } from '../lib/useExit'

const ROLE = { edit: 'Editor', read: 'Solo lectura', pending: 'Sin acceso', blocked: 'Bloqueado' }
const ROLE_PILL = { edit: 'pill-win', read: 'pill-cyan', pending: 'pill-gold', blocked: 'pill-mute' }

// Cuántos pedidos esperan respuesta (cuentas nuevas + pedidos de edición)
export const pendingCount = (list) => list.filter((u) => u.out_role === 'pending' || (u.out_role === 'read' && u.out_wants)).length

const MESSAGES = {
  'no podés': 'No podés hacer eso con tu propia cuenta.',
  'unauthorized': 'Tu sesión venció. Volvé a iniciar sesión.',
  'forbidden': 'Solo los administradores pueden hacer esto.',
  'desbloqueá': 'Primero cambiale el permiso: está bloqueado.',
}
const explain = (e) => Object.entries(MESSAGES).find(([k]) => String(e.message).includes(k))?.[1] || 'No se pudo completar la acción.'

// Panel de administradores: aprobar cuentas, permisos, administradores, contraseñas y bajas
export default function UsersPanel({ token, me, onClose, onChanged }) {
  const { close, ov, card } = useExit(onClose)
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [confirm, setConfirm] = useState(null) // { kind: 'delete' | 'reset' | 'admin' | 'unadmin', user }
  const [temp, setTemp] = useState(null) // { user, pass }
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await rpc('admin_list', { p_token: token })
      setUsers(list); setError('')
      onChanged?.(pendingCount(list))
    } catch (e) { setError(e.forbidden ? 'Solo los administradores pueden ver esto.' : 'No se pudo cargar la lista. Revisá tu conexión.') }
  }, [token, onChanged])

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id) }, [load])

  const run = async (u, fn) => {
    setBusy(u.out_id); setError('')
    try { await fn(); await load() } catch (e) { setError(explain(e)) }
    setBusy(null)
  }
  const setRole = (u, role) => run(u, () => rpc('admin_set_role', { p_token: token, p_user_id: u.out_id, p_role: role }))

  const doConfirmed = async () => {
    const { kind, user } = confirm
    setConfirm(null)
    if (kind === 'delete') await run(user, () => rpc('admin_delete_user', { p_token: token, p_user_id: user.out_id }))
    if (kind === 'admin') await run(user, () => rpc('admin_set_admin', { p_token: token, p_user_id: user.out_id, p_value: true }))
    if (kind === 'unadmin') await run(user, () => rpc('admin_set_admin', { p_token: token, p_user_id: user.out_id, p_value: false }))
    if (kind === 'reset') {
      await run(user, async () => {
        const r = (await rpc('admin_reset_password', { p_token: token, p_user_id: user.out_id }))[0]
        setTemp({ user, pass: r.out_temp }); setCopied(false)
      })
    }
  }

  const copy = async () => { try { await navigator.clipboard.writeText(temp.pass); setCopied(true) } catch {} }

  const newAccounts = (users || []).filter((u) => u.out_role === 'pending')
  const editRequests = (users || []).filter((u) => u.out_role === 'read' && u.out_wants)

  const texts = {
    delete: (u) => ({ title: `¿Eliminar a ${u.out_display}?`, body: 'Se borra su cuenta para siempre. Las jugadas que cargó se conservan. Si vuelve, tiene que registrarse de nuevo.', label: 'Eliminar', danger: true }),
    reset: (u) => ({ title: `¿Restablecer la contraseña de ${u.out_display}?`, body: 'Se genera una clave temporal que le tenés que pasar vos. Se cierran sus sesiones y al entrar tendrá que elegir una contraseña nueva.', label: 'Restablecer', danger: false }),
    admin: (u) => ({ title: `¿Hacer administrador a ${u.out_display}?`, body: 'Va a poder editar, aprobar cuentas, cambiar permisos, restablecer contraseñas y eliminar usuarios (incluso a vos).', label: 'Hacer administrador', danger: false }),
    unadmin: (u) => ({ title: `¿Quitar el rol de administrador a ${u.out_display}?`, body: 'Sigue pudiendo editar, pero ya no administra usuarios.', label: 'Quitar rol', danger: true }),
  }

  return (
    <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 pt-10 ${ov}`} onClick={close}>
      <div className={`glass border rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl ${card}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <ShieldCheck size={18} className="text-gold" />
          <h2 className="font-extrabold text-base flex-1">Usuarios y permisos</h2>
          <button onClick={close} className="p-1 text-muted hover:text-ink" aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">
          {error && <div className="rounded-xl border border-loss/50 bg-loss/10 p-2.5 text-sm text-loss">{error}</div>}
          {!users && !error && <div className="flex items-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Cargando…</div>}

          {temp && (
            <div className="rounded-xl border border-gold/60 bg-gold/10 p-3 space-y-2">
              <div className="font-bold">Clave temporal de {temp.user.out_display}</div>
              <div className="flex items-center gap-2">
                <code className="num text-xl font-extrabold tracking-widest bg-surface border border-line rounded-lg px-3 py-1.5">{temp.pass}</code>
                <button onClick={copy} className="btn !py-1.5"><Copy size={14} /> {copied ? 'Copiada' : 'Copiar'}</button>
                <button onClick={() => setTemp(null)} className="btn !py-1.5 ml-auto">Listo</button>
              </div>
              <p className="text-xs text-muted">Pasásela por un mensaje privado. <b>Se muestra una sola vez.</b> Al entrar con esta clave, tendrá que elegir una contraseña propia.</p>
            </div>
          )}

          {users && (
            <>
              <section className="space-y-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Cuentas nuevas esperando aprobación ({newAccounts.length})</h3>
                {newAccounts.length === 0 && <p className="text-sm text-muted">No hay cuentas nuevas esperando.</p>}
                {newAccounts.map((u) => (
                  <div key={u.out_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 soft-pulse">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-bold truncate">{u.out_display} <span className="text-muted font-normal text-xs">@{u.out_username}</span></div>
                      <div className="text-xs text-muted">Pidió: {u.out_wants ? 'ver y editar' : 'solo ver'}</div>
                    </div>
                    <button disabled={busy === u.out_id} onClick={() => setRole(u, 'read')} className="btn !px-3 !py-1.5">Aprobar como lector</button>
                    <button disabled={busy === u.out_id} onClick={() => setRole(u, 'edit')} className="btn-primary !px-3 !py-1.5"><Check size={14} /> Aprobar como editor</button>
                    <button disabled={busy === u.out_id} onClick={() => setConfirm({ kind: 'delete', user: u })} className="btn !px-3 !py-1.5 !text-loss">Rechazar</button>
                  </div>
                ))}
              </section>

              {editRequests.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Piden permiso para editar ({editRequests.length})</h3>
                  {editRequests.map((u) => (
                    <div key={u.out_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan/50 bg-cyan/10 px-3 py-2">
                      <div className="flex-1 min-w-[160px] font-bold truncate">{u.out_display} <span className="text-muted font-normal text-xs">@{u.out_username}</span></div>
                      <button disabled={busy === u.out_id} onClick={() => setRole(u, 'edit')} className="btn-primary !px-3 !py-1.5"><Check size={14} /> Aprobar edición</button>
                      <button disabled={busy === u.out_id} onClick={() => setRole(u, 'read')} className="btn !px-3 !py-1.5">Dejar solo lectura</button>
                    </div>
                  ))}
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Todos los usuarios ({users.length})</h3>
                <div className="rounded-xl border border-line divide-y divide-line">
                  {users.map((u) => {
                    const mine = u.out_username === me
                    return (
                      <div key={u.out_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-[150px]">
                          <div className="font-bold truncate">{u.out_display} <span className="text-muted font-normal text-xs">@{u.out_username}</span>{mine && <span className="text-cyan text-xs font-semibold"> · vos</span>}</div>
                          {u.out_must_change && <div className="text-[11px] text-gold">Tiene una clave temporal: todavía no eligió una nueva</div>}
                        </div>
                        {u.out_admin && <span className="pill pill-gold">ADMIN</span>}
                        {mine ? (
                          <span className={`pill ${ROLE_PILL[u.out_role]}`}>{ROLE[u.out_role]}</span>
                        ) : (
                          <>
                            <select value={u.out_role} disabled={busy === u.out_id} onChange={(e) => setRole(u, e.target.value)} className="field !w-auto !py-1 !text-sm" aria-label="Permiso">
                              {Object.entries(ROLE).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                            <button title="Restablecer contraseña" aria-label="Restablecer contraseña" disabled={busy === u.out_id} onClick={() => setConfirm({ kind: 'reset', user: u })} className="btn !px-2 !py-1.5"><KeyRound size={15} /></button>
                            {u.out_admin
                              ? <button title="Quitar administrador" aria-label="Quitar administrador" disabled={busy === u.out_id} onClick={() => setConfirm({ kind: 'unadmin', user: u })} className="btn !px-2 !py-1.5"><ShieldOff size={15} /></button>
                              : <button title="Hacer administrador" aria-label="Hacer administrador" disabled={busy === u.out_id || u.out_role === 'blocked'} onClick={() => setConfirm({ kind: 'admin', user: u })} className="btn !px-2 !py-1.5"><ShieldPlus size={15} /></button>}
                            <button title="Eliminar usuario" aria-label="Eliminar usuario" disabled={busy === u.out_id} onClick={() => setConfirm({ kind: 'delete', user: u })} className="btn !px-2 !py-1.5 !text-loss"><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <p className="text-xs text-muted">Toda cuenta nueva necesita la aprobación de un administrador, incluso para ver la planilla.</p>
            </>
          )}
        </div>
      </div>

      {confirm && (() => {
        const t = texts[confirm.kind](confirm.user)
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 modal-ov" onClick={(e) => { e.stopPropagation(); setConfirm(null) }}>
            <div className="bento w-full max-w-sm p-5 space-y-3 shadow-2xl modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">{t.title}</h3>
              <p className="text-muted text-sm">{t.body}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirm(null)} className="btn">Cancelar</button>
                <button onClick={doConfirmed} className={`inline-flex items-center px-4 py-1.5 rounded-xl text-white font-bold text-sm ${t.danger ? 'bg-loss' : 'bg-cta'}`}>{t.label}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
