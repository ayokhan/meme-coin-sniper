"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Flame, Lock, ShieldAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fomoTokenUrl } from "@/lib/meme-token-links";

type Chain = "solana" | "robinhood" | "bsc";
type Status = "building" | "running" | "cooling";

type Coin = {
  name: string;
  symbol: string;
  address: string;
  chain: Chain;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  buyRatio24h: number;
  ageDays: number;
  holderCount: number | null;
  top10Pct: number | null;
  conviction: number;
  scores: { narrative: number; liquidity: number; momentum: number; holders: number };
  status: Status;
  narrative: string;
  isLeader: boolean;
  thesis: string;
  risk: string;
  invalidation: string;
  flags: string[];
  pairUrl: string;
  socials: { twitter?: string; telegram?: string; website?: string };
};

type ScanResult = {
  chain: Chain;
  scannedAt: string;
  thresholds: { minMarketCapUsd: number; maxMarketCapUsd: number; minLiquidityUsd: number };
  pairsScanned: number;
  candidates: number;
  aiUsed: boolean;
  coins: Coin[];
};

type TrackWindow = { picks: number; medianChangePct: number | null; winRatePct: number | null };
type TrackRecord = {
  windowDays: number;
  totalPicks: number;
  after1d: TrackWindow;
  after7d: TrackWindow;
  bestRunners: { symbol: string; chain: string; peakMultiple: number }[];
};

const CHAINS: { id: Chain; label: string }[] = [
  { id: "solana", label: "Solana" },
  { id: "robinhood", label: "Robinhood" },
  { id: "bsc", label: "BSC" },
];

const STATUS_STYLE: Record<Status, { label: string; className: string; hint: string }> = {
  running: {
    label: "Running",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    hint: "Trending up with sustained flow",
  },
  building: {
    label: "Building",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    hint: "Holding range, buyers in control",
  },
  cooling: {
    label: "Cooling",
    className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30",
    hint: "Momentum fading. Wait or tighten risk",
  },
};

