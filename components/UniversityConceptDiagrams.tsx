"use client";

/** Lightweight concept diagrams (no external assets). */

export function UniversityFeesDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Concept · All-in meme trade cost</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {["Network fee", "+ Priority tip / bribe", "+ Slippage", "+ DEX/CEX fee", "= True cost"].map((label, i) => (
          <span
            key={label}
            className={`rounded-md px-2.5 py-1.5 font-medium ${
              i === 4
                ? "bg-cyan-600 text-white"
                : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Small size + large tip can erase edge. Count fees before you click buy.
      </p>
    </div>
  );
}

export function UniversityMarginDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Concept · Margin vs notional</p>
      <div className="grid sm:grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3">
          <p className="text-zinc-500">Margin</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900 dark:text-zinc-50">$100</p>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3">
          <p className="text-zinc-500">Leverage</p>
          <p className="mt-1 font-mono font-semibold text-amber-600 dark:text-amber-300">×10</p>
        </div>
        <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 p-3">
          <p className="text-zinc-500">Notional</p>
          <p className="mt-1 font-mono font-semibold text-cyan-700 dark:text-cyan-300">~$1,000</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        A ~10% adverse move can wipe a 10× position (before fees). Leverage multiplies risk, not skill.
      </p>
    </div>
  );
}

export function UniversityCandlesDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Concept · Candlestick (OHLC)
      </p>
      <div className="flex flex-wrap items-end justify-center gap-8 py-2">
        <div className="flex flex-col items-center gap-1">
          <svg width="56" height="120" viewBox="0 0 56 120" aria-hidden>
            <line x1="28" y1="8" x2="28" y2="112" stroke="currentColor" className="text-emerald-600 dark:text-emerald-400" strokeWidth="2" />
            <rect x="16" y="36" width="24" height="48" className="fill-emerald-500" rx="2" />
          </svg>
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Bullish</p>
          <p className="text-[10px] text-muted-foreground text-center">Close &gt; Open<br />High / Low = wicks</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <svg width="56" height="120" viewBox="0 0 56 120" aria-hidden>
            <line x1="28" y1="8" x2="28" y2="112" stroke="currentColor" className="text-rose-600 dark:text-rose-400" strokeWidth="2" />
            <rect x="16" y="28" width="24" height="52" className="fill-rose-500" rx="2" />
          </svg>
          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Bearish</p>
          <p className="text-[10px] text-muted-foreground text-center">Close &lt; Open<br />Body = open→close</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <svg width="56" height="120" viewBox="0 0 56 120" aria-hidden>
            <line x1="28" y1="12" x2="28" y2="108" stroke="currentColor" className="text-zinc-500" strokeWidth="2" />
            <rect x="18" y="56" width="20" height="6" className="fill-zinc-400 dark:fill-zinc-500" rx="1" />
          </svg>
          <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Doji</p>
          <p className="text-[10px] text-muted-foreground text-center">Open ≈ Close<br />Indecision</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Wicks show rejection. Always read candles with timeframe and structure — not as magic signals alone.
      </p>
    </div>
  );
}

export function UniversitySessionsDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Concept · FX sessions (weekday)
      </p>
      <div className="space-y-2">
        {[
          { name: "Tokyo", note: "Asia liquidity · often quieter on majors", width: "w-[28%]" },
          { name: "London", note: "Europe open · volume rises", width: "w-[38%]" },
          { name: "New York", note: "US data · overlap with London is busiest", width: "w-[34%]" },
        ].map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              {s.name}
            </span>
            <div className="flex-1 h-7 rounded-md bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full ${s.width} bg-sky-600/80 dark:bg-sky-500/70 rounded-md`}
                title={s.note}
              />
            </div>
            <span className="hidden sm:block text-[10px] text-muted-foreground max-w-[14rem]">
              {s.note}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        London–New York overlap is often the best liquidity window for majors. Stand aside or widen risk into
        high-impact calendar releases.
      </p>
    </div>
  );
}
