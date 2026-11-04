import { useCallback, useEffect, useRef, useState } from 'react'

// Cantidad de ventanas abiertas: mientras haya alguna, la página de atrás no se desplaza (flechas, rueda ni toque)
let openModals = 0
const lockScroll = (on) => {
  openModals += on ? 1 : -1
  document.body.style.overflow = openModals > 0 ? 'hidden' : ''
}

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

  useEffect(() => {
    lockScroll(true)
    return () => { clearTimeout(timer.current); lockScroll(false) }
  }, [])
  return { closing, close, ov: `modal-ov ${closing ? 'is-closing' : ''}`, card: `modal-card ${closing ? 'is-closing' : ''}` }
}
