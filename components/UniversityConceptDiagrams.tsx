"use client";

import type { ReactNode } from "react";

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

export function UniversityJournalDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Concept · Session guardrails
      </p>
      <ol className="grid sm:grid-cols-2 gap-2 text-xs">
        {[
          "Write daily loss limit before open",
          "One-sentence thesis + invalidation",
          "Cooldown after a full stop-out",
          "Journal: followed plan? Y/N + lesson",
        ].map((step, i) => (
          <li
            key={step}
            className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 flex gap-2"
          >
            <span className="font-mono text-[10px] text-cyan-700 dark:text-cyan-300">{i + 1}</span>
            <span className="text-zinc-700 dark:text-zinc-200">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function UniversityStructureDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Concept · Structure lite
      </p>
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">Uptrend</p>
          <p className="text-muted-foreground">Higher highs + higher lows. BOS often = prior swing high taken.</p>
        </div>
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
          <p className="font-medium text-rose-800 dark:text-rose-200">Downtrend</p>
          <p className="text-muted-foreground">Lower highs + lower lows. CHOCH hint = meaningful swing low breaks against trend.</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Liquidity grab: wick beyond an obvious high/low that runs stops, then reverses — not always a clean breakout.
      </p>
    </div>
  );
}

export function UniversityWorkflowDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Concept · NovaStaris path
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {["Discover", "→ Score / levels", "→ Flow check", "→ Size + invalidation", "→ Journal"].map(
          (label, i) => (
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
          )
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tools answer questions — they do not replace risk rules. Disagreement between tabs → smaller size or stand aside.
      </p>
    </div>
  );
}

function ConceptShell({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {children}
      {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function UniversityCexDexDiagram() {
  return (
    <ConceptShell
      title="Concept · CEX vs DEX"
      note="CEX = custody + order book convenience. DEX = wallet custody + on-chain settlement. Pick for the job, not vibes."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3 space-y-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">CEX</p>
          <p className="text-muted-foreground">Account balances · KYC often · fiat on-ramps · perps common</p>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3 space-y-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">DEX</p>
          <p className="text-muted-foreground">Self-custody wallet · on-chain swap · gas/tips · mint risk</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {["BTC / ETH / SOL", "USDT / USDC quotes", "Spot vs perps"].map((t) => (
          <span
            key={t}
            className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-800 dark:text-cyan-200"
          >
            {t}
          </span>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityWalletDiagram() {
  return (
    <ConceptShell
      title="Concept · Wallet hygiene"
      note="NovaStaris never asks for a seed phrase. Separate degen capital from savings."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-xs text-center">
        {[
          { t: "Hot wallet", d: "Trading size only" },
          { t: "Cold / vault", d: "Long-term holdings" },
          { t: "Never share", d: "Seed / private key" },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{x.t}</p>
            <p className="mt-1 text-muted-foreground">{x.d}</p>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityRiskDiagram() {
  return (
    <ConceptShell
      title="Concept · Size from the stop"
      note="If you cannot state invalidation in one sentence, you do not have a trade."
    >
      <div className="flex flex-wrap gap-2 text-xs">
        {["Define invalidation", "→ Measure risk $", "→ Size position", "→ Cap daily loss"].map(
          (label, i) => (
            <span
              key={label}
              className={`rounded-md px-2.5 py-1.5 font-medium ${
                i === 3
                  ? "bg-amber-600 text-white"
                  : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {label}
            </span>
          )
        )}
      </div>
    </ConceptShell>
  );
}

export function UniversityNarrativeDiagram() {
  return (
    <ConceptShell
      title="Concept · What moves memes"
      note="Attention leads price. Most experiments go to zero — size as entertainment capital."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-xs text-center">
        {[
          { t: "Narrative", d: "Culture / story velocity" },
          { t: "Liquidity", d: "Can you exit size?" },
          { t: "Holders", d: "Concentration & dumps" },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{x.t}</p>
            <p className="mt-1 text-muted-foreground">{x.d}</p>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversitySolanaDiagram() {
  return (
    <ConceptShell
      title="Concept · Solana trader stack"
      note="Fast + cheap txs enable launch culture — and scams that clone logos and mints."
    >
      <div className="flex flex-wrap gap-2 text-xs">
        {["Wallet (Phantom…)", "→ Launchpad / mint", "→ DEX / Jupiter", "→ Track & manage"].map(
          (label, i) => (
            <span
              key={label}
              className={`rounded-md px-2.5 py-1.5 font-medium ${
                i === 3
                  ? "bg-cyan-600 text-white"
                  : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {label}
            </span>
          )
        )}
      </div>
    </ConceptShell>
  );
}

export function UniversityLifecycleDiagram() {
  return (
    <ConceptShell
      title="Concept · Meme lifecycle"
      note="Early = highest upside + rug risk. Late often = exit liquidity for early holders."
    >
      <div className="flex flex-wrap gap-2 text-xs">
        {["Create", "→ Discovery", "→ Social ignition", "→ Migrate / deepen LP", "→ Distribute"].map(
          (label, i) => (
            <span
              key={label}
              className={`rounded-md px-2.5 py-1.5 font-medium ${
                i === 4
                  ? "bg-rose-600 text-white"
                  : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {label}
            </span>
          )
        )}
      </div>
    </ConceptShell>
  );
}

export function UniversityBscCheckDiagram() {
  return (
    <ConceptShell
      title="Concept · BSC check list"
      note="Same meme game, EVM rails — verify contract, tax, LP, and holders before size."
    >
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        {[
          "0x contract on BscScan",
          "Honeypot / tax check",
          "LP lock / ownership",
          "Top holder concentration",
        ].map((item, i) => (
          <div
            key={item}
            className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 flex gap-2"
          >
            <span className="font-mono text-[10px] text-cyan-700 dark:text-cyan-300">{i + 1}</span>
            <span className="text-zinc-700 dark:text-zinc-200">{item}</span>
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
      note="Price ≈ implied probability. Edge = your estimate vs the market — after fees and resolution risk."
    >
      <div className="grid sm:grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3">
          <p className="text-zinc-500">Yes @ $0.35</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900 dark:text-zinc-50">~35%</p>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-3">
          <p className="text-zinc-500">Your estimate</p>
          <p className="mt-1 font-mono font-semibold text-amber-600 dark:text-amber-300">50%?</p>
        </div>
        <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 p-3">
          <p className="text-zinc-500">Possible edge</p>
          <p className="mt-1 font-mono font-semibold text-cyan-700 dark:text-cyan-300">If right</p>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversityFundingDiagram() {
  return (
    <ConceptShell
      title="Concept · Funding & OI"
      note="Crowded side + extreme funding can mean the move is late. OI rising with trend = participation; falling into a spike can be covering."
    >
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">Positive funding</p>
          <p className="text-muted-foreground">Longs typically pay shorts — crowded long bias often.</p>
        </div>
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
          <p className="font-medium text-rose-800 dark:text-rose-200">Negative funding</p>
          <p className="text-muted-foreground">Shorts typically pay longs — crowded short bias often.</p>
        </div>
      </div>
    </ConceptShell>
  );
}

export function UniversityFibDiagram() {
  return (
    <ConceptShell
      title="Concept · Fib retracement (lite)"
      note="Fib is confluence — strongest when it overlaps structure, a trend line, or a round number. Not a guarantee."
    >
      <div className="space-y-1.5 text-xs">
        {[
          { lvl: "0%", note: "Swing end (impulse high/low)" },
          { lvl: "38.2%", note: "Shallow pullback zone" },
          { lvl: "50%", note: "Mid retracement (widely watched)" },
          { lvl: "61.8%", note: "Deep pullback / 'golden' zone" },
          { lvl: "100%", note: "Swing start" },
        ].map((r) => (
          <div key={r.lvl} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-cyan-700 dark:text-cyan-300">{r.lvl}</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-cyan-600/30 to-cyan-500/70" />
            </div>
            <span className="text-muted-foreground hidden sm:block max-w-[14rem]">{r.note}</span>
          </div>
        ))}
      </div>
    </ConceptShell>
  );
}

export function UniversityOrdersDiagram() {
  return (
    <ConceptShell
      title="Concept · Order path"
      note="Set SL/TP right after fill. Cancel working orders when the thesis dies."
    >
      <div className="flex flex-wrap gap-2 text-xs">
        {["Plan entry + SL + TP", "→ Choose market/limit/stop", "→ Fill", "→ Manage / exit"].map(
          (label, i) => (
            <span
              key={label}
              className={`rounded-md px-2.5 py-1.5 font-medium ${
                i === 3
                  ? "bg-cyan-600 text-white"
                  : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {label}
            </span>
          )
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-center pt-1">
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-2">
          <p className="font-medium">Market</p>
          <p className="text-muted-foreground">Now · slippage risk</p>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-2">
          <p className="font-medium">Limit</p>
          <p className="text-muted-foreground">Your price · may miss</p>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-2">
          <p className="font-medium">Stop</p>
          <p className="text-muted-foreground">Trigger → market/limit</p>
        </div>
      </div>
    </ConceptShell>
  );
}
