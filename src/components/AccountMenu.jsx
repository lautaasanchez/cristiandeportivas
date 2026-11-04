import { useEffect, useRef, useState } from 'react'
import { Eye, KeyRound, LogOut, Pencil, ShieldCheck, UserRound } from 'lucide-react'
import { rpc } from '../lib/cloud'
import UsersPanel, { pendingCount } from './UsersPanel'
import ChangePasswordModal from './ChangePassword'

// Cuenta de la persona conectada: nombre, permiso, cerrar sesión y (Cris/Vale) administración de usuarios
export default function AccountMenu({ auth }) {
  const { user } = auth
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState(false)
  const [changePass, setChangePass] = useState(false)
  const [pending, setPending] = useState(0)
  const box = useRef()
  const admin = user.isAdmin && user.role === 'edit'
  const canEdit = user.role === 'edit'

  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  // Los administradores ven cuántas solicitudes hay esperando
  useEffect(() => {
    if (!admin) return
    let dead = false
    const count = async () => {
      try {
        const list = await rpc('admin_list', { p_token: auth.token })
        if (!dead) setPending(pendingCount(list))
      } catch {}
    }
    count()
    const id = setInterval(count, 30000)
    return () => { dead = true; clearInterval(id) }
  }, [admin, auth.token])

  return (
    <div ref={box} className="relative">
      <button className="btn justify-center !py-1 w-full relative" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        {canEdit ? <UserRound size={16} /> : <Eye size={16} />} {user.displayName}
        {admin && pending > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-loss text-[10px] font-extrabold text-white flex items-center justify-center px-1 soft-pulse shadow-[0_0_12px_rgb(var(--loss)/0.7)]">{pending}</span>}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-64 glass border rounded-2xl shadow-2xl p-2 space-y-1 pop-in">
          <div className="px-2.5 py-2">
            <div className="font-extrabold truncate">{user.displayName} <span className="text-muted font-normal text-xs">@{user.username}</span></div>
            <div className="flex items-center gap-1.5 text-xs mt-0.5">
              {canEdit ? <><Pencil size={12} className="text-win" /> Puede editar{user.isAdmin ? ' · administrador' : ''}</> : <><Eye size={12} className="text-cyan" /> Solo lectura</>}
            </div>
            {!canEdit && user.wantsEdit && <div className="text-[11px] text-gold mt-1">Pediste permiso para editar: esperando que Cris o Vale lo aprueben.</div>}
          </div>
          {admin && (
            <button onClick={() => { setOpen(false); setPanel(true) }} className="btn w-full justify-start !py-2">
              <ShieldCheck size={16} className="text-gold" /> Usuarios y permisos
              {pending > 0 && <span className="ml-auto rounded-full bg-loss text-white text-[10px] font-extrabold px-1.5 py-0.5">{pending}</span>}
            </button>
          )}
          <button onClick={() => { setOpen(false); setChangePass(true) }} className="btn w-full justify-start !py-2"><KeyRound size={16} /> Cambiar contraseña</button>
          <button onClick={auth.logout} className="btn w-full justify-start !py-2"><LogOut size={16} /> Cerrar sesión</button>
        </div>
      )}

      {panel && <UsersPanel token={auth.token} me={user.username} onClose={() => setPanel(false)} onChanged={setPending} />}
      {changePass && <ChangePasswordModal auth={auth} onClose={() => setChangePass(false)} />}
    </div>
  )
}
