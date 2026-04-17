"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Star, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { aggregateTradesStats, tradeTimestampToMs } from "@/lib/polymarket-data-api";

const FAVORITES_LS_KEY = "novastaris-polymarket-tracker-favorites";
const AUTO_REFRESH_LS_KEY = "novastaris-polymarket-tracker-auto-refresh-ms";

type TraderRow = {
  address: string;
  nickname: string | null;
  isGlobal: boolean;
  source: "admin" | "user";
  valueUsd: number | null;
  positionCount: number;
  lastTradeTimeMs: number | null;
  tradeCount: number;
  volumeUsd: number;
  totalShares: number;
  netFlowUsd: number;
  closedPositionCount: number;
};

type TradeRow = {
  side?: string;
  title?: string;
  outcome?: string;
  size?: number;
  price?: number;
  timestamp?: number;
  slug?: string;
};

type PositionRow = {
  title?: string;
  slug?: string;
  outcome?: string;
  endDate?: string;
  size?: number;
  currentValue?: number;
  cashPnl?: number;
};
type ClosedRow = {
  title?: string;
  outcome?: string;
  avgPrice?: number;
  totalBought?: number;
  realizedPnl?: number;
  timestamp?: number;
};

type TradeStats = { tradeCount: number; volumeUsd: number; totalShares: number; netFlowUsd: number };

const AUTO_REFRESH_OPTIONS: { ms: number; label: string }[] = [
  { ms: 0, label: "Off" },
  { ms: 5000, label: "Every 5 sec" },
  { ms: 10000, label: "Every 10 sec" },
  { ms: 120000, label: "Every 2 min" },
  { ms: 300000, label: "Every 5 min" },
];

function loadFavoriteSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_LS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.map((a) => String(a).toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

function saveFavoriteSet(s: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_LS_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

function loadAutoRefreshMs(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = parseInt(localStorage.getItem(AUTO_REFRESH_LS_KEY) ?? "0", 10);
    return AUTO_REFRESH_OPTIONS.some((o) => o.ms === v) ? v : 0;
  } catch {
    return 0;
  }
}

function saveAutoRefreshMs(ms: number) {
  try {
    localStorage.setItem(AUTO_REFRESH_LS_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

function shortAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsd(n: number | null, maxFrac = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 })}`;
}

function fmtNum(n: number | null, maxFrac = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

/** Renders in the viewer's local timezone (browser). */
function formatLocalDateTime(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/** Polymarket position rows sometimes include market `endDate` as ISO text. */
function formatEndDateLocal(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

/** Whether a trade row plausibly refers to the same market/outcome as an open position row. */
function tapeMatchesPosition(p: PositionRow, t: TradeRow): boolean {
  const pSlug = typeof p.slug === "string" ? p.slug.trim() : "";
  const pTitle = (p.title ?? "").trim().toLowerCase();
  const pOut = (p.outcome ?? "").trim().toLowerCase();
  const tOut = (t.outcome ?? "").trim().toLowerCase();
  if (pOut && tOut && tOut !== pOut) return false;
  if (pSlug) {
    const ts = typeof t.slug === "string" ? t.slug.trim() : "";
    if (ts && ts === pSlug) return true;
    if (ts) return false;
  }
  const tTitle = (t.title ?? "").trim().toLowerCase();
  return !!pTitle && !!tTitle && tTitle === pTitle;
}

/**
 * Earliest BUY in the loaded trade tape that matches this position (slug preferred, else exact title + outcome).
 * Approximate: older fills may be missing until you use "Load older fills".
 */
function approxFirstBuyFromTape(p: PositionRow, tape: TradeRow[]): number | null {
  const times = tape
    .filter((t) => tapeMatchesPosition(p, t) && String(t.side ?? "").toUpperCase() === "BUY")
    .map((t) => tradeTimestampToMs(t.timestamp))
    .filter((x): x is number => x != null && x > 0);
  if (!times.length) return null;
  return Math.min(...times);
}

/** Latest BUY or SELL in the loaded tape for this market (best proxy for “most recently traded” here). */
function approxLastTapeActivityMs(p: PositionRow, tape: TradeRow[]): number | null {
  const times = tape
    .filter((t) => tapeMatchesPosition(p, t))
    .map((t) => tradeTimestampToMs(t.timestamp))
    .filter((x): x is number => x != null && x > 0);
  if (!times.length) return null;
  return Math.max(...times);
}

function endDateMs(iso: string | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = new Date(iso.trim()).getTime();
  return Number.isNaN(t) ? null : t;
}

function startOfLocalDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfLocalDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

export default function NovaPolymarketTrackerPanel() {
  const { data: session } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;

  const [traders, setTraders] = useState<TraderRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [disabledByFlag, setDisabledByFlag] = useState(false);

  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteSet());
  const [autoRefreshMs, setAutoRefreshMs] = useState(0);

  const [expanded, setExpanded] = useState<string | null>(null);
  const expandedRef = useRef<string | null>(null);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySilentRefresh, setActivitySilentRefresh] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<"positions" | "closed" | "trades">("positions");
  const [positionSortMode, setPositionSortMode] = useState<"api" | "recent_tape" | "end_soon" | "end_late">("api");
  const [positionsTodayOnly, setPositionsTodayOnly] = useState(false);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedRow[]>([]);
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [tradeStatsNote, setTradeStatsNote] = useState<string | null>(null);
  const [nextTradeOffset, setNextTradeOffset] = useState(0);
  const [tradesHasMore, setTradesHasMore] = useState(false);
  const [tradeTapeLoadingMore, setTradeTapeLoadingMore] = useState(false);

  const [myWallets, setMyWallets] = useState<{ id: string; address: string; nickname: string | null }[]>([]);
  const [newAddr, setNewAddr] = useState("");
  const [newNick, setNewNick] = useState("");
  const [adding, setAdding] = useState(false);
  const [addWalletError, setAddWalletError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    setDisabledByFlag(false);
    try {
      const res = await fetch("/api/polymarket-tracker/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        if (data?.disabled) setDisabledByFlag(true);
        setListError(data?.error ?? `Error ${res.status}`);
        setTraders([]);
        return;
      }
      if (data.success && Array.isArray(data.traders)) {
        setTraders(data.traders as TraderRow[]);
      } else {
        setListError(data?.error ?? "No data");
        setTraders([]);
      }
    } catch {
      setListError("Failed to load traders.");
      setTraders([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const fetchMyWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/user/polymarket-tracker-wallets", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.wallets)) {
        setMyWallets(data.wallets);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadActivityForAddress = useCallback(async (address: string, silent: boolean) => {
    if (!silent) {
      setActivityLoading(true);
      setActivityError(null);
    } else {
      setActivitySilentRefresh(true);
    }
    try {
      const res = await fetch(
        `/api/polymarket-tracker/activity?address=${encodeURIComponent(address)}&type=all&limit=150&offset=0&positionsLimit=220&closedLimit=180`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        if (!silent) setActivityError(data?.error ?? `Error ${res.status}`);
        return;
      }
      const t = Array.isArray(data.trades) ? data.trades : [];
      setTrades(t);
      setPositions(Array.isArray(data.positions) ? data.positions : []);
      setClosedPositions(Array.isArray(data.closedPositions) ? data.closedPositions : []);
      setTradeStats(t.length ? aggregateTradesStats(t) : null);
      setTradeStatsNote(typeof data.tradeStatsNote === "string" ? data.tradeStatsNote : null);
      setNextTradeOffset(typeof data.nextTradeOffset === "number" ? data.nextTradeOffset : t.length);
      setTradesHasMore(!!data.tradesHasMore);
    } catch {
      if (!silent) setActivityError("Failed to load positions and trade history.");
    } finally {
      if (!silent) setActivityLoading(false);
      setActivitySilentRefresh(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
    void fetchMyWallets();
    setAutoRefreshMs(loadAutoRefreshMs());
  }, [fetchList, fetchMyWallets]);

  useEffect(() => {
    setFavorites(loadFavoriteSet());
  }, []);

  useEffect(() => {
    if (autoRefreshMs <= 0) return;
    const id = window.setInterval(() => {
      void fetchList();
      const addr = expandedRef.current;
      if (addr) void loadActivityForAddress(addr, true);
    }, autoRefreshMs);
    return () => window.clearInterval(id);
  }, [autoRefreshMs, fetchList, loadActivityForAddress]);

  const sortedPositions = useMemo(() => {
    let list = [...positions];
    if (positionSortMode === "recent_tape") {
      list.sort((a, b) => {
        const ta = approxLastTapeActivityMs(a, trades) ?? -1;
        const tb = approxLastTapeActivityMs(b, trades) ?? -1;
        return tb - ta;
      });
    } else if (positionSortMode === "end_soon") {
      list.sort((a, b) => {
        const ea = endDateMs(a.endDate);
        const eb = endDateMs(b.endDate);
        if (ea == null && eb == null) return 0;
        if (ea == null) return 1;
        if (eb == null) return -1;
        return ea - eb;
      });
    } else if (positionSortMode === "end_late") {
      list.sort((a, b) => {
        const ea = endDateMs(a.endDate);
        const eb = endDateMs(b.endDate);
        if (ea == null && eb == null) return 0;
        if (ea == null) return 1;
        if (eb == null) return -1;
        return eb - ea;
      });
    }

    if (positionsTodayOnly) {
      const day0 = startOfLocalDayMs();
      const day1 = endOfLocalDayMs();
      list = list.filter((p) => {
        const t = approxLastTapeActivityMs(p, trades);
        return t != null && t >= day0 && t <= day1;
      });
    }

    return list;
  }, [positions, trades, positionSortMode, positionsTodayOnly]);

  const sortedTraders = useMemo(() => {
    const fav = favorites;
    return [...traders].sort((a, b) => {
      const af = fav.has(a.address.toLowerCase()) ? 1 : 0;
      const bf = fav.has(b.address.toLowerCase()) ? 1 : 0;
      if (bf !== af) return bf - af;
      const va = a.valueUsd ?? -1;
      const vb = b.valueUsd ?? -1;
      return vb - va;
    });
  }, [traders, favorites]);

  const toggleFavorite = (address: string) => {
    const key = address.toLowerCase();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveFavoriteSet(next);
      return next;
    });
  };

  const onAutoRefreshChange = (ms: number) => {
    setAutoRefreshMs(ms);
    saveAutoRefreshMs(ms);
  };

  const openActivity = async (address: string) => {
    if (expanded === address) {
      setExpanded(null);
      return;
    }
    setExpanded(address);
    setActivityTab("positions");
    setTrades([]);
    setPositions([]);
    setClosedPositions([]);
    setTradeStats(null);
    setTradeStatsNote(null);
    setNextTradeOffset(0);
    setTradesHasMore(false);
    await loadActivityForAddress(address, false);
  };

  const loadMoreTradeTape = async () => {
    const address = expanded;
    if (!address || !tradesHasMore || tradeTapeLoadingMore) return;
    setTradeTapeLoadingMore(true);
    try {
      const res = await fetch(
        `/api/polymarket-tracker/activity?address=${encodeURIComponent(address)}&type=trades&limit=150&offset=${nextTradeOffset}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setActivityError(data?.error ?? "Could not load older fills.");
        return;
      }
      const newT = Array.isArray(data.trades) ? data.trades : [];
      setTrades((prev) => {
        const merged = [...prev, ...newT];
        setTradeStats(aggregateTradesStats(merged));
        return merged;
      });
      setNextTradeOffset(typeof data.nextTradeOffset === "number" ? data.nextTradeOffset : nextTradeOffset + newT.length);
      setTradesHasMore(!!data.tradesHasMore);
    } catch {
      setActivityError("Could not load older fills.");
    } finally {
      setTradeTapeLoadingMore(false);
    }
  };

  const handleAddMyWallet = async () => {
    const addr = newAddr.trim().toLowerCase();
    if (!addr) return;
    setAdding(true);
    setAddWalletError(null);
    try {
      const res = await fetch("/api/user/polymarket-tracker-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, nickname: newNick.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewAddr("");
        setNewNick("");
        setMyWallets(Array.isArray(data.wallets) ? data.wallets : []);
        void fetchList();
      } else {
        setAddWalletError(data?.error ?? "Add failed");
      }
    } catch {
      setAddWalletError("Add failed");
    } finally {
      setAdding(false);
    }
  };

  const removeMyWallet = async (address: string) => {
    try {
      await fetch(`/api/user/polymarket-tracker-wallets?address=${encodeURIComponent(address)}`, { method: "DELETE" });
      void fetchMyWallets();
      void fetchList();
    } catch {
      /* ignore */
    }
  };

  const tableColSpan = 13;

  if (disabledByFlag) {
    return (
      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Nova Polymarket Tracker is turned off in Admin → Feature flags. Ask the site owner to enable{" "}
          <span className="font-mono text-xs">nova_polymarket_tracker</span>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Nova Polymarket Tracker</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Live Polymarket portfolio radar for curated traders and your own watchlist. Track open positions, closed
            history, trade tape, volume/amount flow, and local-time activity to compare behavior fast.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchList()} disabled={listLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${listLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="poly-auto-refresh" className="text-muted-foreground whitespace-nowrap">
                Auto-refresh
              </label>
              <select
                id="poly-auto-refresh"
                className="h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                value={autoRefreshMs}
                onChange={(e) => onAutoRefreshChange(Number(e.target.value))}
              >
                {AUTO_REFRESH_OPTIONS.map((o) => (
                  <option key={o.ms} value={o.ms}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {isOwner && (
              <Button type="button" size="sm" variant="secondary" asChild>
                <Link href="/admin/polymarket-tracker">Admin: manage wallets</Link>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Last trade</strong> times use your browser&apos;s locale and timezone. Table metrics for trades/volume
            are computed from loaded fills (first page 150; use <strong>Load older fills</strong> in the trade tape for more, up to API offset limits).
          </p>
          {listError && <p className="text-sm text-rose-600 dark:text-rose-400">{listError}</p>}

          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm min-w-[920px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50">
                  <th className="text-left p-2 w-10" aria-label="Favorite" />
                  <th className="text-left p-2">Label</th>
                  <th className="text-left p-2">Address</th>
                  <th className="text-right p-2">Portfolio</th>
                  <th className="text-right p-2">Open</th>
                  <th className="text-right p-2">History</th>
                  <th className="text-right p-2" title="Number of fills in the tracker summary batch (not necessarily lifetime count).">
                    Trades
                  </th>
                  <th
                    className="text-right p-2"
                    title="Sum of absolute notional per fill (|size × price|) in USD for the batch Polymarket returned—approximate traded dollar volume on those fills."
                  >
                    Volume
                  </th>
                  <th className="text-right p-2" title="Sum of absolute share size (|size|) across fills in the batch.">
                    Amount
                  </th>
                  <th
                    className="text-right p-2"
                    title="Signed sum of size × price: buys add, sells subtract—directional pressure on the batch, not profit."
                  >
                    Net flow
                  </th>
                  <th className="text-left p-2">Last trade</th>
                  <th className="text-left p-2">Source</th>
                  <th className="text-left p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {sortedTraders.length === 0 && !listLoading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="p-6 text-center text-muted-foreground">
                      No tracked wallets yet. {isOwner ? "Add wallets in Admin → Polymarket Tracker." : "Ask admin to add global traders, or add your own below."}
                    </td>
                  </tr>
                ) : (
                  sortedTraders.map((t) => {
                    const key = t.address.toLowerCase();
                    const fav = favorites.has(key);
                    return (
                      <Fragment key={t.address}>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800/80">
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => toggleFavorite(t.address)}
                              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              aria-label={fav ? "Remove favorite" : "Add favorite"}
                            >
                              <Star className={`h-4 w-4 ${fav ? "fill-amber-400 text-amber-500" : "text-zinc-400"}`} />
                            </button>
                          </td>
                          <td className="p-2 font-medium text-zinc-800 dark:text-zinc-200">{t.nickname || "—"}</td>
                          <td className="p-2 font-mono text-xs">
                            <a
                              href={`https://polygonscan.com/address/${t.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                            >
                              {shortAddr(t.address)}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                            </a>
                          </td>
                          <td className="p-2 text-right tabular-nums">{fmtUsd(t.valueUsd)}</td>
                          <td className="p-2 text-right tabular-nums">{t.positionCount}</td>
                          <td className="p-2 text-right tabular-nums">{t.closedPositionCount}</td>
                          <td className="p-2 text-right tabular-nums">{t.tradeCount}</td>
                          <td className="p-2 text-right tabular-nums">{fmtUsd(t.volumeUsd, 2)}</td>
                          <td className="p-2 text-right tabular-nums text-xs">{fmtNum(t.totalShares, 2)}</td>
                          <td
                            className={`p-2 text-right tabular-nums text-xs ${
                              t.netFlowUsd > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : t.netFlowUsd < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {fmtUsd(t.netFlowUsd, 2)}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                            {formatLocalDateTime(t.lastTradeTimeMs)}
                          </td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs">
                              {t.source === "admin" ? (t.isGlobal ? "Global" : "Admin") : "My list"}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => void openActivity(t.address)}>
                              {expanded === t.address ? "Hide" : "View"}
                            </Button>
                          </td>
                        </tr>
                        {expanded === t.address && (
                          <tr className="bg-zinc-50/50 dark:bg-zinc-900/40">
                            <td colSpan={tableColSpan} className="p-3 text-xs align-top">
                              {activityLoading && !activitySilentRefresh && (
                                <p className="text-muted-foreground">Loading positions and history…</p>
                              )}
                              {activitySilentRefresh && (
                                <p className="text-[10px] text-muted-foreground mb-2">Refreshing…</p>
                              )}
                              {activityError && <p className="text-rose-600 dark:text-rose-400">{activityError}</p>}
                              {!activityLoading && !activityError && (
                                <div className="space-y-3">
                                  {tradeStats && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 bg-white/50 dark:bg-zinc-950/40">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trades (batch)</p>
                                        <p className="text-sm font-semibold tabular-nums">{tradeStats.tradeCount}</p>
                                      </div>
                                      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 bg-white/50 dark:bg-zinc-950/40">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume (Σ size×price)</p>
                                        <p className="text-sm font-semibold tabular-nums">{fmtUsd(tradeStats.volumeUsd, 2)}</p>
                                      </div>
                                      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 bg-white/50 dark:bg-zinc-950/40">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount (Σ size)</p>
                                        <p className="text-sm font-semibold tabular-nums">{fmtNum(tradeStats.totalShares, 2)}</p>
                                      </div>
                                      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 bg-white/50 dark:bg-zinc-950/40">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net buy flow</p>
                                        <p
                                          className={`text-sm font-semibold tabular-nums ${
                                            tradeStats.netFlowUsd > 0
                                              ? "text-emerald-600 dark:text-emerald-400"
                                              : tradeStats.netFlowUsd < 0
                                                ? "text-rose-600 dark:text-rose-400"
                                                : ""
                                          }`}
                                        >
                                          {fmtUsd(tradeStats.netFlowUsd, 2)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {tradeStatsNote && <p className="text-[10px] text-muted-foreground">{tradeStatsNote}</p>}
                                  <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                                    {(
                                      [
                                        ["positions", "Current positions"],
                                        ["closed", "History (closed)"],
                                        ["trades", "Trade tape"],
                                      ] as const
                                    ).map(([id, label]) => (
                                      <button
                                        key={id}
                                        type="button"
                                        onClick={() => setActivityTab(id)}
                                        className={`rounded-md px-3 py-1 text-xs font-medium ${
                                          activityTab === id
                                            ? "bg-violet-500 text-white dark:bg-violet-600"
                                            : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {activityTab === "positions" && (
                                    <div className="space-y-2">
                                      <p className="text-[10px] text-muted-foreground leading-snug">
                                        Polymarket&apos;s <span className="font-mono">/positions</span> feed does not include a dedicated
                                        &quot;opened at&quot; time. We show <strong className="text-zinc-700 dark:text-zinc-300">market end</strong> when
                                        the API sends it, and an <strong className="text-zinc-700 dark:text-zinc-300">earliest matching BUY</strong>{" "}
                                        from the trade tape you have loaded (use <strong className="text-zinc-700 dark:text-zinc-300">Load older fills</strong>{" "}
                                        for deeper history).
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                        <label className="text-muted-foreground shrink-0">Sort positions</label>
                                        <select
                                          value={positionSortMode}
                                          onChange={(e) =>
                                            setPositionSortMode(e.target.value as "api" | "recent_tape" | "end_soon" | "end_late")
                                          }
                                          className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100 max-w-[min(100%,16rem)]"
                                        >
                                          <option value="api">API order</option>
                                          <option value="recent_tape">Most recent in trade tape</option>
                                          <option value="end_soon">Market end (soonest first)</option>
                                          <option value="end_late">Market end (latest first)</option>
                                        </select>
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={positionsTodayOnly}
                                            onChange={(e) => setPositionsTodayOnly(e.target.checked)}
                                            className="rounded border-zinc-400"
                                          />
                                          <span className="text-muted-foreground">Tape activity today (local)</span>
                                        </label>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground leading-snug">
                                        &quot;Most recent&quot; and &quot;Tape activity today&quot; use the latest BUY or SELL time in the{" "}
                                        <strong className="text-zinc-700 dark:text-zinc-300">currently loaded</strong> tape (up to your fetch limit). Load
                                        older fills if something is missing.
                                      </p>
                                      <ul className="space-y-1 max-h-72 overflow-y-auto text-left">
                                        {positions.length === 0 ? (
                                          <li className="text-muted-foreground">No open positions (or below API size threshold).</li>
                                        ) : sortedPositions.length === 0 ? (
                                          <li className="text-muted-foreground">
                                            No positions match &quot;Tape activity today&quot; in the loaded history—try turning the filter off or load
                                            older fills.
                                          </li>
                                        ) : (
                                          sortedPositions.map((p, i) => {
                                            const marketEnd = formatEndDateLocal(p.endDate);
                                            const firstBuyMs = approxFirstBuyFromTape(p, trades);
                                            const lastTapeMs = approxLastTapeActivityMs(p, trades);
                                            return (
                                              <li
                                                key={`${p.slug ?? "s"}-${(p.outcome ?? "").slice(0, 48)}-${i}`}
                                                className="border-b border-zinc-200/60 dark:border-zinc-700/60 pb-2"
                                              >
                                                <span className="text-zinc-800 dark:text-zinc-200 font-medium">{p.title ?? "—"}</span>
                                                {p.outcome != null && <span className="text-muted-foreground"> — {p.outcome}</span>}
                                                <span className="block text-muted-foreground tabular-nums mt-0.5">
                                                  Size {fmtNum(p.size ?? null, 4)} · Mark value {fmtUsd(p.currentValue ?? null, 2)}
                                                  {p.cashPnl != null && Number.isFinite(p.cashPnl) && (
                                                    <span> · Unrealized {fmtUsd(p.cashPnl, 2)}</span>
                                                  )}
                                                </span>
                                                <span className="block text-[11px] text-muted-foreground mt-1 space-y-0.5">
                                                  {marketEnd && (
                                                    <span className="block">
                                                      Market end (local): <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{marketEnd}</span>
                                                    </span>
                                                  )}
                                                  {firstBuyMs != null && (
                                                    <span className="block">
                                                      Earliest BUY in loaded tape (local):{" "}
                                                      <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{formatLocalDateTime(firstBuyMs)}</span>
                                                    </span>
                                                  )}
                                                  {lastTapeMs != null && lastTapeMs !== firstBuyMs && (
                                                    <span className="block">
                                                      Latest fill in loaded tape (local):{" "}
                                                      <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{formatLocalDateTime(lastTapeMs)}</span>
                                                    </span>
                                                  )}
                                                  {!marketEnd && firstBuyMs == null && (
                                                    <span className="block text-amber-800/90 dark:text-amber-200/90">
                                                      No timing match in the current tape—open Trade tape or load older fills.
                                                    </span>
                                                  )}
                                                </span>
                                              </li>
                                            );
                                          })
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                  {activityTab === "closed" && (
                                    <ul className="space-y-1 max-h-72 overflow-y-auto text-left">
                                      {closedPositions.length === 0 ? (
                                        <li className="text-muted-foreground">No closed positions returned for this wallet.</li>
                                      ) : (
                                        closedPositions.map((c, i) => (
                                          <li key={i} className="border-b border-zinc-200/60 dark:border-zinc-700/60 pb-2">
                                            <span className="text-zinc-800 dark:text-zinc-200 font-medium">{c.title ?? "—"}</span>
                                            {c.outcome != null && <span className="text-muted-foreground"> — {c.outcome}</span>}
                                            <span className="block text-muted-foreground tabular-nums mt-0.5">
                                              Settled {formatLocalDateTime(tradeTimestampToMs(c.timestamp))} · Avg {fmtNum(c.avgPrice ?? null, 4)} ·
                                              Realized PnL {fmtUsd(c.realizedPnl ?? null, 2)}
                                            </span>
                                          </li>
                                        ))
                                      )}
                                    </ul>
                                  )}
                                  {activityTab === "trades" && (
                                    <div className="space-y-2">
                                      <ul className="space-y-1 max-h-72 overflow-y-auto text-left">
                                        {trades.length === 0 ? (
                                          <li className="text-muted-foreground">No trades in this batch.</li>
                                        ) : (
                                          trades.map((tr, i) => {
                                            const tms = tradeTimestampToMs(tr.timestamp);
                                            const notional =
                                              Number.isFinite(Number(tr.size)) && Number.isFinite(Number(tr.price))
                                                ? Math.abs(Number(tr.size) * Number(tr.price))
                                                : null;
                                            return (
                                              <li key={i} className="border-b border-zinc-200/60 dark:border-zinc-700/60 pb-2">
                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                  <span
                                                    className={`font-semibold ${
                                                      String(tr.side).toUpperCase() === "BUY"
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-rose-600 dark:text-rose-400"
                                                    }`}
                                                  >
                                                    {tr.side ?? "—"}
                                                  </span>
                                                  <span className="text-muted-foreground tabular-nums text-[11px]">
                                                    {formatLocalDateTime(tms)}
                                                  </span>
                                                </div>
                                                <p className="text-zinc-800 dark:text-zinc-200 mt-0.5">{tr.title ?? "—"}</p>
                                                {tr.outcome != null && <p className="text-muted-foreground">Outcome: {tr.outcome}</p>}
                                                <p className="text-muted-foreground tabular-nums mt-0.5">
                                                  Size {fmtNum(tr.size ?? null, 4)} @ {fmtNum(tr.price ?? null, 4)}
                                                  {notional != null && <span> · ≈ {fmtUsd(notional, 2)}</span>}
                                                </p>
                                              </li>
                                            );
                                          })
                                        )}
                                      </ul>
                                      {tradesHasMore && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="w-full sm:w-auto"
                                          disabled={tradeTapeLoadingMore}
                                          onClick={() => void loadMoreTradeTape()}
                                        >
                                          {tradeTapeLoadingMore ? "Loading…" : "Load older fills"}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">My tracked wallets</CardTitle>
          <p className="text-xs text-muted-foreground">Add any Polymarket proxy wallet (0x…) you want to watch in this list (merged with admin global traders).</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {addWalletError && <p className="text-sm text-rose-600 dark:text-rose-400">{addWalletError}</p>}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col min-w-[200px] flex-1">
              <label className="text-xs text-muted-foreground mb-1">Address</label>
              <input
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
                placeholder="0x…"
                className="h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm font-mono"
              />
            </div>
            <div className="flex flex-col min-w-[140px] flex-1">
              <label className="text-xs text-muted-foreground mb-1">Nickname (optional)</label>
              <input
                value={newNick}
                onChange={(e) => setNewNick(e.target.value)}
                placeholder="Label"
                className="h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
              />
            </div>
            <Button type="button" size="sm" onClick={() => void handleAddMyWallet()} disabled={adding || !newAddr.trim()}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
          {myWallets.length > 0 && (
            <ul className="text-sm space-y-1">
              {myWallets.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="font-mono text-xs">{w.address}</span>
                  <span className="text-muted-foreground">{w.nickname || ""}</span>
                  <button
                    type="button"
                    className="text-rose-600 dark:text-rose-400 text-xs hover:underline"
                    onClick={() => void removeMyWallet(w.address)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
