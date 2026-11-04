import { Heart } from 'lucide-react'
import { useExit } from '../lib/useExit'

// Cartel de bienvenida: aparece una sola vez (el servidor lo marca como visto al tocar el botón).
// No se cierra tocando afuera ni con Esc, para que se lea completo.
export default function WelcomeNote({ text, onDone }) {
  const { close, ov, card } = useExit(onDone, 220)
  return (
    <div className={`fixed inset-0 z-[80] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 ${ov}`}>
      <div className={`bento bento-gradient w-full max-w-md p-7 text-center space-y-5 shadow-2xl glow-card-loss ${card}`} role="dialog" aria-modal="true" aria-label="Mensaje de bienvenida">
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-loss/15 border border-loss/40 glow-box-loss soft-pulse">
          <Heart size={28} className="text-loss" fill="currentColor" />
        </div>
        <div className="text-xl leading-relaxed whitespace-pre-line text-ink">{text}</div>
        <button onClick={close} className="btn-primary w-full justify-center !py-3 !text-base" autoFocus>Gracias, empezar</button>
      </div>
    </div>
  )
}
