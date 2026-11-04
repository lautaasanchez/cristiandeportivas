import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, Search, X } from 'lucide-react'
import { betTeams, fmtFull, isCombo, money, selections, teamMatches } from '../lib/logic'
import { marketLabel } from '../lib/sports'
import { googleUrl, openResults } from '../lib/web'
import StatusPill from './StatusPill'

// Muestra los equipos de una jugada resaltando el que coincide con la búsqueda
function Legs({ bet, query }) {
  const legs = selections(bet)
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {isCombo(bet) && <span className="pill pill-cyan">COMBINADA</span>}
      {legs.map((l, i) => {
        const hit = teamMatches(query, l.evento)
        return (
          <span key={i} className={hit ? 'font-extrabold text-gold' : 'text-muted'}>
            {l.evento}
            {!isCombo(bet) && l.tipo ? <span className="font-normal text-muted"> · {marketLabel(l.tipo)}</span> : null}
            {isCombo(bet) && <span className="num font-normal text-muted text-[11px]"> @{Number(l.linea).toFixed(2)}</span>}
            {i < legs.length - 1 && <span className="text-muted"> +</span>}
          </span>
        )
      })}
    </div>
  )
}

// Lupa verificadora siempre visible arriba de los clientes: busca un equipo en TODAS las jugadas
// (simples y cada selección de las combinadas), de todos los clientes y semanas.
export default function SearchBar({ weeks, query, onQuery, canEdit, onGo, onEstado }) {
  const [open, setOpen] = useState(false)
  const [onlyPending, setOnlyPending] = useState(false)
  const box = useRef()

  useEffect(() => { if (query.trim()) setOpen(true) }, [query])
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const out = []
    weeks.forEach((w) =>
      w.clients.forEach((client) =>
        (w.bets[client] || []).forEach((bet) => {
          if (betTeams(bet).some((t) => teamMatches(query, t)) && (!onlyPending || bet.estado === 'PENDIENTE'))
            out.push({ week: w, client, bet })
        })))
    return out.sort((a, b) => b.bet.fecha.localeCompare(a.bet.fecha))
  }, [weeks, query, onlyPending])

  const firstHit = results[0] && betTeams(results[0].bet).find((t) => teamMatches(query, t))
  const showPanel = open && query.trim()

  return (
    <div ref={box} className="flex-1 min-w-0">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { onQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') { onQuery(''); setOpen(false); e.currentTarget.blur() } }}
          placeholder="Buscar equipo o jugador en todas las jugadas…"
          className="field bento !pl-10 !pr-10 !py-3 !rounded-2xl !border-line/80"
        />
        {query && (
          <button onClick={() => { onQuery(''); setOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label="Borrar búsqueda">
            <X size={18} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 glass border rounded-2xl shadow-2xl max-h-[62vh] flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-line text-xs">
            <span className="font-semibold text-muted">
              {results.length} jugada{results.length === 1 ? '' : 's'} con “{query.trim()}” (simples y combinadas, todos los clientes y semanas)
            </span>
            <label className="ml-auto flex items-center gap-1.5 font-semibold cursor-pointer">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Solo pendientes
            </label>
            {firstHit && (
              <button onClick={() => openResults(googleUrl(firstHit))} className="btn !py-1 text-xs"><ExternalLink size={13} /> Resultado en Google</button>
            )}
          </div>

          <div className="overflow-auto">
            {results.length === 0 && <p className="p-6 text-center text-muted">No hay jugadas con ese equipo.</p>}
            {results.length > 0 && (
              <>
              <div className="md:hidden divide-y divide-line">
                {results.map(({ week, client, bet }) => (
                  <div key={week.id + client + bet.id} className="p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-extrabold">{client}</span>
                      <span className="text-muted">{week.label}</span>
                      <span className="num text-muted ml-auto">{fmtFull(bet.fecha)}</span>
                    </div>
                    <Legs bet={bet} query={query} />
                    <div className="flex items-center gap-2">
                      <span className="num text-xs font-bold">{money(bet.monto, bet.moneda || 'ARS')}</span>
                      <span className="ml-auto" />
                      <StatusPill disabled={!canEdit} value={bet.estado} onChange={(estado) => onEstado(week.id, client, bet.id, estado)} />
                      <button onClick={() => { onGo(week.id, client); setOpen(false) }} className="btn !px-2 !py-1" aria-label="Ir a esta jugada"><ArrowRight size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <table className="hidden md:table w-full text-left border-collapse">
                <thead className="sticky top-0 bg-strong text-onstrong text-[11px] uppercase">
                  <tr>{['Semana', 'Cliente', 'Fecha', 'Jugada', 'Cuota', 'Estado', ''].map((h, i) => <th key={i} className="border border-line px-2 py-1.5 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {results.map(({ week, client, bet }, n) => (
                    <tr key={week.id + client + bet.id} className={n % 2 ? 'bg-zebra/80' : 'bg-surface/60'}>
                      <td className="border border-line px-2 py-1.5 text-xs text-muted whitespace-nowrap">{week.label}</td>
                      <td className="border border-line px-2 py-1.5 font-bold whitespace-nowrap">{client}</td>
                      <td className="border border-line px-2 py-1.5 num text-xs whitespace-nowrap">{fmtFull(bet.fecha)}</td>
                      <td className="border border-line px-2 py-1.5"><Legs bet={bet} query={query} /></td>
                      <td className="border border-line px-2 py-1.5 num text-xs text-right whitespace-nowrap">{money(bet.monto, bet.moneda || 'ARS')}</td>
                      <td className="border border-line px-2 py-1.5">
                        <StatusPill disabled={!canEdit} value={bet.estado} onChange={(estado) => onEstado(week.id, client, bet.id, estado)} />
                      </td>
                      <td className="border border-line px-1 py-1.5 whitespace-nowrap text-center">
                        <button onClick={() => { onGo(week.id, client); setOpen(false) }} className="btn !px-2 !py-1 text-xs" title="Ir a esta jugada"><ArrowRight size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
