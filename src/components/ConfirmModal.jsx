export default function ConfirmModal({ title, text, confirmLabel, danger = true, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onCancel}>
      <div className="bg-surface border border-line rounded-lg w-full max-w-md p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-muted text-base">{text}</p>
        <div className="flex gap-2 pt-1 justify-end">
          <button onClick={onCancel} className="btn">Cancelar</button>
          <button onClick={onConfirm} className={`inline-flex items-center px-4 py-1.5 rounded-md text-white font-bold text-sm ${danger ? 'bg-loss' : 'bg-cta'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
