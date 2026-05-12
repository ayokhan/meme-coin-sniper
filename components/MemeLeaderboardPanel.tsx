"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, RefreshCw, Info, ExternalLink, Lock } from "lucide-react";

type Period = "24h" | "7d" | "30d";

type Row = {
  walletAddress: string;
  label: string | null;
  realizedPnlUsd: number;
  unrealizedHoldingsUsd: number;
  totalPnlUsd: number;
  volumeUsd: number;
  tradeCount: number;
  winRatePct: number | null;
  biggestWinMint: string | null;
  biggestWinSymbol: string | null;
  biggestWinPnlUsd: number | null;
  notes: string | null;
  computedAt: string;
};

type LeaderboardResponse = {
  success: boolean;
  error?: string;
  disabled?: boolean;
  locked?: boolean;
  rows?: Row[];
  period?: Period;
  isOwner?: boolean;
  lastComputedAt?: string | null;
  methodology?: string;
};

function fmtUsd(v: number | null | undefined, opts?: { signed?: boolean }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = opts?.signed ? (v > 0 ? "+" : v < 0 ? "-" : "") : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs > 0) return `${sign}$${abs.toFixed(4)}`;
  return "$0.00";
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(0)}%`;
}

function shortenWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function fmtAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MemeLeaderboardPanel() {
  const [period, setPeriod] = useState<Period>("7d");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const [methodology, setMethodology] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard?period=${p}&limit=100`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as LeaderboardResponse;
      if (!data.success) {
        setRows([]);
        setLocked(!!data.locked);
        setDisabled(!!data.disabled);
        setError(data.error ?? "Failed to load leaderboard.");
        return;
      }
      setLocked(false);
      setDisabled(false);
      setRows(data.rows ?? []);
      setIsOwner(!!data.isOwner);
      setLastComputedAt(data.lastComputedAt ?? null);
      setMethodology(data.methodology ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(period);
  }, [fetchData, period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/refresh?period=${period}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        refreshed?: number;
        totalWallets?: number;
        error?: string;
      };
      if (!data.success) {
        setRefreshMsg(data.error ?? "Refresh failed.");
      } else {
        setRefreshMsg(`Refreshed ${data.refreshed ?? 0} / ${data.totalWallets ?? 0} wallets.`);
        await fetchData(period);
      }
    } catch (err) {
      setRefreshMsg(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, period]);

  const totals = useMemo(() => {
    if (rows.length === 0) return null;
    const totalPnl = rows.reduce((a, r) => a + r.totalPnlUsd, 0);
    const totalVol = rows.reduce((a, r) => a + r.volumeUsd, 0);
    const winRates = rows.map((r) => r.winRatePct).filter((v): v is number => v !== null);
    const avgWin = winRates.length > 0 ? winRates.reduce((a, v) => a + v, 0) / winRates.length : null;
    return { totalPnl, totalVol, avgWin };
  }, [rows]);

  if (disabled) {
    return (
      <Card className="border-amber-300/60 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-900/10">
        <CardContent className="p-6 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-300 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-200">Meme Leaderboard is disabled</p>
            <p className="text-sm text-muted-foreground mt-1">
              Owner can turn it on in Nova Admin → Feature flags → &quot;Meme Leaderboard (Wallet Tracker)&quot;.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (locked) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
          <p className="font-semibold">Meme Coins Traders on-demand access required</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact admin to enable Meme Coins Traders on your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-500" />
              Meme Leaderboard
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList className="bg-zinc-100 dark:bg-zinc-800">
                  <TabsTrigger value="24h">24h</TabsTrigger>
                  <TabsTrigger value="7d">7d</TabsTrigger>
                  <TabsTrigger value="30d">30d</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchData(period)}
                disabled={loading || refreshing}
              >
                {loading ? "Loading…" : "Reload"}
              </Button>
              {isOwner && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  onClick={onRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing…" : "Recompute snapshots"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <div className="text-xs text-muted-foreground">Aggregate PnL ({period})</div>
              <div className={`text-lg font-bold ${totals && totals.totalPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {totals ? fmtUsd(totals.totalPnl, { signed: true }) : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <div className="text-xs text-muted-foreground">Aggregate volume</div>
              <div className="text-lg font-bold">{totals ? fmtUsd(totals.totalVol) : "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <div className="text-xs text-muted-foreground">Avg win rate</div>
              <div className="text-lg font-bold">{totals ? fmtPct(totals.avgWin) : "—"}</div>
            </div>
          </div>

          {refreshMsg && (
            <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-900/20 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200">
              {refreshMsg}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Total PnL</TableHead>
                  <TableHead className="text-right">Realized</TableHead>
                  <TableHead className="text-right">Holdings</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead>Biggest win</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {loading
                        ? "Loading…"
                        : isOwner
                          ? "No snapshots yet. Click \"Recompute snapshots\" to build the first leaderboard."
                          : "No snapshots yet. Ask admin to recompute."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={r.walletAddress}>
                      <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.label || shortenWallet(r.walletAddress)}</div>
                        {r.label && (
                          <div className="text-xs text-muted-foreground font-mono">{shortenWallet(r.walletAddress)}</div>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${r.totalPnlUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {fmtUsd(r.totalPnlUsd, { signed: true })}
                      </TableCell>
                      <TableCell className={`text-right ${r.realizedPnlUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {fmtUsd(r.realizedPnlUsd, { signed: true })}
                      </TableCell>
                      <TableCell className="text-right">{fmtUsd(r.unrealizedHoldingsUsd)}</TableCell>
                      <TableCell className="text-right">{fmtUsd(r.volumeUsd)}</TableCell>
                      <TableCell className="text-right">{r.tradeCount}</TableCell>
                      <TableCell className="text-right">{fmtPct(r.winRatePct)}</TableCell>
                      <TableCell>
                        {r.biggestWinSymbol || r.biggestWinMint ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">
                              {r.biggestWinSymbol ?? shortenWallet(r.biggestWinMint ?? "")}
                            </span>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              {fmtUsd(r.biggestWinPnlUsd, { signed: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`https://solscan.io/account/${r.walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                          >
                            Solscan <ExternalLink className="h-3 w-3" />
                          </a>
                          {r.biggestWinMint && (
                            <a
                              href={`https://dexscreener.com/solana/${r.biggestWinMint}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                            >
                              Dex <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              Last computed: <span className="font-medium">{fmtAgo(lastComputedAt) ?? "never"}</span>
              {lastComputedAt ? ` (${new Date(lastComputedAt).toLocaleString()})` : ""}
            </p>
            {methodology && (
              <p className="leading-relaxed">
                <Info className="inline h-3 w-3 mr-1 -mt-0.5" />
                {methodology}
              </p>
            )}
            <p>
              How successful traders find these coins: they monitor first-buys from known smart-money wallets,
              watch Telegram/Twitter for early calls, screen Pump.fun &amp; Raydium pools for sudden volume +
              liquidity spikes, and route micro-buys when 3+ tracked wallets enter the same token. NovaStaris
              already automates the wallet-tracking and 3+ buyer alerts above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
