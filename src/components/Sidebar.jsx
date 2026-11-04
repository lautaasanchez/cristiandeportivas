import { CalendarDays, Cloud, FileSpreadsheet, History, LogOut, TriangleAlert, X } from 'lucide-react'
import { CURRENCIES, addDays, fmtFull, money, weekSummary } from '../lib/logic'
import { MAX_HISTORY } from '../lib/useStore'

function WeekItem({ title, subtitle, active, week, onOpen, onExport }) {
  const sum = weekSummary(week)
  const used = CURRENCIES.filter((c) => sum[c].count)
  return (
    <div className={`rounded-2xl border ${active ? 'border-gold bg-gold/10' : 'border-line bg-surface/60'}`}>
      <button onClick={onOpen} className="w-full text-left px-3 pt-2 pb-1.5">
        <div className="font-bold">{title}</div>
        <div className="text-[11px] text-muted">{subtitle}</div>
        <div className="mt-1 space-y-0.5">
          {used.map((c) => (
            <div key={c} className="flex justify-between text-xs">
              <span className="text-muted">{c} · balance final</span>
              <span className={`num font-bold ${sum[c].balance >= 0 ? 'text-win' : 'text-loss'}`}>{money(sum[c].balance, c)}</span>
            </div>
          ))}
          {!used.length && <div className="text-xs text-muted">Sin jugadas</div>}
        </div>
      </button>
      <div className="px-3 pb-2">
        <button onClick={onExport} className="btn !py-1 text-xs w-full justify-center"><FileSpreadsheet size={14} /> Exportar Excel</button>
      </div>
    </div>
  )
}

export default function Sidebar({ open, onClose, view, onView, current, history, notice, onDismissNotice, onExport }) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <aside
        className={`glass fixed left-0 top-0 bottom-0 z-50 w-80 max-w-[88%] border-r shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="title-grad font-extrabold text-lg">Menú</h2>
          <button onClick={onClose} aria-label="Cerrar menú" className="p-1 text-muted hover:text-ink"><X size={20} /></button>
        </div>
        <div className="p-3 space-y-5 overflow-y-auto">
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted"><CalendarDays size={14} /> Semana actual</h3>
            <WeekItem
              title={`Semana del ${fmtFull(current.weekStart)}`}
              subtitle={`al ${fmtFull(addDays(current.weekStart, 6))} · en curso`}
              active={view === 'current'} week={current}
              onOpen={() => { onView('current'); onClose() }}
              onExport={() => onExport(current)}
            />
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted"><History size={14} /> Últimas semanas</h3>
            <div className="flex gap-2 rounded-xl border border-loss/40 bg-loss/10 px-2.5 py-2 text-[11px] text-loss">
              <TriangleAlert size={14} className="shrink-0 mt-px" />
              <span>Solo se conservan las últimas {MAX_HISTORY} semanas. Al cerrar una semana nueva, la más antigua se elimina automáticamente.</span>
            </div>
            {notice && (
              <div className="flex gap-2 rounded-xl border border-loss bg-loss/15 px-2.5 py-2 text-[11px] text-loss">
                <span className="flex-1 font-semibold">{notice.text}</span>
                <button onClick={onDismissNotice} aria-label="Descartar aviso"><X size={14} /></button>
              </div>
            )}
            {history.length === 0 && <p className="text-muted text-xs">Todavía no hay semanas cerradas.</p>}
            {history.map((w) => (
              <WeekItem
                key={w.id}
                title={`Semana del ${fmtFull(w.weekStart)}`}
                subtitle={`cerrada por ${w.closedBy || '—'} el ${new Date(w.closedAt).toLocaleDateString('es-AR')} · editable`}
                active={view === w.id} week={w}
                onOpen={() => { onView(w.id); onClose() }}
                onExport={() => onExport(w)}
              />
            ))}
          </section>
        </div>
      </aside>
    </>
  )
}
