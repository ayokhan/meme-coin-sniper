"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ArrowDown, ArrowUp, RefreshCw, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LeverageTraderPosition = {
  coin: string;
  side: "long" | "short";
  szi: string;
  entryPx: string;
  positionValue: string;
  marginUsed?: string;
  unrealizedPnl: string;
  leverage?: number;
  liquidationPx?: string | null;
  openedAtMs?: number | null;
};

export type LeverageTrader = {
  address: string;
  label?: string;
  nickname?: string | null;
  accountValue?: string;
  lastTradeTimeMs?: number | null;
  apexLiquidUrl?: string;
  isGlobal?: boolean;
  positions: LeverageTraderPosition[];
};

type Props = {
  traders: LeverageTrader[];
  loading: boolean;
  error?: string | null;
  updatedAt: number | null;
  onRefresh: (opts?: { silent?: boolean }) => void;
  favorites: Set<string>;
  onToggleFavorite: (address: string) => void;
  onOpenHistory: (address: string, nickname: string | null) => void;
  isOwner: boolean;
  hidingAddress: string | null;
  onHideGlobal: (address: string, displayName: string) => void;
};

type SortKey = "active" | "account" | "positions" | "notional" | "lev" | "pnl" | "roe" | "liq";
type ActivityFilter = "all" | "24h" | "today";

const AUTO_REFRESH_LS_KEY = "nova_leverage_auto_refresh";
const AUTO_REFRESH_MS = 120_000;
const CONSENSUS_COLLAPSED_COUNT = 8;

type PosView = {
  raw: LeverageTraderPosition;
  size: number;
  notional: number;
  margin: number | null;
  pnl: number;
  pnlAvailable: boolean;
  roe: number | null;
  mark: number | null;
  liq: number | null;
  liqDist: number | null;
  lev: number | null;
};

type TraderView = {
  raw: LeverageTrader;
  key: string;
  displayName: string;
  isFavorite: boolean;
  account: number | null;
  positions: PosView[];
  totalNotional: number;
  longNotional: number;
  shortNotional: number;
  totalPnl: number;
  totalMargin: number;
  roe: number | null;
  effLev: number | null;
  minLiqDist: number | null;
  longCount: number;
  shortCount: number;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPosView(p: LeverageTraderPosition): PosView {
  const size = Math.abs(num(p.szi) ?? 0);
  const notional = Math.abs(num(p.positionValue) ?? 0);
  const pnlRaw = num(p.unrealizedPnl);
  const isSynthetic = p.coin.toLowerCase().startsWith("xyz:");
  const pnlAvailable = !(isSynthetic && (pnlRaw == null || pnlRaw === 0)) && pnlRaw != null;
  const pnl = pnlRaw ?? 0;
  const lev = p.leverage != null && p.leverage > 0 ? p.leverage : null;
  const marginRaw = num(p.marginUsed);
  const margin = marginRaw != null && marginRaw > 0 ? marginRaw : lev && notional > 0 ? notional / lev : null;
  const mark = size > 0 && notional > 0 ? notional / size : null;
  const liqRaw = num(p.liquidationPx);
  const liq = liqRaw != null && liqRaw > 0 ? liqRaw : null;
  let liqDist: number | null = null;
  if (mark != null && liq != null) {
    const d = p.side === "long" ? (mark - liq) / mark : (liq - mark) / mark;
    liqDist = Math.max(0, d);
  }
  return {
    raw: p,
    size,
    notional,
    margin,
    pnl,
    pnlAvailable,
    roe: pnlAvailable && margin ? pnl / margin : null,
    mark,
    liq,
    liqDist,
    lev: lev ?? (margin && notional > 0 ? notional / margin : null),
  };
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtCompact(n: number, digits = 2): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  if (abs >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 4 });
}

/** `-$1,695` / `+$12.4K`; whole dollars once the amount is large enough that cents are noise. */
function fmtUsd(n: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : opts.sign && n > 0 ? "+" : "";
  const body = opts.compact && abs >= 1e4
    ? fmtCompact(abs, abs >= 1e7 ? 1 : 2)
    : abs.toLocaleString(undefined, { maximumFractionDigits: abs >= 100 ? 0 : 2 });
  return `${sign}$${body}`;
}

