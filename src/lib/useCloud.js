import { useEffect, useRef, useState } from 'react'
import { cloudConfigured, makeBackend } from './cloud'
import { createSync } from './sync'

const isEmptyState = (s) => !Object.values(s?.bets || {}).some((l) => l.length) && !(s?.history || []).length

// Sincroniza la planilla con la nube mientras haya una sesión con permiso de lectura o edición.
// status: 'local' | 'syncing' | 'ok' | 'error'
export function useCloud(state, applyRemote, auth) {
  const [status, setStatus] = useState('local')
  const latest = useRef(state)
  const apply = useRef(applyRemote)
  const syncRef = useRef(null)
  latest.current = state
  apply.current = applyRemote

  const token = auth.token
  const role = auth.user?.role
  const active = cloudConfigured && !!token && !auth.user?.mustChange && (role === 'read' || role === 'edit')
  const readOnly = role !== 'edit'

  useEffect(() => {
    if (!active) { setStatus('local'); return }
    let dead = false
    let sync, unsub, poll
    const kick = () => sync?.run()
    ;(async () => {
      try {
        const backend = await makeBackend(token)
        if (dead) return
        sync = createSync({
          backend, readOnly, isEmpty: isEmptyState,
          getLocal: () => latest.current,
          onRemote: (s) => apply.current(s),
          onStatus: (s, e) => {
            if (dead) return
            if (e?.auth) { auth.expire(); return }
            setStatus(s)
          },
          backupLocal: (l) => { try { localStorage.setItem('apuestas-backup-antes-de-la-nube', JSON.stringify(l)) } catch {} },
        })
        syncRef.current = sync
        unsub = backend.subscribe(kick)
        poll = setInterval(kick, 12000)
        window.addEventListener('online', kick)
        kick()
      } catch { if (!dead) setStatus('error') }
    })()
    return () => {
      dead = true
      syncRef.current = null
      sync?.close(); unsub?.(); clearInterval(poll)
      window.removeEventListener('online', kick)
    }
  }, [active, token, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cada cambio local se sube a los ~0,7 s
  useEffect(() => {
    const s = syncRef.current
    if (s && !readOnly && s.hasChanges(state)) s.schedule()
  }, [state, readOnly])

  return { enabled: cloudConfigured, status }
}
