"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Star, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FAVORITES_LS_KEY = "novastaris-polymarket-tracker-favorites";

type TraderRow = {
  address: string;
  nickname: string | null;
  isGlobal: boolean;
  source: "admin" | "user";
  valueUsd: number | null;
  positionCount: number;
  lastTradeTimeMs: number | null;
};

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

function shortAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsd(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtTime(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function NovaPolymarketTrackerPanel() {
  const { data: session } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;

  const [traders, setTraders] = useState<TraderRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [disabledByFlag, setDisabledByFlag] = useState(false);

  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteSet());

  const [expanded, setExpanded] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [trades, setTrades] = useState<
    Array<{ side?: string; title?: string; outcome?: string; size?: number; price?: number; timestamp?: number }>
  >([]);
  const [positions, setPositions] = useState<
    Array<{ title?: string; outcome?: string; size?: number; currentValue?: number; cashPnl?: number }>
  >([]);

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

  useEffect(() => {
    void fetchList();
    void fetchMyWallets();
  }, [fetchList, fetchMyWallets]);

  useEffect(() => {
    setFavorites(loadFavoriteSet());
  }, []);

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

  const openActivity = async (address: string) => {
    if (expanded === address) {
      setExpanded(null);
      return;
    }
    setExpanded(address);
    setActivityLoading(true);
    setActivityError(null);
    setTrades([]);
    setPositions([]);
    try {
      const res = await fetch(
        `/api/polymarket-tracker/activity?address=${encodeURIComponent(address)}&type=all&limit=40`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setActivityError(data?.error ?? `Error ${res.status}`);
        return;
      }
      setTrades(Array.isArray(data.trades) ? data.trades : []);
      setPositions(Array.isArray(data.positions) ? data.positions : []);
    } catch {
      setActivityError("Failed to load trades/positions.");
    } finally {
      setActivityLoading(false);
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
            Top Polymarket proxy wallets curated by admin, plus your own addresses. Data comes from Polymarket&apos;s
            public <span className="font-mono">data-api.polymarket.com</span>. To discover addresses, use independent
            leaderboards or research tools (for example community sites like{" "}
            <a
              href="https://polymonit.com/leaderboard/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-600 dark:text-cyan-400 underline"
            >
              Polymonit
            </a>
            )—verify each wallet before trusting; we do not scrape or endorse third parties.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchList()} disabled={listLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${listLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {isOwner && (
              <Button type="button" size="sm" variant="secondary" asChild>
                <Link href="/admin/polymarket-tracker">Admin: manage wallets</Link>
              </Button>
            )}
          </div>
          {listError && <p className="text-sm text-rose-600 dark:text-rose-400">{listError}</p>}

          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50">
                  <th className="text-left p-2 w-10" aria-label="Favorite" />
                  <th className="text-left p-2">Label</th>
                  <th className="text-left p-2">Address</th>
                  <th className="text-right p-2">Portfolio</th>
                  <th className="text-right p-2">Positions</th>
                  <th className="text-left p-2">Last trade</th>
                  <th className="text-left p-2">Source</th>
                  <th className="text-left p-2">Activity</th>
                </tr>
              </thead>
              <tbody>
                {sortedTraders.length === 0 && !listLoading ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
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
                          <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{fmtTime(t.lastTradeTimeMs)}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs">
                              {t.source === "admin" ? (t.isGlobal ? "Global" : "Admin") : "My list"}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => void openActivity(t.address)}>
                              {expanded === t.address ? "Hide" : "Trades"}
                            </Button>
                          </td>
                        </tr>
                        {expanded === t.address && (
                          <tr className="bg-zinc-50/50 dark:bg-zinc-900/40">
                            <td colSpan={8} className="p-3 text-xs">
                              {activityLoading && <p className="text-muted-foreground">Loading activity…</p>}
                              {activityError && <p className="text-rose-600 dark:text-rose-400">{activityError}</p>}
                              {!activityLoading && !activityError && (
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Recent trades</p>
                                    <ul className="space-y-1 max-h-56 overflow-y-auto">
                                      {trades.length === 0 ? (
                                        <li className="text-muted-foreground">No recent trades returned.</li>
                                      ) : (
                                        trades.map((tr, i) => (
                                          <li key={i} className="border-b border-zinc-200/60 dark:border-zinc-700/60 pb-1">
                                            <span className="font-medium">{tr.side ?? "?"}</span>{" "}
                                            <span className="text-zinc-700 dark:text-zinc-300">{tr.title ?? "—"}</span>
                                            {tr.outcome != null && (
                                              <span className="text-muted-foreground"> ({tr.outcome})</span>
                                            )}
                                            <span className="block text-muted-foreground tabular-nums">
                                              size {tr.size ?? "—"} @ {tr.price ?? "—"}
                                            </span>
                                          </li>
                                        ))
                                      )}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Open positions</p>
                                    <ul className="space-y-1 max-h-56 overflow-y-auto">
                                      {positions.length === 0 ? (
                                        <li className="text-muted-foreground">No open positions (or below threshold).</li>
                                      ) : (
                                        positions.map((p, i) => (
                                          <li key={i} className="border-b border-zinc-200/60 dark:border-zinc-700/60 pb-1">
                                            <span className="text-zinc-800 dark:text-zinc-200">{p.title ?? "—"}</span>
                                            {p.outcome != null && (
                                              <span className="text-muted-foreground"> — {p.outcome}</span>
                                            )}
                                            <span className="block text-muted-foreground tabular-nums">
                                              size {p.size ?? "—"} · value {fmtUsd(p.currentValue ?? null)}
                                              {p.cashPnl != null && Number.isFinite(p.cashPnl) && (
                                                <span> · PnL {fmtUsd(p.cashPnl)}</span>
                                              )}
                                            </span>
                                          </li>
                                        ))
                                      )}
                                    </ul>
                                  </div>
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
