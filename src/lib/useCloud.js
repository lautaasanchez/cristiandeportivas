import { useEffect, useRef, useState } from 'react'
import { cloudConfigured, makeBackend, roomKey } from './cloud'
import { createSync } from './sync'

const CODE_KEY = 'apuestas-cloud-code'
const OFF_KEY = 'apuestas-cloud-off'
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }

// status: 'local' | 'syncing' | 'ok' | 'error'
export function useCloud(state, applyRemote) {
  const [code, setCode] = useState(() => read(CODE_KEY))
  const [off, setOff] = useState(() => read(OFF_KEY) === '1')
  const [status, setStatus] = useState('local')
  const latest = useRef(state)
  const apply = useRef(applyRemote)
  const syncRef = useRef(null)
  latest.current = state
  apply.current = applyRemote

  useEffect(() => {
    if (!cloudConfigured || !code) { setStatus('local'); return }
    let dead = false
    let sync, unsub, poll
    const kick = () => sync?.run()
    ;(async () => {
      try {
        const backend = await makeBackend(await roomKey(code))
        if (dead) return
        sync = createSync({
          backend,
          getLocal: () => latest.current,
          onRemote: (s) => apply.current(s),
          onStatus: (s) => { if (!dead) setStatus(s) },
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
  }, [code])

  // Cada cambio local se sube a los ~0,7 s
  useEffect(() => {
    const s = syncRef.current
    if (s && s.hasChanges(state)) s.schedule()
  }, [state])

  return {
    enabled: cloudConfigured,
    code, status,
    needsCode: cloudConfigured && !code && !off,
    connect: (c) => { const v = c.trim(); if (!v) return; write(CODE_KEY, v); write(OFF_KEY, null); setOff(false); setCode(v) },
    disconnect: () => { write(CODE_KEY, null); setCode(null); setStatus('local') },
    useLocalOnly: () => { write(OFF_KEY, '1'); setOff(true) },
    askCode: () => { write(OFF_KEY, null); setOff(false) },
  }
}
