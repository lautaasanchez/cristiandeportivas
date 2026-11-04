import { BANCA, CUR_LABEL, balanceOf, feeOf, money } from '../lib/logic'

// Mini tarjeta interna: etiqueta chica, monto en monoespaciado y negrita
function Mini({ label, value, tone = '', sub, span }) {
  return (
    <div className={`${span ? 'col-span-2 ' : ''}rounded-xl border border-line/60 bg-head/60 px-3 py-2`}>
      <div className="text-muted text-[10px] font-bold uppercase tracking-[0.08em]">{label}</div>
      <div className={`num font-extrabold text-[15px] sm:text-lg leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

function Card({ cur, t, pct }) {
  const fee = feeOf(t.played, pct)
  const balance = balanceOf(t, pct)
  const pos = balance >= 0
  // Moneda sin jugadas: tarjeta de una sola línea (ahorra lugar en pantallas chicas)
  if (t.count === 0)
    return (
      <section className="bento px-3 py-2 flex items-center gap-2">
        <span className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'}`}>{cur}</span>
        <span className="text-muted text-xs font-semibold">{CUR_LABEL[cur]} · sin jugadas</span>
        <span className="num font-bold text-sm ml-auto text-muted">{money(0, cur)}</span>
      </section>
    )
  return (
    <section className="bento p-3">
      <header className="flex items-center gap-2 mb-2.5">
        <span className={`pill ${cur === 'ARS' ? 'pill-cyan' : 'pill-gold'}`}>{cur}</span>
        <span className="text-muted text-xs font-semibold">{CUR_LABEL[cur]} · {t.count} jugadas</span>
        {pct > 0 && <span className="pill pill-gold ml-auto">Comisión {pct}% · <span className="num">{money(fee, cur)}</span></span>}
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,0.9fr)_1.4fr] gap-2.5">
        <div className={`rounded-xl border px-4 py-3 flex flex-col justify-center ${pos ? 'bg-win/10 border-win/50' : 'bg-loss/10 border-loss/50'}`}>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/80">Balance final a pagar</div>
          <div className={`num font-extrabold text-2xl sm:text-[28px] leading-tight ${pos ? 'text-win glow-win' : 'text-loss glow-loss'}`}>{money(balance, cur)}</div>
          <div className="text-[10px] text-muted">{balance === 0 ? '—' : pos ? `el cliente paga a ${BANCA}` : `${BANCA} paga al cliente`}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Mini span label="Total apostado" value={money(t.played, cur)} />
          <Mini label="Total perdido" value={money(-t.lost, cur)} tone={t.lost < 0 ? 'text-win' : 'text-muted'} sub="el cliente perdió" />
          <Mini label="Total ganado" value={money(-t.won, cur)} tone={t.won > 0 ? 'text-loss' : 'text-muted'} sub="el cliente ganó" />
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
