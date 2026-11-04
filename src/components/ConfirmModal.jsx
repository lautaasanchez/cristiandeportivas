import { useExit } from '../lib/useExit'

export default function ConfirmModal({ title, text, confirmLabel, danger = true, onConfirm, onCancel }) {
  const { close, ov, card } = useExit(onCancel)
  return (
    <div className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 ${ov}`} onClick={close}>
      <div className={`glass border rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl ${card}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-muted text-base">{text}</p>
        <div className="flex gap-2 pt-1 justify-end">
          <button onClick={close} className="btn">Cancelar</button>
          <button onClick={onConfirm} className={`inline-flex items-center px-4 py-1.5 rounded-xl text-white font-bold text-sm active:scale-95 transition-all duration-200 hover:brightness-110 ${danger ? 'bg-loss' : 'bg-cta'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
