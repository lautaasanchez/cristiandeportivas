import { Pencil, Search, X } from 'lucide-react'
import { fmtFull, money, selections } from '../lib/logic'
import { marketLabel } from '../lib/sports'
import { googleUrl, openResults } from '../lib/web'
import StatusPill from './StatusPill'
import { useExit } from '../lib/useExit'

// Detalle de una combinada: todas las selecciones, con búsqueda de cada equipo
export default function ComboDetail({ bet, canEdit, onClose, onEditBet, onSearch, onEstado }) {
  const { close, ov, card } = useExit(onClose)
  const legs = selections(bet)
  const cur = bet.moneda || 'ARS'
  return (
    <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 ${ov}`} onClick={close}>
      <div className={`glass border rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl ${card}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <span className="pill pill-cyan">COMBINADA</span>
              {legs.length} selecciones
            </h2>
            <p className="text-muted text-sm">{fmtFull(bet.fecha)} · <span className="num">{money(bet.monto, cur)}</span> · línea <span className="num">{bet.linea.toFixed(2)}</span></p>
          </div>
          <button onClick={close} className="p-1 text-muted hover:text-ink" aria-label="Cerrar"><X size={20} /></button>
        </div>

        <ol className="space-y-1.5">
          {legs.map((l, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <span className="text-xs font-extrabold text-gold w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{l.evento}</div>
                <div className="text-xs text-muted">{marketLabel(l.tipo) || 'Sin tipo de jugada'}</div>
              </div>
              <span className="num font-bold">{Number(l.linea).toFixed(2)}</span>
              <button
                onClick={() => { openResults(googleUrl(l.evento, bet.fecha)); onSearch(l.evento) }}
                className="btn !px-2 !py-1 text-xs" title="Buscar este equipo en Google y en todas las jugadas"
              ><Search size={14} /></button>
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2 pt-1">
          <StatusPill disabled={!canEdit} value={bet.estado} onChange={onEstado} />
          <span className="ml-auto" />
          {canEdit && <button onClick={onEditBet} className="btn"><Pencil size={14} /> Editar</button>}
          <button onClick={close} className="btn">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
