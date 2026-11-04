import { useCallback, useEffect, useRef, useState } from 'react'

// Cierre con animación: close() marca la ventana como "cerrándose" y recién después llama a onClose (que la desmonta).
export function useExit(onClose, ms = 160) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const close = useCallback(() => {
    if (timer.current) return
    if (reduced) return onClose()
    setClosing(true)
    timer.current = setTimeout(onClose, ms)
  }, [onClose, ms, reduced])

  useEffect(() => () => clearTimeout(timer.current), [])
  return { closing, close, ov: `modal-ov ${closing ? 'is-closing' : ''}`, card: `modal-card ${closing ? 'is-closing' : ''}` }
}