/** Adaptive precision so sub-$1 coins (DOGE $0.0912) don't collapse to $0.09. */
function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  if (n >= 0.01) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 5 })}`;
  return `$${n.toPrecision(4)}`;
}

function fmtPct(n: number | null, sign = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = n * 100;
  const s = sign && pct > 0 ? "+" : "";
  return `${s}${pct.toFixed(Math.abs(pct) >= 100 ? 0 : 1)}%`;
}

function fmtLev(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}x`;
}

function relTime(ms: number | null | undefined, now: number): string {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function fullTime(ms: number | null | undefined): string | undefined {
  if (!ms) return undefined;
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function pnlClass(n: number, available = true): string {
  if (!available) return "text-muted-foreground";
  return n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function liqClass(d: number | null): string {
  if (d == null) return "text-muted-foreground";
  if (d < 0.05) return "text-rose-600 dark:text-rose-400 font-semibold";
  if (d < 0.15) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

function SideBadge({ side }: { side: "long" | "short" }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${
        side === "long" ? "bg-emerald-600" : "bg-rose-600"
      }`}
    >
      {side === "long" ? "Long" : "Short"}
    </span>
  );
}

function sortValue(t: TraderView, key: SortKey): number | null {
  switch (key) {
    case "active": return t.raw.lastTradeTimeMs ?? null;
    case "account": return t.account;
    case "positions": return t.positions.length;
    case "notional": return t.totalNotional;
    case "lev": return t.effLev;
    case "pnl": return t.totalPnl;
    case "roe": return t.roe;
    case "liq": return t.minLiqDist;
  }
}

/** Keys that also order positions inside a trader; anything else falls back to largest notional first. */
const POSITION_SORT_KEYS = new Set<SortKey>(["lev", "pnl", "roe", "liq"]);

function posSortValue(p: PosView, key: SortKey): number | null {
  switch (key) {
    case "lev": return p.lev;
    case "pnl": return p.pnlAvailable ? p.pnl : null;
    case "roe": return p.roe;
    case "liq": return p.liqDist;
    default: return p.notional;
  }
}

export { fmtPrice as formatLeveragePrice, fmtUsd as formatLeverageUsd };

function compareNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

export function LeverageTradersBoard({
  traders,
  loading,
  error,
  updatedAt,
  onRefresh,
  favorites,
  onToggleFavorite,
  onOpenHistory,
  isOwner,
  hidingAddress,
  onHideGlobal,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [search, setSearch] = useState("");
  const [coinFilter, setCoinFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("notional");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showAllConsensus, setShowAllConsensus] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(AUTO_REFRESH_LS_KEY) === "0") setAutoRefresh(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const refreshRef = useRef({ onRefresh, loading });
  useEffect(() => {
    refreshRef.current = { onRefresh, loading };
  }, [onRefresh, loading]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      const { onRefresh: refresh, loading: busy } = refreshRef.current;
      if (document.visibilityState === "visible" && !busy) refresh({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_REFRESH_LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const baseTraders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return traders.filter((t) => {
      if (activity === "today" && (!t.lastTradeTimeMs || t.lastTradeTimeMs < startOfToday.getTime())) return false;
      if (activity === "24h" && (!t.lastTradeTimeMs || now - t.lastTradeTimeMs > 86_400_000)) return false;
      if (!q) return true;
      const name = `${t.nickname ?? ""} ${t.label ?? ""} ${t.address}`.toLowerCase();
      return name.includes(q) || t.positions.some((p) => p.coin.toLowerCase().includes(q));
    });
  }, [traders, activity, search, now]);

  const consensus = useMemo(() => {
    type Row = { coin: string; longTraders: Set<string>; shortTraders: Set<string>; longNotional: number; shortNotional: number; levWeighted: number; levNotional: number };
    const byCoin = new Map<string, Row>();
    for (const t of baseTraders) {
      for (const p of t.positions) {
        const v = toPosView(p);
        if (v.notional <= 0) continue;
        const row = byCoin.get(p.coin) ?? { coin: p.coin, longTraders: new Set(), shortTraders: new Set(), longNotional: 0, shortNotional: 0, levWeighted: 0, levNotional: 0 };
        if (p.side === "long") {
          row.longTraders.add(t.address);
          row.longNotional += v.notional;
        } else {
          row.shortTraders.add(t.address);
          row.shortNotional += v.notional;
        }
        if (v.lev != null) {
          row.levWeighted += v.lev * v.notional;
          row.levNotional += v.notional;
        }
        byCoin.set(p.coin, row);
      }
    }
    const rows = Array.from(byCoin.values())
      .map((r) => ({
        coin: r.coin,
        longs: r.longTraders.size,
        shorts: r.shortTraders.size,
        longNotional: r.longNotional,
        shortNotional: r.shortNotional,
        gross: r.longNotional + r.shortNotional,
        net: r.longNotional - r.shortNotional,
        avgLev: r.levNotional > 0 ? r.levWeighted / r.levNotional : null,
      }))
      .sort((a, b) => b.gross - a.gross);
    const totalLong = rows.reduce((s, r) => s + r.longNotional, 0);
    const totalShort = rows.reduce((s, r) => s + r.shortNotional, 0);
    return { rows, totalLong, totalShort };
  }, [baseTraders]);

  const views = useMemo<TraderView[]>(() => {
    const out: TraderView[] = [];
    for (const t of baseTraders) {
      const positions = t.positions
        .filter((p) => !coinFilter || p.coin === coinFilter)
        .map(toPosView);
      if (coinFilter && positions.length === 0) continue;
      let totalNotional = 0, longNotional = 0, shortNotional = 0, totalPnl = 0, totalMargin = 0, longCount = 0, shortCount = 0;
      let minLiqDist: number | null = null;
      for (const p of positions) {
        totalNotional += p.notional;
        if (p.raw.side === "long") { longNotional += p.notional; longCount++; } else { shortNotional += p.notional; shortCount++; }
        if (p.pnlAvailable) {
          totalPnl += p.pnl;
          if (p.margin) totalMargin += p.margin;
        }
        if (p.liqDist != null && (minLiqDist == null || p.liqDist < minLiqDist)) minLiqDist = p.liqDist;
      }
      const account = num(t.accountValue);
      out.push({
        raw: t,
        key: t.address.toLowerCase(),
        displayName: t.nickname ?? t.label ?? shortAddr(t.address),
        isFavorite: favorites.has(t.address.toLowerCase()),
        account,
        positions,
        totalNotional,
        longNotional,
        shortNotional,
        totalPnl,
        totalMargin,
        roe: totalMargin > 0 ? totalPnl / totalMargin : null,
        effLev: account && account > 0 && totalNotional > 0 ? totalNotional / account : null,
        minLiqDist,
        longCount,
        shortCount,
      });
    }
    out.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return compareNullable(sortValue(a, sortKey), sortValue(b, sortKey), sortDir);
    });
    const posDir = POSITION_SORT_KEYS.has(sortKey) ? sortDir : -1;
    for (const v of out) {
      v.positions.sort((a, b) => compareNullable(posSortValue(a, sortKey), posSortValue(b, sortKey), posDir));
    }
    return out;
  }, [baseTraders, coinFilter, favorites, sortKey, sortDir]);

  const forceExpand = coinFilter != null || search.trim() !== "";
  const isExpanded = (key: string) => forceExpand || expanded.has(key);
  const allExpanded = views.length > 0 && views.every((v) => expanded.has(v.key));

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "liq" ? 1 : -1);
    }
  };

  const hasFilters = activity !== "all" || coinFilter != null || search.trim() !== "";
  const clearFilters = () => {
    setActivity("all");
    setCoinFilter(null);
    setSearch("");
  };

  const totalBias = consensus.totalLong + consensus.totalShort;
  const shortShare = totalBias > 0 ? consensus.totalShort / totalBias : 0;
  const consensusRows = showAllConsensus ? consensus.rows : consensus.rows.slice(0, CONSENSUS_COLLAPSED_COUNT);

  const sortHead = (k: SortKey, label: string, title?: string) => (
    <th className="px-2 py-2 font-medium text-right" title={title}>
      <button
        type="button"
        onClick={() => setSort(k)}
        className={`inline-flex items-center gap-0.5 hover:text-zinc-900 dark:hover:text-zinc-100 ${sortKey === k ? "text-cyan-700 dark:text-cyan-300" : ""}`}
      >
        {label}
        {sortKey === k ? (sortDir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
      </button>
    </th>
  );

  const traderActions = (v: TraderView): ReactNode => {
    const hiding = hidingAddress?.toLowerCase() === v.key;
    return (
      <>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenHistory(v.raw.address, v.raw.nickname ?? null); }}
          className="text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400 underline"
        >
          History
        </button>
        {isOwner && v.raw.isGlobal !== false && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onHideGlobal(v.raw.address, v.displayName); }}
            disabled={hiding}
            className="text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
            title="Hide from global list for all users"
          >
            {hiding ? "Hiding…" : "Remove"}
          </button>
        )}
      </>
    );
  };

  const traderName = (v: TraderView): ReactNode => (
    <span className="inline-flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(v.raw.address); }}
        className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-amber-500 dark:hover:text-amber-400"
        aria-label={v.isFavorite ? "Remove trader from favorites" : "Favorite trader (pin to top)"}
        aria-pressed={v.isFavorite}
        title={v.isFavorite ? "Remove favorite" : "Favorite — pinned to top"}
      >
        <Star className={`h-3.5 w-3.5 ${v.isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>
      {v.raw.apexLiquidUrl ? (
        <a
          href={v.raw.apexLiquidUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-cyan-600 dark:text-cyan-400 hover:underline truncate"
          title={v.raw.address}
        >
          {v.displayName}
        </a>
      ) : (
        <span className="font-mono truncate" title={v.raw.address}>{v.displayName}</span>
      )}
    </span>
  );

  const activeCell = (ms: number | null | undefined) => {
    const recent = ms != null && now - ms < 3_600_000;
    return (
      <span className="inline-flex items-center gap-1" title={fullTime(ms) ? `Last fill: ${fullTime(ms)}` : "No fills in the last 7 days"}>
        {recent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
        {relTime(ms, now)}
      </span>
    );
  };

  const lsSplit = (v: TraderView) => (
    <span className="whitespace-nowrap">
      <span className="text-emerald-600 dark:text-emerald-400">{v.longCount}L</span>
      <span className="text-muted-foreground"> / </span>
      <span className="text-rose-600 dark:text-rose-400">{v.shortCount}S</span>
    </span>
  );

  const pnlText = (p: PosView) => (p.pnlAvailable ? fmtUsd(p.pnl, { compact: true }) : "N/A");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onRefresh()} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
        <span className="text-xs text-muted-foreground" title={fullTime(updatedAt)}>
          {updatedAt ? `Updated ${relTime(updatedAt, now)}` : loading ? "Loading…" : "Not loaded yet"}
        </span>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={autoRefresh} onChange={toggleAutoRefresh} className="accent-cyan-600" />
          Auto-refresh (2 min)
        </label>
      </div>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {/* Consensus */}
      {consensus.rows.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">What top traders are doing</h3>
            <span className="text-xs text-muted-foreground">
              {fmtUsd(totalBias, { compact: true })} open across {baseTraders.length} trader{baseTraders.length === 1 ? "" : "s"} ·{" "}
              <span className={shortShare > 0.5 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                {Math.round((shortShare > 0.5 ? shortShare : 1 - shortShare) * 100)}% {shortShare > 0.5 ? "short" : "long"}
              </span>
            </span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {consensusRows.map((r) => {
              const longPct = r.gross > 0 ? (r.longNotional / r.gross) * 100 : 0;
              const active = coinFilter === r.coin;
              return (
                <button
                  key={r.coin}
                  type="button"
                  onClick={() => setCoinFilter(active ? null : r.coin)}
                  className={`text-left rounded-md px-2 py-1.5 text-xs transition-colors ${
                    active ? "bg-cyan-50 dark:bg-cyan-950/40 ring-1 ring-cyan-500" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                  }`}
                  title={`Long ${fmtUsd(r.longNotional, { compact: true })} · Short ${fmtUsd(r.shortNotional, { compact: true })} — click to filter`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold w-20 truncate">{r.coin}</span>
                    <span className="whitespace-nowrap">
                      <span className="text-emerald-600 dark:text-emerald-400">{r.longs}L</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-rose-600 dark:text-rose-400">{r.shorts}S</span>
                    </span>
                    <span className={`ml-auto font-mono ${pnlClass(r.net)}`}>net {fmtUsd(r.net, { compact: true, sign: true })}</span>
                    <span className="font-mono text-muted-foreground w-10 text-right">{fmtLev(r.avgLev)}</span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-rose-500/80">
                    <div className="bg-emerald-500" style={{ width: `${longPct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          {consensus.rows.length > CONSENSUS_COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllConsensus((s) => !s)}
              className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              {showAllConsensus ? "Show fewer" : `Show all ${consensus.rows.length} coins`}
            </button>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Bars show long vs short notional. Net = long $ − short $. Leverage is notional-weighted. Click a coin to filter positions.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          {([["all", "All"], ["24h", "Active 24h"], ["today", "Today"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setActivity(k)}
              className={`px-2.5 py-1 ${activity === k ? "bg-cyan-600 text-white" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trader or coin…"
          className="text-xs border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 w-44"
        />
        {coinFilter && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 px-2 py-0.5 text-xs">
            <span className="font-mono">{coinFilter}</span>
            <button type="button" onClick={() => setCoinFilter(null)} aria-label="Clear coin filter"><X className="h-3 w-3" /></button>
          </span>
        )}
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:underline">Clear filters</button>
        )}
        <select
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(":");
            setSortKey(k as SortKey);
            setSortDir(d === "1" ? 1 : -1);
          }}
          className="md:hidden text-xs border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800"
          aria-label="Sort traders"
        >
          <option value="notional:-1">Largest notional</option>
          <option value="pnl:-1">Best PnL</option>
          <option value="pnl:1">Worst PnL</option>
          <option value="roe:-1">Best return on margin</option>
          <option value="lev:-1">Highest leverage</option>
          <option value="liq:1">Closest to liquidation</option>
          <option value="account:-1">Largest account</option>
          <option value="active:-1">Recently active</option>
        </select>
        {!forceExpand && views.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(views.map((v) => v.key)))}
            className="ml-auto text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {/* Empty states */}
      {views.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 py-10 text-center text-sm text-muted-foreground">
          {loading && traders.length === 0 ? (
            "Loading top traders…"
          ) : traders.length === 0 ? (
            error ? "Couldn't load traders. Try Refresh." : "No traders loaded yet. Click Refresh."
          ) : (
            <>
              No traders match these filters.{" "}
              <button type="button" onClick={clearFilters} className="text-cyan-600 dark:text-cyan-400 hover:underline">Clear filters</button>
            </>
          )}
        </div>
      )}

      {/* Desktop table */}
      {views.length > 0 && (
        <div className="hidden md:block rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Trader</th>
                {sortHead("account", "Account")}
                {sortHead("active", "Last active", "Most recent fill (open/add/reduce/close) in the last 7 days")}
                {sortHead("positions", "Positions")}
                {sortHead("notional", "Notional")}
                {sortHead("lev", "Eff. lev", "Total notional ÷ account value")}
                {sortHead("pnl", "uPnL")}
                {sortHead("roe", "ROE", "Unrealized PnL ÷ margin used")}
                {sortHead("liq", "Closest liq", "Distance from mark price to the nearest liquidation price")}
              </tr>
            </thead>
            <tbody>
              {views.map((v) => {
                const open = isExpanded(v.key);
                return (
                  <Fragment key={v.key}>
                    <tr
                      onClick={() => !forceExpand && toggleExpanded(v.key)}
                      className={`border-t border-zinc-200 dark:border-zinc-700 ${forceExpand ? "" : "cursor-pointer"} hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${v.isFavorite ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                    >
                      <td className="px-2 py-2 max-w-[260px]">
                        <div className="flex items-center gap-1">
                          {!forceExpand && (open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />)}
                          {traderName(v)}
                          <span className="ml-1 inline-flex gap-2 shrink-0">{traderActions(v)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{v.account != null ? fmtUsd(v.account, { compact: true }) : "—"}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{activeCell(v.raw.lastTradeTimeMs)}</td>
                      <td className="px-2 py-2 text-right">{v.positions.length === 0 ? <span className="text-muted-foreground">None</span> : lsSplit(v)}</td>
                      <td className="px-2 py-2 text-right font-mono">{v.totalNotional > 0 ? fmtUsd(v.totalNotional, { compact: true }) : "—"}</td>
                      <td className="px-2 py-2 text-right font-mono">{fmtLev(v.effLev)}</td>
                      <td className={`px-2 py-2 text-right font-mono ${pnlClass(v.totalPnl)}`}>{v.positions.length ? fmtUsd(v.totalPnl, { compact: true }) : "—"}</td>
                      <td className={`px-2 py-2 text-right font-mono ${v.roe != null ? pnlClass(v.roe) : "text-muted-foreground"}`}>{fmtPct(v.roe, true)}</td>
                      <td className={`px-2 py-2 text-right font-mono ${liqClass(v.minLiqDist)}`}>{fmtPct(v.minLiqDist)}</td>
                    </tr>
                    {open && v.positions.length > 0 && (
                      <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
                        <td colSpan={9} className="px-2 pb-2 pt-0">
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground">
                              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                <th className="py-1.5 pl-6 pr-2 text-left font-medium">Coin</th>
                                <th className="px-2 py-1.5 text-left font-medium">Side</th>
                                <th className="px-2 py-1.5 text-right font-medium" title="Absolute position size in coins">Size</th>
                                <th className="px-2 py-1.5 text-right font-medium">Entry</th>
                                <th className="px-2 py-1.5 text-right font-medium" title="Approximate mark price (notional ÷ size)">Mark</th>
                                <th className="px-2 py-1.5 text-right font-medium" title="Liquidation price and distance from mark">Liq</th>
                                <th className="px-2 py-1.5 text-right font-medium">Margin</th>
                                <th className="px-2 py-1.5 text-right font-medium">Notional</th>
                                <th className="px-2 py-1.5 text-right font-medium">Lev</th>
                                <th className="px-2 py-1.5 text-right font-medium">PnL</th>
                                <th className="px-2 py-1.5 text-right font-medium" title="When this position was opened (from recent fills)">Opened</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.positions.map((p, i) => (
                                <tr key={`${p.raw.coin}-${p.raw.side}-${i}`} className="border-b last:border-0 border-zinc-200/70 dark:border-zinc-800">
                                  <td className="py-1.5 pl-6 pr-2 font-mono font-medium">{p.raw.coin}</td>
                                  <td className="px-2 py-1.5"><SideBadge side={p.raw.side} /></td>
                                  <td className="px-2 py-1.5 text-right font-mono" title={p.raw.szi}>{fmtCompact(p.size)}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{fmtPrice(num(p.raw.entryPx))}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmtPrice(p.mark)}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">
                                    {p.liq != null ? (
                                      <span title={`Liquidation at ${fmtPrice(p.liq)}`}>
                                        <span className="text-muted-foreground">{fmtPrice(p.liq)}</span>{" "}
                                        <span className={liqClass(p.liqDist)}>({fmtPct(p.liqDist)})</span>
                                      </span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono">{p.margin != null ? fmtUsd(p.margin, { compact: true }) : "—"}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{fmtUsd(p.notional, { compact: true })}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{fmtLev(p.lev)}</td>
                                  <td className={`px-2 py-1.5 text-right font-mono ${pnlClass(p.pnl, p.pnlAvailable)}`} title={p.pnlAvailable ? undefined : "Live PnL isn't available for this synthetic market yet."}>
                                    {pnlText(p)}
                                    {p.roe != null && <span className="ml-1 opacity-75">({fmtPct(p.roe, true)})</span>}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-muted-foreground" title={fullTime(p.raw.openedAtMs)}>{relTime(p.raw.openedAtMs, now)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {views.length > 0 && (
        <div className="md:hidden space-y-2">
          {views.map((v) => {
            const open = isExpanded(v.key);
            return (
              <div key={v.key} className={`rounded-lg border border-zinc-200 dark:border-zinc-700 ${v.isFavorite ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !forceExpand && toggleExpanded(v.key)}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !forceExpand) { e.preventDefault(); toggleExpanded(v.key); } }}
                  className="p-3"
                >
                  <div className="flex items-center gap-1 text-sm">
                    {traderName(v)}
                    <span className="ml-auto text-xs text-muted-foreground">{activeCell(v.raw.lastTradeTimeMs)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Account</div>
                      <div className="font-mono">{v.account != null ? fmtUsd(v.account, { compact: true }) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">uPnL</div>
                      <div className={`font-mono ${pnlClass(v.totalPnl)}`}>
                        {v.positions.length ? fmtUsd(v.totalPnl, { compact: true }) : "—"}
                        {v.roe != null && <span className="ml-1 opacity-75">{fmtPct(v.roe, true)}</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Notional</div>
                      <div className="font-mono">{v.totalNotional > 0 ? fmtUsd(v.totalNotional, { compact: true }) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Positions</div>
                      <div>{v.positions.length === 0 ? "None" : lsSplit(v)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Eff. lev</div>
                      <div className="font-mono">{fmtLev(v.effLev)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Closest liq</div>
                      <div className={`font-mono ${liqClass(v.minLiqDist)}`}>{fmtPct(v.minLiqDist)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    {traderActions(v)}
                    {!forceExpand && v.positions.length > 0 && (
                      <span className="ml-auto inline-flex items-center gap-0.5 text-cyan-600 dark:text-cyan-400">
                        {open ? "Hide positions" : "Show positions"}
                        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                    )}
                  </div>
                </div>
                {open && v.positions.length > 0 && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-200/70 dark:divide-zinc-800">
                    {v.positions.map((p, i) => (
                      <div key={`${p.raw.coin}-${p.raw.side}-${i}`} className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{p.raw.coin}</span>
                          <SideBadge side={p.raw.side} />
                          <span className="font-mono text-muted-foreground">{fmtLev(p.lev)}</span>
                          <span className={`ml-auto font-mono ${pnlClass(p.pnl, p.pnlAvailable)}`}>
                            {pnlText(p)}
                            {p.roe != null && <span className="ml-1 opacity-75">({fmtPct(p.roe, true)})</span>}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-0.5 text-muted-foreground">
                          <span>Size <span className="font-mono text-zinc-700 dark:text-zinc-300">{fmtCompact(p.size)}</span></span>
                          <span>Entry <span className="font-mono text-zinc-700 dark:text-zinc-300">{fmtPrice(num(p.raw.entryPx))}</span></span>
                          <span>Mark <span className="font-mono text-zinc-700 dark:text-zinc-300">{fmtPrice(p.mark)}</span></span>
                          <span>Notional <span className="font-mono text-zinc-700 dark:text-zinc-300">{fmtUsd(p.notional, { compact: true })}</span></span>
                          <span>Margin <span className="font-mono text-zinc-700 dark:text-zinc-300">{p.margin != null ? fmtUsd(p.margin, { compact: true }) : "—"}</span></span>
                          <span>Liq <span className={`font-mono ${liqClass(p.liqDist)}`}>{p.liq != null ? fmtPct(p.liqDist) : "—"}</span></span>
                        </div>
                        {p.raw.openedAtMs ? <div className="mt-0.5 text-muted-foreground">Opened {relTime(p.raw.openedAtMs, now)}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {views.some((v) => v.positions.some((p) => p.raw.coin.toLowerCase().startsWith("xyz:"))) && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-mono">xyz:*</span> symbols are synthetic markets; their live PnL and liquidation price may be unavailable.
        </p>
      )}
    </div>
  );
}
