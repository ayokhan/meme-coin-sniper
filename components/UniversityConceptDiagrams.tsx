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
