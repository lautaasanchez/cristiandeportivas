import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, FileSpreadsheet, FileJson, FileText, Upload, Archive, Filter, Menu, Moon, Sun, UserRound, Eye, TriangleAlert, X, ArrowLeft, Search, Cloud, CloudOff, RefreshCw,
} from 'lucide-react'
import { BANCA, addDays, buildFreq, canonicalTeam, fmtFull, suggestFrom, suggestMany, totalsByCur } from './lib/logic'
import { MAX_HISTORY, useStore } from './lib/useStore'
import { useCloud } from './lib/useCloud'
import { useAuth } from './lib/useAuth'
import { exportCSV, exportJSON, exportXLSX } from './lib/export'
import ClientSelect from './components/ClientSelect'
import SummaryCards from './components/SummaryCards'
import BetTable from './components/BetTable'
import BetModal from './components/BetModal'
import ConfirmModal from './components/ConfirmModal'
import UserGate from './components/UserGate'
import Sidebar from './components/Sidebar'
import AuthGate, { WaitingScreen } from './components/AuthGate'
import AccountMenu from './components/AccountMenu'
import { ForcePasswordScreen } from './components/ChangePassword'
import WelcomeNote from './components/WelcomeNote'
import FeeInput from './components/FeeInput'
import SearchBar from './components/SearchBar'
import ComboDetail from './components/ComboDetail'
import { googleUrl, openResults } from './lib/web'

// Estado de la sincronización con la nube
function CloudPill({ cloud }) {
  const look = {
    local: ['pill-mute', cloud.enabled ? 'Solo este equipo' : 'Sin nube · solo este equipo', CloudOff],
    syncing: ['pill-cyan', 'Sincronizando…', RefreshCw],
    ok: ['pill-win', 'Sincronizado', Cloud],
    error: ['pill-gold', 'Sin conexión · reintentando', CloudOff],
  }[cloud.status]
  const [cls, text, Icon] = look
  return (
    <span className={`pill ${cls} normal-case !tracking-normal !text-[11px] gap-1 ${cloud.status === 'syncing' ? 'soft-pulse' : ''}`} title={cloud.enabled ? 'Los cambios se comparten en tiempo real' : 'La nube no está configurada: los datos quedan solo en este navegador'}>
      <Icon size={12} className={cloud.status === 'syncing' ? 'animate-spin' : ''} /> {text}
    </span>
  )
}

const jugadas = (n) => (n === 1 ? '1 jugada' : `${n} jugadas`)
const safe = (fn, fallback) => { try { return fn() } catch { return fallback } }

