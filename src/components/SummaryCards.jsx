import { CUR_LABEL, diffLabel, feeOf, money } from '../lib/logic'

// Mini tarjeta interna: etiqueta chica, monto en monoespaciado y negrita
function Mini({ label, value, tone = '', sub, span }) {
  return (
    <div className={`${span ? 'col-span-2 ' : ''}rounded-xl border border-line/60 bg-head/60 px-3 py-2 transition-all duration-200 hover:border-line hover:bg-head/80 hover:-translate-y-px`}>
      <div className="text-muted text-[10px] font-bold uppercase tracking-[0.08em]">{label}</div>
      <div className={`num font-extrabold text-[15px] sm:text-lg leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

function Card({ cur, t, pct }) {
  const fee = feeOf(t.played, pct)
  const diff = t.played - t.won
  // Moneda sin jugadas: tarjeta de una sola línea (ahorra lugar en pantallas chicas)
  if (t.count === 0)
    return (
      <section className="bento px-3 py-2 flex items-center gap-2">
        <span className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'}`}>{cur}</span>
        <span className="text-muted text-xs font-semibold">{CUR_LABEL[cur]} · sin jugadas</span>
        <span className="num font-bold text-sm ml-auto text-muted">{money(0, cur)}</span>
      </section>
    )
  const tone = diff > 0 ? 'win' : diff < 0 ? 'loss' : null
  return (
    <section className={`bento bento-gradient p-3 ${tone === 'win' ? 'glow-card-win' : tone === 'loss' ? 'glow-card-loss' : ''}`}>
      <header className="flex items-center gap-2 mb-2.5">
        <span className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'}`}>{cur}</span>
        <span className="text-muted text-xs font-semibold">{CUR_LABEL[cur]} · {t.count} jugadas</span>
        {pct > 0 && <span className="pill pill-gold ml-auto">Comisión {pct}% · <span className="num">{money(fee, cur)}</span></span>}
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Mini label="Total apostado" value={money(t.played, cur)} />
        <Mini label="Ganó el cliente" value={money(t.won, cur)} tone={t.won > 0 ? 'text-loss' : 'text-muted'} />
        <div className={`rounded-xl border px-3 py-2 transition-all duration-300 ${tone === 'win' ? 'bg-win/10 border-win/50 glow-box-win' : tone === 'loss' ? 'bg-loss/10 border-loss/50 glow-box-loss' : 'bg-head/60 border-line/60'}`}>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/80">{diffLabel(diff)}</div>
          <div className={`num font-extrabold text-[15px] sm:text-xl leading-tight ${tone === 'win' ? 'text-win glow-win' : tone === 'loss' ? 'text-loss glow-loss' : 'text-muted'}`}>{money(diff, cur)}</div>
        </div>
      </div>
    </section>
  )
}

export default function SummaryCards({ byCur, pct }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
      <Card cur="ARS" t={byCur.ARS} pct={pct} />
      <Card cur="USD" t={byCur.USD} pct={pct} />
    </div>
  )
}
