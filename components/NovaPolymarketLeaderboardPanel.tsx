"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ExternalLink, ListPlus, Radar, RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PolymarketLeaderboardCategory, PolymarketLeaderboardEntry } from "@/lib/polymarket-data-api";
import { NOVASTARIS_POLY_OPEN_RADAR_ANALYZE } from "@/lib/novastaris-polymarket-events";

type TimeUi = "DAY" | "WEEK" | "MONTH" | "ALL";

type LeaderboardJson = {
  success?: boolean;
  error?: string;
  leaderboardDisabled?: boolean;
  category?: string;
  timePeriod?: string;
  orderBy?: string;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  leaderboard?: PolymarketLeaderboardEntry[];
  biggestWins?: Array<{
    rank: number;
    proxyWallet: string;
    displayName: string;
    marketTitle: string;
    slug?: string;
    stakeUsd: number | null;
    payoutUsd: number | null;
    realizedPnl: number;
  }>;
  biggestWinsNote?: string;
  polymarketLeaderboardUrl?: string;
};

const TIME_TABS: { id: TimeUi; label: string }[] = [
  { id: "DAY", label: "Today" },
  { id: "WEEK", label: "Weekly" },
  { id: "MONTH", label: "Monthly" },
  { id: "ALL", label: "All" },
];

const CATEGORIES: { id: PolymarketLeaderboardCategory; label: string }[] = [
  { id: "OVERALL", label: "All categories" },
  { id: "POLITICS", label: "Politics" },
  { id: "SPORTS", label: "Sports" },
  { id: "CRYPTO", label: "Crypto" },
  { id: "CULTURE", label: "Culture" },
  { id: "MENTIONS", label: "Mentions" },
  { id: "WEATHER", label: "Weather" },
  { id: "ECONOMICS", label: "Economics" },
  { id: "TECH", label: "Tech" },
  { id: "FINANCE", label: "Finance" },
];

function fmtUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

