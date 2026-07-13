"use client";

import type { ReactNode } from "react";

type Accent = "cyan" | "emerald" | "amber" | "rose" | "violet" | "sky";

const SHELL: Record<Accent, string> = {
  cyan: "border-cyan-400/50 bg-gradient-to-br from-cyan-500/20 via-sky-500/10 to-indigo-500/15 dark:from-cyan-500/25 dark:via-sky-900/40 dark:to-indigo-950/50",
  emerald:
    "border-emerald-400/50 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/15 dark:from-emerald-500/25 dark:via-teal-900/40 dark:to-cyan-950/50",
  amber:
    "border-amber-400/50 bg-gradient-to-br from-amber-500/25 via-orange-500/10 to-rose-500/10 dark:from-amber-500/25 dark:via-orange-900/40 dark:to-rose-950/40",
  rose: "border-rose-400/50 bg-gradient-to-br from-rose-500/20 via-fuchsia-500/10 to-violet-500/15 dark:from-rose-500/25 dark:via-fuchsia-900/40 dark:to-violet-950/50",
  violet:
    "border-violet-400/50 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-sky-500/15 dark:from-violet-500/25 dark:via-fuchsia-900/40 dark:to-sky-950/50",
  sky: "border-sky-400/50 bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-indigo-500/15 dark:from-sky-500/25 dark:via-blue-900/40 dark:to-indigo-950/50",
};

const TITLE: Record<Accent, string> = {
  cyan: "text-cyan-700 dark:text-cyan-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-800 dark:text-amber-300",
  rose: "text-rose-700 dark:text-rose-300",
  violet: "text-violet-700 dark:text-violet-300",
  sky: "text-sky-700 dark:text-sky-300",
};

const CHIP_COLORS = [
  "bg-violet-500 text-white shadow-sm shadow-violet-500/30",
  "bg-sky-500 text-white shadow-sm shadow-sky-500/30",
  "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
  "bg-rose-500 text-white shadow-sm shadow-rose-500/30",
  "bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-500/30",
];

function ConceptShell({
  title,
  children,
  note,
  accent = "cyan",
}: {
  title: string;
  children: ReactNode;
  note?: string;
  accent?: Accent;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${SHELL[accent]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${TITLE[accent]}`}>{title}</p>
      {children}
      {note ? <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{note}</p> : null}
    </div>
  );
}

function StepChip({ label, index, total }: { label: string; index: number; total: number }) {
  const isLast = index === total - 1;
  return (
    <span
      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
        isLast ? CHIP_COLORS[CHIP_COLORS.length - 1]! : CHIP_COLORS[index % (CHIP_COLORS.length - 1)]!
      }`}
    >
      {label}
    </span>
  );
}

/** Lightweight concept diagrams (no external assets). */

