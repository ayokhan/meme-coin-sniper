"use client";

/**
 * Static desk teasers for locked VIP tabs — no live API / Yahoo calls (Vercel-safe).
 */

const PREVIEWS: Record<
  string,
  { title: string; blurb: string; bullets: string[]; sampleRows: { label: string; value: string }[] }
> = {
  "nova-forex": {
    title: "Nova Forex Agent — sample desk",
    blurb: "What VIP sees: Market Watch for gold, FX, and indices, then NovaQ / Fib / Radar / Scalp on one symbol.",
    bullets: [
      "Refresh high/low board across majors & metals",
      "NovaQ Forex structure on XAUUSD or EURUSD",
      "Optional Forex Bots on your MT4/MT5 account",
    ],
    sampleRows: [
      { label: "XAUUSD", value: "Range bias · retest high/low" },
      { label: "EURUSD", value: "Major FX · session structure" },
      { label: "NAS100", value: "Index proxy · trend context" },
    ],
  },
  "nova-forecast": {
    title: "NovaForecast Agent — sample desk",
    blurb: "What VIP sees: crypto perp ranges, NovaQ / Radar / Scalp on contracts like BTC — not empty theory.",
    bullets: [
      "Symbol forecast board with directional insight",
      "Nova Radar trade plans with R:R context",
      "Liquidation map and related futures tools",
    ],
    sampleRows: [
      { label: "BTC", value: "Range + structure read" },
      { label: "ETH", value: "Support / resistance touches" },
      { label: "SNXX", value: "Blofin perp — Forecast desk" },
    ],
  },
  wallets: {
    title: "Wallet Tracker — sample desk",
    blurb: "What VIP sees: tracked wallets and cluster buys — intelligence you can’t get from a lock screen.",
    bullets: [
      "Leverage traders + meme coins traders views",
      "Alerts when multiple wallets buy the same token",
      "Owner-managed wallet lists and on-demand access",
    ],
    sampleRows: [
      { label: "Cluster", value: "3+ wallets · same token" },
      { label: "Alert", value: "First-buy / shared entry" },
      { label: "Desk", value: "Meme + leverage tabs" },
    ],
  },
  ct: {
    title: "CT Scan — sample desk",
    blurb: "What VIP sees: Twitter/CT style tracking wired into the NovaStaris workflow.",
    bullets: ["Track signals and accounts in one place", "Faster context before you click into a chart", "VIP workspace, not a tease without substance"],
    sampleRows: [
      { label: "Feed", value: "Curated CT context" },
      { label: "Action", value: "Jump to related desk" },
      { label: "Access", value: "VIP or on-demand" },
    ],
  },
};

type Props = {
  tabId: string;
};

export default function VipDeskPreview({ tabId }: Props) {
  const preview = PREVIEWS[tabId];
  if (!preview) return null;

  return (
    <div className="mt-5 w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 overflow-hidden text-left">
      <div className="px-4 pt-3 pb-2 border-b border-zinc-200/80 dark:border-zinc-700/80">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Preview</p>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{preview.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{preview.blurb}</p>
      </div>
      <div className="px-4 py-2 space-y-1.5">
        {preview.sampleRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-2 rounded-md bg-white/70 dark:bg-zinc-950/40 px-2.5 py-1.5 text-xs"
          >
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{row.label}</span>
            <span className="text-muted-foreground text-right">{row.value}</span>
          </div>
        ))}
      </div>
      <ul className="px-4 pb-3 pt-1 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400 list-disc list-inside">
        {preview.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <p className="px-4 pb-3 text-[10px] text-zinc-500">
        Sample layout only — live data unlocks with VIP or trial.
      </p>
    </div>
  );
}