function fmtUsd(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function Pct({ v, label }: { v: number; label: string }) {
  return (
    <span className={v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
      {label} {v >= 0 ? "+" : ""}
      {v.toFixed(0)}%
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 55 ? "bg-cyan-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(4, value)}%` }} />
      </div>
    </div>
  );
}

function TrackRecordStrip({ record }: { record: TrackRecord }) {
  if (record.totalPicks === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Track record: every flagged coin is logged and checked after 1 day and 7 days. Results appear here as they come in.
      </p>
    );
  }
  const w = (t: TrackWindow, label: string) =>
    t.picks > 0 ? (
      <span>
        {label}: median{" "}
        <span className={(t.medianChangePct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
          {(t.medianChangePct ?? 0) >= 0 ? "+" : ""}
          {t.medianChangePct}%
        </span>{" "}
        · {t.winRatePct}% up ({t.picks})
      </span>
    ) : (
      <span>{label}: pending</span>
    );
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 px-3 py-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">
        Track record ({record.windowDays}d · {record.totalPicks} picks)
      </span>
      {w(record.after1d, "After 1 day")}
      {w(record.after7d, "After 7 days")}
      {record.bestRunners.length > 0 && (
        <span>
          Best:{" "}
          {record.bestRunners.map((b) => `${b.symbol} ${b.peakMultiple}x`).join(", ")}
        </span>
      )}
    </div>
  );
}

function CoinCard({ c }: { c: Coin }) {
  const status = STATUS_STYLE[c.status];
  const fomoChain = c.chain === "bsc" ? "bsc" : c.chain === "solana" ? "solana" : null;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{c.name}</span>
            <span className="text-xs text-muted-foreground">{c.symbol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${status.className}`} title={status.hint}>
              {status.label}
            </span>
            {c.isLeader && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30">
                <Crown className="h-3 w-3" /> Narrative leader
              </span>
            )}
          </div>
          <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-0.5">{c.narrative}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 leading-none">{c.conviction}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conviction</div>
        </div>
      </div>

      {c.thesis && <p className="text-xs text-zinc-700 dark:text-zinc-300">{c.thesis}</p>}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>MC {fmtUsd(c.marketCapUsd)}</span>
        <span>Liq {fmtUsd(c.liquidityUsd)}</span>
        <span>Vol 24h {fmtUsd(c.volume24hUsd)}</span>
        <Pct v={c.priceChange1h} label="1h" />
        <Pct v={c.priceChange6h} label="6h" />
        <Pct v={c.priceChange24h} label="24h" />
        <span>Buys {Math.round(c.buyRatio24h * 100)}%</span>
        <span>Age {c.ageDays < 1 ? `${Math.round(c.ageDays * 24)}h` : `${c.ageDays}d`}</span>
        {c.holderCount != null && <span>{c.holderCount.toLocaleString()} holders</span>}
        {c.top10Pct != null && <span>Top 10 hold {c.top10Pct}%</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ScoreBar label="Narrative" value={c.scores.narrative} />
        <ScoreBar label="Liquidity" value={c.scores.liquidity} />
        <ScoreBar label="Momentum" value={c.scores.momentum} />
        <ScoreBar label="Holders & safety" value={c.scores.holders} />
      </div>

      <div className="space-y-1 text-[11px]">
        {c.risk && (
          <p className="text-amber-700 dark:text-amber-400">
            <span className="font-medium">Risk:</span> {c.risk}
          </p>
        )}
        <p className="text-muted-foreground">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Exit signal:</span> {c.invalidation}
        </p>
        {c.flags.length > 0 && (
          <p className="flex items-start gap-1 text-zinc-500">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
            {c.flags.join(" · ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-0.5">
        <a href={c.pairUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40">
          Dex
        </a>
        {fomoChain && (
          <a href={fomoTokenUrl(c.address, fomoChain)} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40">
            FOMO
          </a>
        )}
        {c.socials.twitter && (
          <a href={c.socials.twitter} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40">
            X
          </a>
        )}
        {c.socials.telegram && (
          <a href={c.socials.telegram} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40">
            Telegram
          </a>
        )}
        <a href={`/?tab=ai-analysis&ca=${c.address}`} className="text-[10px] px-2 py-1 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
          AI Analyze
        </a>
      </div>
    </div>
  );
}

export default function StrongRunnersPanel() {
  const [chain, setChain] = useState<Chain>("solana");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [record, setRecord] = useState<TrackRecord | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (c: Chain) => {
    setError(null);
    try {
      const res = await fetch(`/api/strong-runners?chain=${c}`, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.locked) setLocked(true);
        else setError(data.error || "Could not load Strong Runners.");
        return;
      }
      setResult((data.latest as ScanResult | null) ?? null);
      setRecord(data.trackRecord as TrackRecord);
      setUsage(data.usage ?? null);
    } catch {
      setError("Network error. Check your connection.");
    }
  }, []);

  useEffect(() => {
    setResult(null);
    void load(chain);
  }, [chain, load]);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 88_000);
      const res = await fetch("/api/strong-runners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ chain }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.locked) setLocked(true);
        setError(data.error || "Scan failed.");
        return;
      }
      setResult(data.result as ScanResult);
      if (!data.cached && usage) setUsage({ ...usage, used: usage.used + 1 });
    } catch (e) {
      setError(e instanceof DOMException && e.name === "AbortError" ? "Scan timed out. Try again." : "Network error.");
    } finally {
      setLoading(false);
    }
  };

  if (locked) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-zinc-900 p-6 text-center">
        <Lock className="mx-auto h-6 w-6 text-amber-500 mb-2" />
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">Strong Runners is a VIP feature</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Established memes with a strong narrative, deep liquidity and real conviction, scored for multi-day holds on Solana, Robinhood and BSC.
        </p>
        <Button asChild className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
          <a href="/subscribe">Upgrade to VIP</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Strong Runners
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">VIP</span>
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
          Established memes with a strong narrative, deep liquidity, sustained buying and clean holder structure. These are coins with room to keep running over hours to days, not fresh launches.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Chain</p>
        <div className="flex flex-wrap items-center gap-2">
          {CHAINS.map((c) => (
            <Button key={c.id} size="sm" variant={chain === c.id ? "default" : "outline"} onClick={() => setChain(c.id)} disabled={loading}>
              {c.label}
            </Button>
          ))}
          <Button size="sm" className="ml-auto bg-orange-500 hover:bg-orange-600 text-white" onClick={() => void scan()} disabled={loading}>
            <TrendingUp className="h-4 w-4 mr-1.5" />
            {loading ? "Scanning… (up to a minute)" : result ? "Refresh" : "Find strong runners"}
          </Button>
        </div>
        {usage && (
          <p className="text-[11px] text-muted-foreground">
            {usage.used}/{usage.limit} fresh scans used today. Results less than 10 minutes old are shared and don&apos;t count.
          </p>
        )}
      </div>

      {record && <TrackRecordStrip record={record} />}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <p className="text-[11px] text-muted-foreground">
          {result.coins.length} strong runner{result.coins.length === 1 ? "" : "s"} · MC {fmtUsd(result.thresholds.minMarketCapUsd)}–{fmtUsd(result.thresholds.maxMarketCapUsd)} · liq ≥ {fmtUsd(result.thresholds.minLiquidityUsd)} · {result.candidates} passed filters of {result.pairsScanned} tokens · scanned {new Date(result.scannedAt).toLocaleTimeString()}
          {!result.aiUsed && " · narrative scored without AI this time"}
        </p>
      )}

      {result && result.coins.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          No coin clears the Strong Runner bar on {CHAINS.find((c) => c.id === chain)?.label} right now. That&apos;s the filter doing its job. Try another chain or check back later.
        </p>
      )}

      {!result && !loading && !error && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Pick a chain and tap <span className="font-medium text-zinc-700 dark:text-zinc-300">Find strong runners</span>.
        </p>
      )}

      <div className="space-y-3">
        {result?.coins.map((c) => <CoinCard key={c.address} c={c} />)}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Conviction scores measure strength right now, not future price. Memes can drop fast, so size positions accordingly and watch the exit signal on each coin.
      </p>
    </div>
  );
}