export function UniversityFeesDiagram() {
  const steps = ["Network fee", "+ Tip / bribe", "+ Slippage", "+ DEX/CEX fee", "= True cost"];
  return (
    <ConceptShell
      title="Concept · All-in meme trade cost"
      accent="amber"
      note="Small size + large tip can erase edge. Count fees before you click buy."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <StepChip key={label} label={label} index={i} total={steps.length} />
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityMarginDiagram() {
  return (
    <ConceptShell
      title="Concept · Margin vs notional"
      accent="rose"
      note="A ~10% adverse move can wipe a 10× position (before fees). Leverage multiplies risk, not skill."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-sky-400/40 bg-sky-500/20 p-3 shadow-sm">
          <p className="text-sky-800 dark:text-sky-200 font-medium">Margin</p>
          <p className="mt-1 font-mono text-lg font-bold text-sky-950 dark:text-sky-50">$100</p>
        </div>
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/25 p-3 shadow-sm">
          <p className="text-amber-900 dark:text-amber-200 font-medium">Leverage</p>
          <p className="mt-1 font-mono text-lg font-bold text-amber-700 dark:text-amber-300">×10</p>
        </div>
        <div className="rounded-lg border border-rose-400/50 bg-rose-500/25 p-3 shadow-sm">
          <p className="text-rose-900 dark:text-rose-200 font-medium">Notional</p>
          <p className="mt-1 font-mono text-lg font-bold text-rose-700 dark:text-rose-300">~$1,000</p>
        </div>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-zinc-200/80 dark:bg-zinc-800">
        <div className="w-[10%] bg-sky-500" title="Your margin" />
        <div className="w-[90%] bg-gradient-to-r from-amber-400 to-rose-500" title="Borrowed exposure" />
      </div>
      <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
        Blue = your collateral · amber→rose = leveraged exposure
      </p>
    </ConceptShell>
  );
}

export function UniversityCandlesDiagram() {
  return (
    <ConceptShell
      title="Concept · Candlestick (OHLC)"
      accent="emerald"
      note="Wicks show rejection. Always read candles with timeframe and structure — not as magic signals alone."
    >
      <div className="flex flex-wrap items-end justify-center gap-6 py-2">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-4 py-3">
          <svg width="56" height="120" viewBox="0 0 56 120" aria-hidden>
            <line
              x1="28"
              y1="8"
              x2="28"
              y2="112"
              stroke="currentColor"
              className="text-emerald-600 dark:text-emerald-400"
              strokeWidth="2.5"
            />
            <rect x="16" y="36" width="24" height="48" className="fill-emerald-500" rx="3" />
          </svg>
          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Bullish</p>
          <p className="text-[10px] text-emerald-900/70 dark:text-emerald-200/80 text-center">
            Close &gt; Open
            <br />
            High / Low = wicks
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-rose-500/15 border border-rose-400/40 px-4 py-3">
          <svg width="56" height="120" viewBox="0 0 56 120" aria-hidden>
            <line
              x1="28"
              y1="8"
              x2="28"
              y2="112"
              stroke="currentColor"
              className="text-rose-600 dark:text-rose-400"
              strokeWidth="2.5"
            />
            <rect x="16" y="28" width="24" height="52" className="fill-rose-500" rx="3" />
          </svg>
          <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Bearish</p>
          <p className="text-[10px] text-rose-900/70 dark:text-rose-200/80 text-center">
            Close &lt; Open
            <br />
            Body = open→close
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-violet-500/15 border border-violet-400/40 px-4 py-3">
          <svg width="56" height="120" viewBox="0 0 56 120" aria-hidden>
            <line
              x1="28"
              y1="12"
              x2="28"
              y2="108"
              stroke="currentColor"
              className="text-violet-500"
              strokeWidth="2.5"
            />
            <rect x="18" y="56" width="20" height="6" className="fill-violet-400" rx="1" />
          </svg>
          <p className="text-[11px] font-bold text-violet-700 dark:text-violet-300">Doji</p>
          <p className="text-[10px] text-violet-900/70 dark:text-violet-200/80 text-center">
            Open ≈ Close
            <br />
            Indecision
          </p>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversitySessionsDiagram() {
  return (
    <ConceptShell
      title="Concept · FX sessions (weekday)"
      accent="sky"
      note="London–New York overlap is often the best liquidity window for majors. Stand aside or widen risk into high-impact calendar releases."
    >
      <div className="relative h-16 rounded-lg overflow-hidden border border-white/40 dark:border-white/10 bg-zinc-900/5 dark:bg-zinc-950/40">
        <div
          className="absolute inset-y-1 left-[4%] w-[38%] rounded-md bg-violet-500/70 border border-violet-300/50"
          title="Tokyo"
        />
        <div
          className="absolute inset-y-1 left-[28%] w-[42%] rounded-md bg-amber-500/75 border border-amber-300/50"
          title="London"
        />
        <div
          className="absolute inset-y-1 left-[52%] w-[42%] rounded-md bg-sky-500/75 border border-sky-300/50"
          title="New York"
        />
        <div
          className="absolute inset-y-0 left-[52%] w-[18%] bg-gradient-to-b from-emerald-400/50 to-emerald-500/30 border-x-2 border-emerald-400/80"
          title="London–NY overlap"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Tokyo / Asia
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> London
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> New York
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Overlap (busiest)
        </span>
      </div>
    </ConceptShell>
  );
}

export function UniversityForexPipDiagram() {
  return (
    <ConceptShell
      title="Concept · Pip & lot snapshot (EUR/USD)"
      accent="violet"
      note="Illustrative only — brokers quote pip value from lot size and pair. Always size from $ risk, not max leverage."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-violet-400/40 bg-violet-500/15 p-3 space-y-2">
          <p className="font-semibold text-violet-900 dark:text-violet-200">Quote</p>
          <p className="font-mono text-2xl font-bold text-violet-700 dark:text-violet-300">1.0850</p>
          <p className="text-violet-900/70 dark:text-violet-200/80">
            1 pip ≈ <span className="font-mono font-semibold">0.0001</span> → move to{" "}
            <span className="font-mono font-semibold">1.0851</span>
          </p>
        </div>
        <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-3 space-y-2">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">~Pip value (rule of thumb)</p>
          <ul className="space-y-1 text-emerald-950/80 dark:text-emerald-100/90">
            <li>
              <span className="font-mono font-semibold">1.00</span> standard lot ≈{" "}
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">$10 / pip</span>
            </li>
            <li>
              <span className="font-mono font-semibold">0.10</span> mini ≈{" "}
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">$1 / pip</span>
            </li>
            <li>
              <span className="font-mono font-semibold">0.01</span> micro ≈{" "}
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">$0.10 / pip</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
        <span className="font-semibold">Quick check:</span> 0.10 lot × 20-pip stop ≈{" "}
        <span className="font-mono font-bold text-rose-600 dark:text-rose-300">$20 risk</span> on
        EUR/USD (before spread/swap).
      </div>
    </ConceptShell>
  );
}

export function UniversityJournalDiagram() {
  const steps = [
    "Write daily loss limit before open",
    "One-sentence thesis + invalidation",
    "Cooldown after a full stop-out",
    "Journal: followed plan? Y/N + lesson",
  ];
  const colors = [
    "border-violet-400/50 bg-violet-500/20",
    "border-sky-400/50 bg-sky-500/20",
    "border-amber-400/50 bg-amber-500/20",
    "border-emerald-400/50 bg-emerald-500/20",
  ];
  return (
    <ConceptShell title="Concept · Session guardrails" accent="violet">
      <ol className="grid sm:grid-cols-2 gap-2 text-xs">
        {steps.map((step, i) => (
          <li
            key={step}
            className={`rounded-lg border px-2.5 py-2 flex gap-2 ${colors[i]}`}
          >
            <span className="font-mono text-[10px] font-bold text-zinc-800 dark:text-zinc-100">
              {i + 1}
            </span>
            <span className="text-zinc-800 dark:text-zinc-100">{step}</span>
          </li>
        ))}
      </ol>
    </ConceptShell>
  );
}

export function UniversityStructureDiagram() {
  return (
    <ConceptShell
      title="Concept · Structure lite"
      accent="emerald"
      note="Liquidity grab: wick beyond an obvious high/low that runs stops, then reverses — not always a clean breakout."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 p-3 space-y-2">
          <p className="font-bold text-emerald-800 dark:text-emerald-200">Uptrend</p>
          <svg viewBox="0 0 120 48" className="w-full h-12" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-emerald-500"
              strokeWidth="3"
              strokeLinecap="round"
              points="4,40 28,32 44,36 68,18 88,22 116,6"
            />
          </svg>
          <p className="text-emerald-950/75 dark:text-emerald-100/80">
            Higher highs + higher lows. BOS often = prior swing high taken.
          </p>
        </div>
        <div className="rounded-lg border border-rose-400/50 bg-rose-500/15 p-3 space-y-2">
          <p className="font-bold text-rose-800 dark:text-rose-200">Downtrend</p>
          <svg viewBox="0 0 120 48" className="w-full h-12" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-rose-500"
              strokeWidth="3"
              strokeLinecap="round"
              points="4,8 28,16 44,12 68,30 88,26 116,42"
            />
          </svg>
          <p className="text-rose-950/75 dark:text-rose-100/80">
            Lower highs + lower lows. CHOCH hint = meaningful swing low breaks against trend.
          </p>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversityWorkflowDiagram() {
  const steps = ["Discover", "→ Score / levels", "→ Flow check", "→ Size + invalidation", "→ Journal"];
  return (
    <ConceptShell
      title="Concept · NovaStaris path"
      accent="cyan"
      note="Tools answer questions — they do not replace risk rules. Disagreement between tabs → smaller size or stand aside."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <StepChip key={label} label={label} index={i} total={steps.length} />
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityCexDexDiagram() {
  return (
    <ConceptShell
      title="Concept · CEX vs DEX"
      accent="sky"
      note="CEX = custody + order book convenience. DEX = wallet custody + on-chain settlement. Pick for the job, not vibes."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-sky-400/50 bg-sky-500/20 p-3 space-y-1 shadow-sm">
          <p className="font-bold text-sky-900 dark:text-sky-100">CEX</p>
          <p className="text-sky-950/75 dark:text-sky-100/80">
            Account balances · KYC often · fiat on-ramps · perps common
          </p>
        </div>
        <div className="rounded-lg border border-violet-400/50 bg-violet-500/20 p-3 space-y-1 shadow-sm">
          <p className="font-bold text-violet-900 dark:text-violet-100">DEX</p>
          <p className="text-violet-950/75 dark:text-violet-100/80">
            Self-custody wallet · on-chain swap · gas/tips · mint risk
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {["BTC / ETH / SOL", "USDT / USDC quotes", "Spot vs perps"].map((t, i) => (
          <span
            key={t}
            className={`rounded-md px-2 py-1 font-medium text-white ${CHIP_COLORS[i]}`}
          >
            {t}
          </span>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityWalletDiagram() {
  const cards = [
    { t: "Hot wallet", d: "Trading size only", c: "border-amber-400/50 bg-amber-500/20" },
    { t: "Cold / vault", d: "Long-term holdings", c: "border-emerald-400/50 bg-emerald-500/20" },
    { t: "Never share", d: "Seed / private key", c: "border-rose-400/50 bg-rose-500/20" },
  ];
  return (
    <ConceptShell
      title="Concept · Wallet hygiene"
      accent="amber"
      note="NovaStaris never asks for a seed phrase. Separate degen capital from savings."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-xs text-center">
        {cards.map((x) => (
          <div key={x.t} className={`rounded-lg border p-3 shadow-sm ${x.c}`}>
            <p className="font-bold text-zinc-900 dark:text-zinc-50">{x.t}</p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">{x.d}</p>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityRiskDiagram() {
  const steps = ["Define invalidation", "→ Measure risk $", "→ Size position", "→ Cap daily loss"];
  return (
    <ConceptShell
      title="Concept · Size from the stop"
      accent="amber"
      note="If you cannot state invalidation in one sentence, you do not have a trade."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <StepChip key={label} label={label} index={i} total={steps.length} />
        ))}
      </div>
      <div className="rounded-lg border border-rose-400/40 bg-rose-500/15 p-3 space-y-2">
        <div className="flex justify-between text-[10px] font-medium text-rose-900 dark:text-rose-200">
          <span>Account $10,000</span>
          <span>1% risk = $100</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-zinc-200/80 dark:bg-zinc-800 flex">
          <div className="w-[1%] min-w-[6px] bg-rose-500" title="Risk slice" />
          <div className="flex-1 bg-emerald-500/40" />
        </div>
        <p className="text-[10px] text-rose-900/80 dark:text-rose-100/80">
          Rose sliver = max planned loss on one idea — not “how big I feel.”
        </p>
      </div>
    </ConceptShell>
  );
}

export function UniversityNarrativeDiagram() {
  const cards = [
    { t: "Narrative", d: "Culture / story velocity", c: "border-fuchsia-400/50 bg-fuchsia-500/20" },
    { t: "Liquidity", d: "Can you exit size?", c: "border-sky-400/50 bg-sky-500/20" },
    { t: "Holders", d: "Concentration & dumps", c: "border-amber-400/50 bg-amber-500/20" },
  ];
  return (
    <ConceptShell
      title="Concept · What moves memes"
      accent="violet"
      note="Attention leads price. Most experiments go to zero — size as entertainment capital."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-xs text-center">
        {cards.map((x) => (
          <div key={x.t} className={`rounded-lg border p-3 shadow-sm ${x.c}`}>
            <p className="font-bold text-zinc-900 dark:text-zinc-50">{x.t}</p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">{x.d}</p>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversitySolanaDiagram() {
  const steps = ["Wallet (Phantom…)", "→ Launchpad / mint", "→ DEX / Jupiter", "→ Track & manage"];
  return (
    <ConceptShell
      title="Concept · Solana trader stack"
      accent="violet"
      note="Fast + cheap txs enable launch culture — and scams that clone logos and mints."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <StepChip key={label} label={label} index={i} total={steps.length} />
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityLifecycleDiagram() {
  const steps = ["Create", "→ Discovery", "→ Social ignition", "→ Migrate / deepen LP", "→ Distribute"];
  return (
    <ConceptShell
      title="Concept · Meme lifecycle"
      accent="rose"
      note="Early = highest upside + rug risk. Late often = exit liquidity for early holders."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <StepChip key={label} label={label} index={i} total={steps.length} />
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityBscCheckDiagram() {
  const items = [
    "0x contract on BscScan",
    "Honeypot / tax check",
    "LP lock / ownership",
    "Top holder concentration",
  ];
  const colors = [
    "border-amber-400/50 bg-amber-500/20",
    "border-rose-400/50 bg-rose-500/20",
    "border-sky-400/50 bg-sky-500/20",
    "border-emerald-400/50 bg-emerald-500/20",
  ];
  return (
    <ConceptShell
      title="Concept · BSC check list"
      accent="amber"
      note="Same meme game, EVM rails — verify contract, tax, LP, and holders before size."
    >
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        {items.map((item, i) => (
          <div key={item} className={`rounded-lg border px-2.5 py-2 flex gap-2 ${colors[i]}`}>
            <span className="font-mono text-[10px] font-bold">{i + 1}</span>
            <span className="text-zinc-800 dark:text-zinc-100">{item}</span>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityProbabilityDiagram() {
  return (
    <ConceptShell
      title="Concept · Prediction market price"
      accent="cyan"
      note="Price ≈ implied probability. Edge = your estimate vs the market — after fees and resolution risk."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-sky-400/50 bg-sky-500/20 p-3 shadow-sm">
          <p className="text-sky-800 dark:text-sky-200 font-medium">Yes @ $0.35</p>
          <p className="mt-1 font-mono text-lg font-bold text-sky-950 dark:text-sky-50">~35%</p>
        </div>
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/25 p-3 shadow-sm">
          <p className="text-amber-900 dark:text-amber-200 font-medium">Your estimate</p>
          <p className="mt-1 font-mono text-lg font-bold text-amber-700 dark:text-amber-300">50%?</p>
        </div>
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 p-3 shadow-sm">
          <p className="text-emerald-900 dark:text-emerald-200 font-medium">Possible edge</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300">
            If right
          </p>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversityFundingDiagram() {
  return (
    <ConceptShell
      title="Concept · Funding & OI"
      accent="rose"
      note="Crowded side + extreme funding can mean the move is late. OI rising with trend = participation; falling into a spike can be covering."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 p-3 space-y-1 shadow-sm">
          <p className="font-bold text-emerald-800 dark:text-emerald-200">Positive funding</p>
          <p className="text-emerald-950/80 dark:text-emerald-100/85">
            Longs typically pay shorts — crowded long bias often.
          </p>
        </div>
        <div className="rounded-lg border border-rose-400/50 bg-rose-500/20 p-3 space-y-1 shadow-sm">
          <p className="font-bold text-rose-800 dark:text-rose-200">Negative funding</p>
          <p className="text-rose-950/80 dark:text-rose-100/85">
            Shorts typically pay longs — crowded short bias often.
          </p>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversityFibDiagram() {
  const rows = [
    { lvl: "0%", note: "Swing end (impulse high/low)", w: "w-full", c: "from-rose-400 to-rose-500" },
    { lvl: "38.2%", note: "Shallow pullback zone", w: "w-[72%]", c: "from-amber-400 to-amber-500" },
    { lvl: "50%", note: "Mid retracement (widely watched)", w: "w-[55%]", c: "from-sky-400 to-sky-500" },
    { lvl: "61.8%", note: "Deep pullback / 'golden' zone", w: "w-[42%]", c: "from-violet-400 to-violet-600" },
    { lvl: "100%", note: "Swing start", w: "w-[18%]", c: "from-emerald-400 to-emerald-600" },
  ];
  return (
    <ConceptShell
      title="Concept · Fib retracement (lite)"
      accent="violet"
      note="Fib is confluence — strongest when it overlaps structure, a trend line, or a round number. Not a guarantee."
    >
      <div className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <div key={r.lvl} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono font-semibold text-violet-700 dark:text-violet-300">
              {r.lvl}
            </span>
            <div className="flex-1 h-3 rounded-full bg-zinc-200/70 dark:bg-zinc-800 overflow-hidden">
              <div className={`h-full ${r.w} rounded-full bg-gradient-to-r ${r.c}`} />
            </div>
            <span className="text-zinc-600 dark:text-zinc-400 hidden sm:block max-w-[14rem]">
              {r.note}
            </span>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityOrdersDiagram() {
  const steps = ["Plan entry + SL + TP", "→ Choose market/limit/stop", "→ Fill", "→ Manage / exit"];
  return (
    <ConceptShell
      title="Concept · Order path"
      accent="cyan"
      note="Set SL/TP right after fill. Cancel working orders when the thesis dies."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <StepChip key={label} label={label} index={i} total={steps.length} />
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-center pt-1">
        <div className="rounded-lg border border-rose-400/50 bg-rose-500/20 p-2 shadow-sm">
          <p className="font-bold text-rose-900 dark:text-rose-100">Market</p>
          <p className="text-rose-950/75 dark:text-rose-100/80">Now · slippage risk</p>
        </div>
        <div className="rounded-lg border border-sky-400/50 bg-sky-500/20 p-2 shadow-sm">
          <p className="font-bold text-sky-900 dark:text-sky-100">Limit</p>
          <p className="text-sky-950/75 dark:text-sky-100/80">Your price · may miss</p>
        </div>
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/20 p-2 shadow-sm">
          <p className="font-bold text-amber-900 dark:text-amber-100">Stop</p>
          <p className="text-amber-950/75 dark:text-amber-100/80">Trigger → market/limit</p>
        </div>
      </div>
    </ConceptShell>
  );
}

/** OHLC in 0–100 chart space (y grows downward in SVG). */
function MiniCandle({
  o,
  h,
  l,
  c,
  bullish,
}: {
  o: number;
  h: number;
  l: number;
  c: number;
  bullish?: boolean;
}) {
  const top = Math.min(o, c);
  const bot = Math.max(o, c);
  const fill = bullish === undefined ? "fill-violet-400" : bullish ? "fill-emerald-500" : "fill-rose-500";
  const stroke =
    bullish === undefined
      ? "text-violet-500"
      : bullish
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";
  return (
    <svg width="28" height="72" viewBox="0 0 28 100" aria-hidden className="shrink-0">
      <line
        x1="14"
        y1={h}
        x2="14"
        y2={l}
        stroke="currentColor"
        className={stroke}
        strokeWidth="2.5"
      />
      <rect x="6" y={top} width="16" height={Math.max(bot - top, 2)} className={fill} rx="1.5" />
    </svg>
  );
}

function CandleCard({
  name,
  hint,
  children,
  tone,
}: {
  name: string;
  hint: string;
  children: ReactNode;
  tone: "bull" | "bear" | "neutral";
}) {
  const shell =
    tone === "bull"
      ? "border-emerald-400/45 bg-emerald-500/12"
      : tone === "bear"
        ? "border-rose-400/45 bg-rose-500/12"
        : "border-violet-400/45 bg-violet-500/12";
  return (
    <div className={`rounded-lg border p-2.5 flex flex-col items-center gap-1.5 text-center ${shell}`}>
      <div className="flex items-end justify-center gap-1 min-h-[72px]">{children}</div>
      <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-50 leading-tight">{name}</p>
      <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-snug">{hint}</p>
    </div>
  );
}

export function UniversityCandleAtlasDiagram() {
  return (
    <ConceptShell
      title="Candlestick atlas · identify the shape"
      accent="emerald"
      note="Shapes are vocabulary — not buy/sell buttons. Same wick can mean different things after a rally vs a selloff. Wait for confirmation and define invalidation."
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
        Single candles
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CandleCard name="Hammer" hint="Long lower wick · after decline" tone="bull">
          <MiniCandle o={28} h={22} l={88} c={26} bullish />
        </CandleCard>
        <CandleCard name="Inverted hammer" hint="Long upper wick · after decline" tone="bull">
          <MiniCandle o={72} h={12} l={80} c={74} bullish />
        </CandleCard>
        <CandleCard name="Shooting star" hint="Long upper wick · after rally" tone="bear">
          <MiniCandle o={72} h={12} l={80} c={76} bullish={false} />
        </CandleCard>
        <CandleCard name="Hanging man" hint="Hammer shape · after rally" tone="bear">
          <MiniCandle o={28} h={22} l={88} c={30} bullish={false} />
        </CandleCard>
        <CandleCard name="Bull marubozu" hint="Long body · tiny wicks" tone="bull">
          <MiniCandle o={78} h={20} l={82} c={24} bullish />
        </CandleCard>
        <CandleCard name="Bear marubozu" hint="Long body · tiny wicks" tone="bear">
          <MiniCandle o={22} h={18} l={82} c={80} bullish={false} />
        </CandleCard>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 pt-1">
        Doji family (open ≈ close)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CandleCard name="Standard doji" hint="Indecision" tone="neutral">
          <MiniCandle o={50} h={18} l={82} c={51} />
        </CandleCard>
        <CandleCard name="Long-legged" hint="Wide both wicks" tone="neutral">
          <MiniCandle o={50} h={8} l={92} c={50} />
        </CandleCard>
        <CandleCard name="Dragonfly" hint="Long lower · near high" tone="bull">
          <MiniCandle o={22} h={18} l={90} c={22} bullish />
        </CandleCard>
        <CandleCard name="Gravestone" hint="Long upper · near low" tone="bear">
          <MiniCandle o={78} h={10} l={84} c={78} bullish={false} />
        </CandleCard>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200 pt-1">
        Two- & three-candle ideas
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CandleCard name="Bullish engulfing" hint="Green body covers prior red" tone="bull">
          <MiniCandle o={35} h={28} l={70} c={65} bullish={false} />
          <MiniCandle o={72} h={20} l={80} c={28} bullish />
        </CandleCard>
        <CandleCard name="Bearish engulfing" hint="Red body covers prior green" tone="bear">
          <MiniCandle o={68} h={30} l={75} c={38} bullish />
          <MiniCandle o={30} h={22} l={82} c={74} bullish={false} />
        </CandleCard>
        <CandleCard name="Morning star" hint="Down → small → strong up" tone="bull">
          <MiniCandle o={30} h={22} l={55} c={50} bullish={false} />
          <MiniCandle o={58} h={48} l={70} c={60} />
          <MiniCandle o={62} h={28} l={72} c={32} bullish />
        </CandleCard>
        <CandleCard name="Evening star" hint="Up → small → strong down" tone="bear">
          <MiniCandle o={70} h={45} l={78} c={48} bullish />
          <MiniCandle o={42} h={32} l={52} c={40} />
          <MiniCandle o={38} h={28} l={72} c={68} bullish={false} />
        </CandleCard>
      </div>
    </ConceptShell>
  );
}

export function UniversityIsolatedCrossDiagram() {
  return (
    <ConceptShell
      title="Concept · Isolated vs cross margin"
      accent="amber"
      note="Learning path: isolated + hard stop. Cross is for experienced risk managers who accept contagion."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-sky-400/50 bg-sky-500/20 p-3 space-y-2 shadow-sm">
          <p className="font-bold text-sky-900 dark:text-sky-100">Isolated</p>
          <p className="text-sky-950/80 dark:text-sky-100/85">
            Only the margin assigned to <em>this</em> position can be liquidated.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-md bg-sky-600/80 text-white text-center py-2 font-mono text-[10px]">
              Pos A
              <br />
              $100
            </div>
            <div className="flex-1 rounded-md bg-zinc-400/40 text-zinc-700 dark:text-zinc-200 text-center py-2 font-mono text-[10px]">
              Wallet rest
              <br />
              safe*
            </div>
          </div>
          <p className="text-[10px] text-sky-900/70 dark:text-sky-200/70">*Other open positions still have their own risk.</p>
        </div>
        <div className="rounded-lg border border-rose-400/50 bg-rose-500/20 p-3 space-y-2 shadow-sm">
          <p className="font-bold text-rose-900 dark:text-rose-100">Cross</p>
          <p className="text-rose-950/80 dark:text-rose-100/85">
            Shared wallet balance backs every cross position — one wipe can stress the whole book.
          </p>
          <div className="rounded-md bg-gradient-to-r from-rose-600 to-amber-500 text-white text-center py-3 font-mono text-[10px] font-semibold">
            Shared balance · Pos A + B + C
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversityLiquidationPathDiagram() {
  const steps = [
    { t: "Entry", d: "Open with margin", c: "bg-sky-500" },
    { t: "Adverse move", d: "Unrealized loss grows", c: "bg-amber-500" },
    { t: "Near maint.", d: "Margin ratio stressed", c: "bg-orange-500" },
    { t: "Liquidation", d: "Exchange force-closes", c: "bg-rose-600" },
  ];
  return (
    <ConceptShell
      title="Concept · Path to liquidation"
      accent="rose"
      note="Your stop-loss should fire before the exchange’s liquidation engine. Mark price (not last trade) often drives liq math."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <div key={s.t} className="flex items-center gap-2">
            <div className={`rounded-lg ${s.c} text-white px-3 py-2 text-xs shadow-sm min-w-[7.5rem]`}>
              <p className="font-bold">{s.t}</p>
              <p className="text-[10px] text-white/90">{s.d}</p>
            </div>
            {i < steps.length - 1 ? (
              <span className="text-rose-500 font-bold hidden sm:inline">→</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-950 dark:text-rose-100">
        Higher leverage → shorter distance from entry to the liquidation zone. Fees and funding can nudge you closer.
      </div>
    </ConceptShell>
  );
}

export function UniversityLongShortDiagram() {
  return (
    <ConceptShell
      title="Concept · Long vs short perps"
      accent="cyan"
      note="Funding is separate from PnL: you can be right on direction and still pay (or earn) funding while holding."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 p-3 space-y-2 shadow-sm">
          <p className="font-bold text-emerald-900 dark:text-emerald-100">Long</p>
          <svg viewBox="0 0 120 40" className="w-full h-10" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-emerald-500"
              strokeWidth="3"
              points="4,32 40,28 70,18 116,6"
            />
          </svg>
          <p className="text-emerald-950/80 dark:text-emerald-100/85">
            Profit if price rises. Loss if price falls. At risk of liq on a sharp dump.
          </p>
        </div>
        <div className="rounded-lg border border-rose-400/50 bg-rose-500/20 p-3 space-y-2 shadow-sm">
          <p className="font-bold text-rose-900 dark:text-rose-100">Short</p>
          <svg viewBox="0 0 120 40" className="w-full h-10" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-rose-500"
              strokeWidth="3"
              points="4,8 40,14 70,24 116,34"
            />
          </svg>
          <p className="text-rose-950/80 dark:text-rose-100/85">
            Profit if price falls. Loss if price rises. At risk of liq on a sharp squeeze up.
          </p>
        </div>
      </div>
    </ConceptShell>
  );
}