function fmtUsdSigned(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

function displayUser(row: PolymarketLeaderboardEntry): string {
  const u = row.userName?.trim();
  if (u) return u;
  const w = row.proxyWallet?.trim();
  return w || "—";
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function isValidProxyAddr(a: string | undefined | null): a is string {
  return !!a && /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

function horizontalTableKeyScroll(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const el = e.currentTarget;
  if (el.scrollWidth <= el.clientWidth + 1) return;
  const step = e.shiftKey ? 120 : 48;
  el.scrollBy({ left: e.key === "ArrowLeft" ? -step : step, behavior: "smooth" });
  e.preventDefault();
}

export default function NovaPolymarketLeaderboardPanel() {
  const [timePeriod, setTimePeriod] = useState<TimeUi>("MONTH");
  const [category, setCategory] = useState<PolymarketLeaderboardCategory>("OVERALL");
  const [orderBy, setOrderBy] = useState<"PNL" | "VOL">("PNL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PolymarketLeaderboardEntry[]>([]);
  /** Next API offset for pagination (ref avoids stale closures on “Load more”). */
  const nextApiOffsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biggestWins, setBiggestWins] = useState<LeaderboardJson["biggestWins"]>([]);
  const [winsNote, setWinsNote] = useState<string | null>(null);
  const [polyUrl, setPolyUrl] = useState("https://polymarket.com/leaderboard/overall/monthly/profit");
  const [trackingAddr, setTrackingAddr] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const q = search.trim().toLowerCase();

  useEffect(() => {
    if (!actionToast) return;
    const t = window.setTimeout(() => setActionToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [actionToast]);

  const addToTracker = useCallback(async (address: string, nickname?: string | null) => {
    const a = address.trim().toLowerCase();
    if (!isValidProxyAddr(a)) {
      setActionToast("Invalid wallet address.");
      return;
    }
    setTrackingAddr(a);
    setActionToast(null);
    try {
      const res = await fetch("/api/user/polymarket-tracker-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: a,
          nickname: nickname?.trim().slice(0, 120) || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (res.ok && data.success) setActionToast("Added to Nova Polymarket Tracker.");
      else setActionToast(data.error ?? "Could not add wallet.");
    } catch {
      setActionToast("Could not add wallet.");
    } finally {
      setTrackingAddr(null);
    }
  }, []);

  const openRadarAnalyze = useCallback((address: string, nickname?: string | null) => {
    const a = address.trim().toLowerCase();
    if (!isValidProxyAddr(a)) {
      setActionToast("Invalid wallet for analyze.");
      return;
    }
    const nick = nickname?.trim() || null;
    window.dispatchEvent(
      new CustomEvent(NOVASTARIS_POLY_OPEN_RADAR_ANALYZE, {
        detail: { address: a, nickname: nick ?? undefined },
      })
    );
    setActionToast(nick ? `Opening Polymarket Radar for ${nick}…` : "Opening Polymarket Radar…");
  }, []);

  const filteredRows = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.userName ?? "").toLowerCase();
      const w = (r.proxyWallet ?? "").toLowerCase();
      return name.includes(q) || w.includes(q);
    });
  }, [rows, q]);

  const load = useCallback(async (reset: boolean) => {
    const nextOffset = reset ? 0 : nextApiOffsetRef.current;
    if (reset) {
      nextApiOffsetRef.current = 0;
      setLoading(true);
      setError(null);
    } else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        category,
        timePeriod,
        orderBy,
        limit: "50",
        offset: String(nextOffset),
        includeWins: reset ? "1" : "0",
      });
      const res = await fetch(`/api/polymarket-leaderboard?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as LeaderboardJson;
      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`);
        if (reset) {
          setRows([]);
          setBiggestWins([]);
        }
        return;
      }
      if (data.polymarketLeaderboardUrl) setPolyUrl(data.polymarketLeaderboardUrl);
      const chunk = data.leaderboard ?? [];
      setRows((prev) => (reset ? chunk : [...prev, ...chunk]));
      nextApiOffsetRef.current = nextOffset + chunk.length;
      setHasMore(!!data.hasMore);
      if (reset) {
        setBiggestWins(data.biggestWins ?? []);
        setWinsNote(data.biggestWinsNote ?? null);
      }
    } catch {
      setError("Failed to load leaderboard.");
      if (reset) setRows([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, timePeriod, orderBy]);

  useEffect(() => {
    nextApiOffsetRef.current = 0;
    setRows([]);
    void load(true);
  }, [category, timePeriod, orderBy, load]);

  const reload = () => {
    nextApiOffsetRef.current = 0;
    setRows([]);
    void load(true);
  };

  const periodHeading =
    timePeriod === "DAY"
      ? "Today (UTC calendar day)"
      : timePeriod === "WEEK"
        ? "This week (UTC week, Mon–Sun)"
        : timePeriod === "MONTH"
          ? "This month (UTC calendar month)"
          : "All time";

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Leaderboard</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={polyUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open on Polymarket
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIME_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTimePeriod(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
              timePeriod === t.id
                ? "bg-amber-500 text-white border-amber-500 dark:bg-amber-600"
                : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionToast && (
        <div className="rounded-md border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100 break-words">
          {actionToast}
        </div>
      )}

      <div className="min-w-0 grid grid-cols-1 min-[1180px]:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
        <Card className="min-w-0 border-zinc-200/80 dark:border-zinc-700/80">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base font-semibold">Traders</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PolymarketLeaderboardCategory)}
                  className="h-9 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value as "PNL" | "VOL")}
                  className="h-9 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                >
                  <option value="PNL">Profit / loss</option>
                  <option value="VOL">Volume</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Search by name or wallet</label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter current page…"
                className="h-9 w-full max-w-md rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div
                className="overflow-x-auto overflow-y-visible rounded-md border border-zinc-200 dark:border-zinc-700 scroll-smooth outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                tabIndex={0}
                role="region"
                aria-label="Traders leaderboard table. When this area is focused, use Left and Right arrow keys to scroll horizontally."
                onKeyDown={horizontalTableKeyScroll}
              >
                <table className="w-max min-w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="p-2 w-12 whitespace-nowrap">#</th>
                      <th className="p-2 min-w-[22rem] sm:min-w-[26rem]">User</th>
                      <th className="p-2 text-right whitespace-nowrap min-w-[7.5rem]">P/L</th>
                      <th className="p-2 text-right whitespace-nowrap min-w-[7.5rem]">Volume</th>
                      <th className="p-2 text-right whitespace-nowrap min-w-[11.5rem]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => {
                      const rankNum = parseInt(String(r.rank ?? ""), 10) || i + 1;
                      const medal = rankMedal(rankNum);
                      const pnl = Number(r.pnl);
                      const vol = Number(r.vol);
                      const wallet = r.proxyWallet?.trim() ?? "";
                      const nick = r.userName?.trim() || null;
                      return (
                        <tr key={`${r.proxyWallet ?? i}-${rankNum}`} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="p-2 text-zinc-500 tabular-nums">{rankNum}</td>
                          <td className="p-2 align-top">
                            <div className="flex items-start gap-2 min-w-0">
                              {r.profileImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.profileImage} alt="" className="h-8 w-8 rounded-full shrink-0 object-cover mt-0.5" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-zinc-900 dark:text-zinc-100 flex flex-wrap items-center gap-x-1 gap-y-0.5 break-words">
                                  {medal && <span className="shrink-0">{medal}</span>}
                                  <span>{displayUser(r)}</span>
                                  {r.verifiedBadge && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                                      ✓
                                    </Badge>
                                  )}
                                </div>
                                {r.proxyWallet && r.userName?.trim() && (
                                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono break-all leading-snug mt-0.5">
                                    {r.proxyWallet}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td
                            className={`p-2 text-right tabular-nums font-medium ${
                              pnl > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : pnl < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {fmtUsdSigned(pnl)}
                          </td>
                          <td className="p-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                            {Number.isFinite(vol) && vol > 0 ? fmtUsd(vol) : "—"}
                          </td>
                          <td className="p-2 text-right">
                            {isValidProxyAddr(wallet) ? (
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  disabled={trackingAddr === wallet.toLowerCase()}
                                  onClick={() => void addToTracker(wallet, nick)}
                                >
                                  <ListPlus className="h-3 w-3 mr-0.5 shrink-0" />
                                  Track
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 px-2 text-[11px] bg-emerald-700/90 hover:bg-emerald-800 text-white"
                                  onClick={() => openRadarAnalyze(wallet, nick)}
                                >
                                  <Radar className="h-3 w-3 mr-0.5 shrink-0" />
                                  Analyze
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredRows.length === 0 && !loading && (
                  <p className="p-4 text-sm text-muted-foreground text-center">No rows match your filter.</p>
                )}
              </div>
            )}
            {hasMore && !q && (
              <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={() => void load(false)}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 w-full max-w-full border-zinc-200/80 dark:border-zinc-700/80 min-[1180px]:sticky min-[1180px]:top-4 overflow-hidden">
          <CardHeader className="pb-2 min-w-0 space-y-1">
            <div className="flex items-start gap-2 min-w-0">
              <Trophy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-semibold whitespace-normal break-words leading-snug">
                  Biggest wins
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 break-words">{periodHeading}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 min-w-0 overflow-x-hidden">
            {winsNote && (
              <p className="text-[11px] text-muted-foreground leading-snug break-words">{winsNote}</p>
            )}
            <ul className="space-y-3 max-h-[70vh] overflow-y-auto overflow-x-hidden pr-1 min-w-0">
              {(biggestWins ?? []).map((w) => (
                <li key={`${w.rank}-${w.proxyWallet}-${w.marketTitle}`} className="flex gap-2 text-sm min-w-0">
                  <span className="text-zinc-400 tabular-nums w-5 shrink-0">{w.rank}</span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words">{w.displayName}</p>
                    {w.slug ? (
                      <Link
                        href={`https://polymarket.com/event/${w.slug}`}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline break-words inline-block max-w-full"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {w.marketTitle}
                      </Link>
                    ) : (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 break-words">{w.marketTitle}</p>
                    )}
                    <p className="text-xs mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 break-all">
                      <span className="text-zinc-500 shrink-0">{w.stakeUsd != null ? fmtUsd(w.stakeUsd) : "—"}</span>
                      <span className="text-zinc-400">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {w.payoutUsd != null ? fmtUsd(w.payoutUsd) : fmtUsd(w.realizedPnl)}
                      </span>
                    </p>
                    {isValidProxyAddr(w.proxyWallet) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[10px]"
                          disabled={trackingAddr === w.proxyWallet.toLowerCase()}
                          onClick={() => void addToTracker(w.proxyWallet, w.displayName)}
                        >
                          <ListPlus className="h-3 w-3 mr-0.5" />
                          Track
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-6 px-1.5 text-[10px] bg-emerald-700/90 hover:bg-emerald-800 text-white"
                          onClick={() => openRadarAnalyze(w.proxyWallet, w.displayName)}
                        >
                          <Radar className="h-3 w-3 mr-0.5" />
                          Analyze
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {(!biggestWins || biggestWins.length === 0) && !loading && (
              <p className="text-sm text-muted-foreground">No closed wins in this window for sampled top traders.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