export default function App() {
  const auth = useAuth()
  // Con la nube, quien manda es la persona que inició sesión; sin nube se usa el selector local (Cris / Vale)
  const s = useStore(auth.enabled ? auth.storeUser : undefined)
  const cloud = useCloud(s.state, s.applyRemote, auth)
  const { users, history, notice } = s.state
  const { week } = s
  const { clients, bets: allBets, weekStart, fees } = week
  const canEdit = s.user?.perm === 'edit'
  const isCurrent = s.view === 'current'

  const [client, setClient] = useState(clients[0])
  const [modal, setModal] = useState(null) // { date }
  const [confirm, setConfirm] = useState(null) // { type: 'week' } | { type: 'bet', id } | { type: 'client', name }
  const [onlyPending, setOnlyPending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [comboId, setComboId] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [menu, setMenu] = useState(false)
  const [dark, setDark] = useState(() => safe(() => localStorage.getItem('apuestas-theme') !== 'light', true))
  const file = useRef()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    safe(() => localStorage.setItem('apuestas-theme', dark ? 'dark' : 'light'))
  }, [dark])

  const active = clients.includes(client) ? client : clients[0]
  const bets = allBets[active] || []
  const shown = useMemo(() => (onlyPending ? bets.filter((b) => b.estado === 'PENDIENTE') : bets), [bets, onlyPending])
  const byCur = totalsByCur(bets)
  const pendingCount = bets.filter((b) => b.estado === 'PENDIENTE').length
  const pct = fees?.[active] || 0

  // Memoria de nombres de eventos (semana actual + semanas cerradas)
  const freq = useMemo(() => buildFreq([{ bets: s.state.bets }, ...history], s.state.teams), [s.state.bets, s.state.teams, history])
  const suggest = (typed) => suggestFrom(freq, typed)
  const suggestAll = (typed) => suggestMany(freq, typed, 3)
  const canon = (typed) => canonicalTeam(freq, typed)

  // Todas las semanas (actual + cerradas) para la búsqueda por equipo
  const weeks = useMemo(
    () => [
      { id: 'current', label: `Actual · ${fmtFull(s.state.weekStart)}`, clients: s.state.clients, bets: s.state.bets },
      ...history.map((w) => ({ id: w.id, label: `Semana del ${fmtFull(w.weekStart)}`, clients: w.clients, bets: w.bets })),
    ],
    [s.state, history]
  )
  // Lupa de una jugada simple: abre Google (misma ventana de siempre) y lista todas las jugadas de ese equipo
  const searchTeam = (team, bet) => {
    if (bet) openResults(googleUrl(team, bet.fecha))
    setSearchQuery(team)
  }
  const comboBet = comboId && bets.find((b) => b.id === comboId)

  const restore = (e) => {
    const f = e.target.files[0]
    if (!f) return
    f.text().then((txt) => {
      try {
        const d = JSON.parse(txt)
        if (!d.clients || !d.bets) throw new Error()
        s.replaceAll(d)
        setClient(d.clients[0])
      } catch {
        alert('El archivo no es un respaldo válido.')
      }
    })
    e.target.value = ''
  }

  if (auth.enabled) {
    if (auth.loading) return <div className="fixed inset-0 bg-bg flex items-center justify-center text-muted">Cargando…</div>
    if (!auth.user) return <AuthGate auth={auth} />
    if (auth.user.mustChange) return <ForcePasswordScreen auth={auth} />
    if (auth.user.role !== 'read' && auth.user.role !== 'edit') return <WaitingScreen auth={auth} />
  }

  if (!auth.enabled && (!s.user || switching))
    return (
      <UserGate
        users={users}
        onAdd={s.addUser}
        onPick={(id) => { s.setUserId(id); setSwitching(false) }}
        onClose={s.user ? () => setSwitching(false) : undefined}
      />
    )

  const allCurrentBets = s.state.bets // jugadas de la semana actual (para saber si hay algo que no perder al restaurar)
  const oldest = history.length >= MAX_HISTORY ? history[history.length - 1] : null

  return (
    <div>
      {auth.enabled && auth.user?.welcome && <WelcomeNote text={auth.user.welcome} onDone={auth.ackWelcome} />}
      <Sidebar
        open={menu} onClose={() => setMenu(false)}
        view={s.view} onView={(v) => { s.setView(v); setOnlyPending(false) }}
        current={{ weekStart: s.state.weekStart, clients: s.state.clients, bets: s.state.bets, fees: s.state.fees }}
        history={history} notice={notice} onDismissNotice={s.dismissNotice} onExport={exportXLSX}
        canEdit={canEdit} onRestore={(w) => setConfirm({ type: 'restore', week: w })} onDeleteWeek={(w) => setConfirm({ type: 'delweek', week: w })}
      />

      <div data-sticky-header className="wide:sticky wide:top-0 z-30 bg-bg/80 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
            <button className="btn !px-2" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={20} /></button>
            <h1 className="text-base sm:text-xl font-extrabold leading-tight">
              Cristian Deportivas<span className="hidden sm:inline"> — </span><br className="sm:hidden" />
              <span className="title-grad">Semana del Lunes {fmtFull(weekStart)}</span>
            </h1>
            {!isCurrent && (
              <button
                onClick={() => s.setView('current')} title="Volver a la semana actual"
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-gold/60 text-gold bg-gold/10 hover:bg-gold/20 transition whitespace-nowrap"
              ><ArrowLeft size={12} /> Semana cerrada · volver a la actual</button>
            )}
            <CloudPill cloud={cloud} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-row sm:flex-col items-stretch gap-1 shrink-0">
              <button className="btn justify-center !py-1" onClick={() => setDark((d) => !d)} title="Modo día / noche" aria-label="Cambiar tema">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {auth.enabled ? (
                <AccountMenu auth={auth} />
              ) : (
                <button className="btn justify-center !py-1" onClick={() => setSwitching(true)} title="Cambiar de usuario">
                  {canEdit ? <UserRound size={16} /> : <Eye size={16} />} {s.user.name}
                  {!canEdit && <span className="text-muted font-normal text-xs">(solo lectura)</span>}
                </button>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 rounded-lg border border-loss/50 bg-loss/10 px-3 py-1.5 text-xs text-loss">
            <TriangleAlert size={14} className="shrink-0" />
            <span className="flex-1 font-semibold">{notice.text}</span>
            <button onClick={s.dismissNotice} aria-label="Descartar aviso"><X size={14} /></button>
          </div>
        )}
        <div className="relative flex flex-col sm:flex-row gap-2">
          <ClientSelect
            clients={clients} active={active} canManage={canEdit && isCurrent}
            onChange={setClient}
            onAdd={s.addClient} onRename={s.renameClient}
            onDelete={(name) => setConfirm({ type: 'client', name })}
          />
          <SearchBar
            weeks={weeks} query={searchQuery} onQuery={setSearchQuery} canEdit={canEdit}
            onEstado={(target, c, id, estado) => s.editAt(target, c, id, { estado })}
            onGo={(target, c) => { s.setView(target); setClient(c); setOnlyPending(false) }}
          />
        </div>
        <SummaryCards byCur={byCur} pct={pct} />

        <div className="bento flex flex-wrap items-center gap-3 px-3 py-2">
          <button
            onClick={() => setOnlyPending((v) => !v)}
            className={`btn !py-1 text-xs ${onlyPending ? '!border-pend !text-pend' : ''}`}
          >
            <Filter size={14} /> Verificar pendientes ({pendingCount})
          </button>
          <FeeInput value={pct} disabled={!canEdit} onCommit={(n) => s.setFee(active, n)} />
          <span className="hidden xl:inline text-[11px] text-muted" title="Atajos del teclado">⌨ ↑ ↓ moverte · Enter editar · Esc soltar</span>
          <span className="ml-auto hidden lg:flex items-center gap-3 text-[11px] font-semibold text-muted">
            <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-win" /> Ganancia de {BANCA} (el cliente pierde)</span>
            <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-loss" /> Pago de {BANCA} (el cliente gana)</span>
          </span>
        </div>
      </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-3 pb-10">
      <BetTable
        bets={shown} weekStart={weekStart} pct={pct} canEdit={canEdit} suggest={suggest}
        enabled={!modal && !comboId && !confirm && !menu && !searchQuery}
        onEdit={(id, patch) => s.edit(active, id, patch)}
        onOpenEdit={(bet) => setModal({ bet })}
        onSearchTeam={searchTeam}
        onShowCombo={(bet) => setComboId(bet.id)}
        onDelete={(id) => setConfirm({ type: 'bet', id })}
        onAdd={(date) => setModal({ date })}
      />

      <footer className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-line">
        <button className="btn" onClick={() => exportXLSX(week)}><FileSpreadsheet size={16} /> Exportar Excel (.xlsx)</button>
        <button className="btn" onClick={() => exportCSV(week)}><FileText size={16} /> CSV</button>
        <button className="btn" onClick={() => exportJSON(s.state)}><FileJson size={16} /> Respaldo JSON</button>
        <button className="btn" disabled={!canEdit} onClick={() => file.current.click()}><Upload size={16} /> Restaurar respaldo</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={restore} />
        <button className="btn ml-auto !text-loss hover:!border-loss" disabled={!canEdit || !isCurrent} onClick={() => setConfirm({ type: 'week' })}>
          <Archive size={16} /> Semana nueva
        </button>
      </footer>
      </div>

      {comboBet && (
        <ComboDetail
          bet={comboBet} canEdit={canEdit}
          onClose={() => setComboId(null)}
          onSearch={(team) => { setComboId(null); setSearchQuery(team) }}
          onEstado={(estado) => s.edit(active, comboBet.id, { estado })}
          onEditBet={() => { setComboId(null); setModal({ bet: comboBet }) }}
        />
      )}
      {modal && (
        <BetModal
          bet={modal.bet} initialDate={modal.date} suggestAll={suggestAll} canon={canon}
          onClose={() => setModal(null)}
          onSave={(b) => { modal.bet ? s.edit(active, modal.bet.id, b) : s.add(active, b) }}
        />
      )}
      {confirm?.type === 'week' && (
        <ConfirmModal
          title="¿Cerrar la semana y empezar una nueva?"
          text={
            `Se archivan las jugadas de todos los clientes de la semana del ${fmtFull(weekStart)} (quedan en “Últimas semanas”, donde se pueden seguir editando) y la planilla arranca vacía para la semana del ${fmtFull(addDays(weekStart, 7))}.` +
            (oldest ? ` ⚠ Ya hay ${MAX_HISTORY} semanas guardadas: se eliminará automáticamente la semana del ${fmtFull(oldest.weekStart)}.` : '') +
            ' Si te equivocás, la podés restaurar desde “Últimas semanas”.'
          }
          confirmLabel="Sí, cerrar semana"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { s.newWeek(); setConfirm(null) }}
        />
      )}
      {confirm?.type === 'delweek' && (
        <ConfirmModal
          title={`¿Eliminar la semana del ${fmtFull(confirm.week.weekStart)}?`}
          text={`Se borra la semana con ${jugadas(Object.values(confirm.week.bets).flat().length)} para siempre y no se puede deshacer. Si querés conservarla, exportá el Excel antes.`}
          confirmLabel="Eliminar semana"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { s.deleteWeek(confirm.week.id); setConfirm(null) }}
        />
      )}
      {confirm?.type === 'restore' && (() => {
        const hasData = Object.values(allCurrentBets).some((l) => l.length > 0)
        const n = Object.values(allCurrentBets).flat().length
        return (
          <ConfirmModal
            danger={false}
            title={`¿Restaurar la semana del ${fmtFull(confirm.week.weekStart)} como semana actual?`}
            text={hasData
              ? `La semana actual (${fmtFull(s.state.weekStart)}, ${jugadas(n)}) no se pierde: pasa a “Últimas semanas”. Podés volver a restaurarla desde ahí.`
              : `La semana actual (${fmtFull(s.state.weekStart)}) está vacía, así que se reemplaza por la que restaurás.`}
            confirmLabel="Restaurar semana"
            onCancel={() => setConfirm(null)}
            onConfirm={() => { s.restoreWeek(confirm.week.id); setConfirm(null); setMenu(false) }}
          />
        )
      })()}
      {confirm?.type === 'bet' && (
        <ConfirmModal
          title="¿Borrar esta jugada?"
          text="Se elimina de la planilla."
          confirmLabel="Borrar"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { s.remove(active, confirm.id); setConfirm(null) }}
        />
      )}
      {confirm?.type === 'client' && (
        <ConfirmModal
          title={`¿Eliminar el cliente ${confirm.name}?`}
          text={`Se borra el cliente y sus ${(allBets[confirm.name] || []).length} jugadas de la semana actual. No se puede deshacer.`}
          confirmLabel="Eliminar cliente"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { s.deleteClient(confirm.name); setConfirm(null) }}
        />
      )}
    </div>
  )
}
