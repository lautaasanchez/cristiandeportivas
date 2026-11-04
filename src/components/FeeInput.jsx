import { useEffect, useState } from 'react'

// Comisión % por cliente (vacío o 0 = desactivada)
export default function FeeInput({ value, onCommit, disabled }) {
  const [v, setV] = useState(value ? String(value) : '')
  useEffect(() => setV(value ? String(value) : ''), [value])
  const commit = () => {
    const n = parseFloat(String(v).replace(',', '.'))
    const next = n > 0 && n <= 100 ? n : 0
    if (next !== (value || 0)) onCommit(next)
    setV(next ? String(next) : '')
  }
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted" title="Porcentaje sobre lo apostado. Dejalo vacío para desactivarla.">
      Comisión del cliente
      <input
        value={v} disabled={disabled} inputMode="decimal" placeholder="off"
        onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-14 bg-surface border border-line rounded-md px-2 py-1 num text-right text-ink focus:outline-none focus:border-cta disabled:opacity-50"
      />
      %
    </label>
  )
}
