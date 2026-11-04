import { STATES } from '../lib/logic'

// Perspectiva de la banca: GANADA (el cliente cobra) = carmesí · PERDIDA (la banca gana) = verde
const style = {
  PENDIENTE: 'bg-pend/15 text-pend border-pend',
  GANADA: 'bg-loss/15 text-loss border-loss',
  PERDIDA: 'bg-win/15 text-win border-win',
}

export default function StatusPill({ value, onChange, disabled }) {
  const next = STATES[(STATES.indexOf(value) + 1) % STATES.length]
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(next)}
      title={disabled ? value : `Click para cambiar a ${next}`}
      className={`px-2 py-0.5 rounded-full border font-bold text-[11px] w-[88px] ${style[value]} ${disabled ? 'cursor-default' : 'hover:brightness-110'}`}
    >
      {value}
    </button>
  )
}
