"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Copy, ListPlus, Radar, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  aggregateTradesStats,
  tradeTimestampToMs,
  type PolymarketTradeRow,
} from "@/lib/polymarket-data-api";
import { NOVASTARIS_POLY_RADAR_ANALYZE_WALLET } from "@/lib/novastaris-polymarket-events";

const PREFILL_EVENT = "novastaris-poly-prefill-copy-wallet";

function isValidAddr(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

function formatLocal(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function fmtUsd(n: number | null, maxFrac = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 })}`;
}

function fmtNum(n: number | null, maxFrac = 4) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

type AnalyzeJson = {
  success?: boolean;
  error?: string;
  address?: string;
  valueUsd?: number | null;
  positionCount?: number;
  closedPositionCount?: number;
  positions?: Array<{ title?: string; outcome?: string; size?: number; currentValue?: number; cashPnl?: number }>;
  closedPositions?: Array<{
    title?: string;
    outcome?: string;
    avgPrice?: number;
    realizedPnl?: number;
    timestamp?: number;
  }>;
  closedStats?: {
    total: number;
    wins: number;
    losses: number;
    zero: number;
    winRate: number | null;
    totalRealizedPnl: number;
    avgRealizedPnl: number | null;
  };
  trades?: PolymarketTradeRow[];
  tradeStats?: { tradeCount: number; volumeUsd: number; totalShares: number; netFlowUsd: number };
  tradeStatsNote?: string;
  tradesHasMore?: boolean;
  nextTradeOffset?: number;
  polymarketProfileUrl?: string;
};

type RadarTopicJson = {
  success?: boolean;
  error?: string;
  topic?: string;
  scannedWallets?: number;
  predictedWinRate?: number;
  recommendation?: string;
  topTraderSignal?: "bullish" | "bearish" | "mixed";
  bullishCount?: number;
  bearishCount?: number;
  neutralCount?: number;
  note?: string;
  topWallets?: Array<{
    address: string;
    nickname: string | null;
    topicTradeCount: number;
    buyCount: number;
    sellCount: number;
    topicWinRate: number | null;
    topicNetFlowUsd: number;
  }>;
};

export type PolymarketRadarAnalyzeHandoff = {
  address: string;
  nickname?: string | null;
  key: number;
};

export default function NovaPolymarketCopyBotPanel({
  analyzeHandoff = null,
  onAnalyzeHandoffConsumed,
}: {
  analyzeHandoff?: PolymarketRadarAnalyzeHandoff | null;
  onAnalyzeHandoffConsumed?: () => void;
} = {}) {
  const [addrInput, setAddrInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analyzed, setAnalyzed] = useState<AnalyzeJson | null>(null);
  const [allTrades, setAllTrades] = useState<PolymarketTradeRow[]>([]);
  const [nextTradeOffset, setNextTradeOffset] = useState(0);
  const [tradesHasMore, setTradesHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mergedStats, setMergedStats] = useState<ReturnType<typeof aggregateTradesStats> | null>(null);

  const [addingTracker, setAddingTracker] = useState(false);
  const [trackerMsg, setTrackerMsg] = useState<string | null>(null);
  /** Nickname saved with My Tracker — prefilled from Elite / Leaderboard Analyze handoff. */
  const [trackerNicknameInput, setTrackerNicknameInput] = useState("");
  const [topic, setTopic] = useState("");
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicResult, setTopicResult] = useState<RadarTopicJson | null>(null);

  const runAnalyzeForAddress = useCallback(async (rawInput: string, reset = true) => {
    const raw = rawInput.trim();
    if (!isValidAddr(raw)) {
      setError("Enter a valid Polymarket proxy wallet (0x + 40 hex chars).");
      return;
    }
    const address = raw.toLowerCase();
    setLoading(true);
    setError(null);
    setTrackerMsg(null);
    try {
      const res = await fetch(
        `/api/polymarket-copy/analyze?address=${encodeURIComponent(address)}&tradeLimit=100&tradeOffset=0`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as AnalyzeJson;
      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`);
        if (reset) setAnalyzed(null);
        return;
      }
      if (!data.success) {
        setError(data.error ?? "Analyze failed");
        if (reset) setAnalyzed(null);
        return;
      }
      const trades = Array.isArray(data.trades) ? data.trades : [];
      setAnalyzed(data);
      setAllTrades(trades);
      setNextTradeOffset(typeof data.nextTradeOffset === "number" ? data.nextTradeOffset : trades.length);
      setTradesHasMore(!!data.tradesHasMore);
      setMergedStats(aggregateTradesStats(trades));
    } catch {
      setError("Network error.");
      if (reset) setAnalyzed(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAnalyze = useCallback(
    async (reset = true) => {
      await runAnalyzeForAddress(addrInput, reset);
    },
    [addrInput, runAnalyzeForAddress]
  );

  const clearWalletAnalysis = useCallback(() => {
    setAnalyzed(null);
    setAllTrades([]);
    setNextTradeOffset(0);
    setTradesHasMore(false);
    setLoadingMore(false);
    setMergedStats(null);
    setError(null);
    setTrackerMsg(null);
  }, []);

  const clearTopicRadar = useCallback(() => {
    setTopicResult(null);
    setError(null);
  }, []);

  const clearAllResults = useCallback(() => {
    clearWalletAnalysis();
    clearTopicRadar();
  }, [clearWalletAnalysis, clearTopicRadar]);

  const hasWalletAnalysis = !!analyzed?.address;
  const hasTopicResult = !!topicResult;

  useEffect(() => {
    if (!analyzeHandoff?.address || !isValidAddr(analyzeHandoff.address)) return;
    const lower = analyzeHandoff.address.toLowerCase();
    const nick = analyzeHandoff.nickname?.trim().slice(0, 120) ?? "";
    setAddrInput(lower);
    if (nick) setTrackerNicknameInput(nick);
    void runAnalyzeForAddress(lower, true);
    onAnalyzeHandoffConsumed?.();
  }, [analyzeHandoff?.key, analyzeHandoff?.address, analyzeHandoff?.nickname, runAnalyzeForAddress, onAnalyzeHandoffConsumed]);

  useEffect(() => {
    const onExternalAnalyze = (e: Event) => {
      const ce = e as CustomEvent<{ address?: string; nickname?: string | null; autoRun?: boolean }>;
      const addr = ce.detail?.address?.trim() ?? "";
      if (!isValidAddr(addr)) return;
      const lower = addr.toLowerCase();
      const nick = ce.detail?.nickname?.trim().slice(0, 120) ?? "";
      setAddrInput(lower);
      if (nick) setTrackerNicknameInput(nick);
      if (ce.detail?.autoRun) void runAnalyzeForAddress(lower, true);
    };
    window.addEventListener(NOVASTARIS_POLY_RADAR_ANALYZE_WALLET, onExternalAnalyze as EventListener);
    return () => window.removeEventListener(NOVASTARIS_POLY_RADAR_ANALYZE_WALLET, onExternalAnalyze as EventListener);
  }, [runAnalyzeForAddress]);

  const loadMoreTrades = useCallback(async () => {
    const address = analyzed?.address;
    if (!address || !tradesHasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/polymarket-copy/analyze?address=${encodeURIComponent(address)}&tradeLimit=100&tradeOffset=${nextTradeOffset}&fields=trades`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as AnalyzeJson;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Could not load more trades.");
        return;
      }
      const newT = Array.isArray(data.trades) ? data.trades : [];
      setAllTrades((prev) => {
        const merged = [...prev, ...newT];
        setMergedStats(aggregateTradesStats(merged));
        return merged;
      });
      setNextTradeOffset(typeof data.nextTradeOffset === "number" ? data.nextTradeOffset : nextTradeOffset + newT.length);
      setTradesHasMore(!!data.tradesHasMore);
    } catch {
      setError("Could not load more trades.");
    } finally {
      setLoadingMore(false);
    }
  }, [analyzed?.address, tradesHasMore, loadingMore, nextTradeOffset]);

  const copyAddress = async () => {
    const a = analyzed?.address ?? (isValidAddr(addrInput) ? addrInput.trim() : "");
    if (!a) return;
    try {
      await navigator.clipboard.writeText(a);
      setTrackerMsg("Address copied to clipboard.");
    } catch {
      setTrackerMsg("Could not copy (clipboard permission).");
    }
  };

  const sendToCopilot = () => {
    const a = analyzed?.address ?? (isValidAddr(addrInput) ? addrInput.trim().toLowerCase() : "");
    if (!a || !isValidAddr(a)) return;
    window.dispatchEvent(new CustomEvent(PREFILL_EVENT, { detail: { address: a.toLowerCase() } }));
    setTrackerMsg("Opened Polymarket Copilot tab with this wallet added to copy-trader list.");
  };

  const addToMyTracker = async () => {
    const a = analyzed?.address ?? (isValidAddr(addrInput) ? addrInput.trim().toLowerCase() : "");
    if (!a || !isValidAddr(a)) return;
    const nick = trackerNicknameInput.trim().slice(0, 120) || null;
    setAddingTracker(true);
    setTrackerMsg(null);
    try {
      const res = await fetch("/api/user/polymarket-tracker-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: a, nickname: nick }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTrackerMsg(
          nick
            ? `Added ${nick} to My tracked wallets (Nova Polymarket Tracker).`
            : "Wallet added to My tracked wallets (Nova Polymarket Tracker)."
        );
      } else setTrackerMsg(data.error ?? "Could not add wallet.");
    } catch {
      setTrackerMsg("Could not add wallet.");
    } finally {
      setAddingTracker(false);
    }
  };

  const runTopicRadar = useCallback(async () => {
    const q = topic.trim();
    if (q.length < 2) {
      setError("Topic must be at least 2 characters.");
      return;
    }
    setTopicLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/polymarket-radar/topic?topic=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = (await res.json()) as RadarTopicJson;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Topic radar failed.");
        return;
      }
      setTopicResult(data);
    } catch {
      setError("Topic radar failed.");
    } finally {
      setTopicLoading(false);
    }
  }, [topic]);

  const closed = analyzed?.closedPositions ?? [];
  const cs = analyzed?.closedStats;
  const wins = cs?.wins ?? closed.filter((c) => Number(c.realizedPnl ?? 0) > 0).length;
  const losses = cs?.losses ?? closed.filter((c) => Number(c.realizedPnl ?? 0) < 0).length;
  const closedCount = cs?.total ?? closed.length;
  // Win rate is decided outcomes only (wins / (wins + losses)); ties/zero-PnL excluded.
  const winRate = cs?.winRate ?? (wins + losses > 0 ? (wins / (wins + losses)) * 100 : null);
  const totalRealizedPnl =
    cs?.totalRealizedPnl ??
    (closed.reduce((acc, c) => acc + (Number.isFinite(Number(c.realizedPnl)) ? Number(c.realizedPnl) : 0), 0) || 0);
  const avgRealizedPnl = cs?.avgRealizedPnl ?? (closedCount > 0 ? totalRealizedPnl / closedCount : null);

  return (
    <div className="space-y-4">
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 border-emerald-200/50 dark:border-emerald-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Radar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Polymarket Radar (VIP)
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste a wallet to analyze position quality, realized outcomes, and execution style. Then run topic radar to
            estimate directional edge from what tracked top traders are doing around that topic.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-zinc-800 dark:text-zinc-200">Decision support, not financial advice.</strong>{" "}
              Radar reads public Polymarket data to rank behavior patterns and topic bias.
            </p>
            <p>
              You can copy-trade workflow from here by sending the wallet to Copilot, but final execution still happens
              on Polymarket with your wallet confirmation.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Target proxy wallet</label>
            <div className="flex flex-wrap gap-2">
              <input
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value)}
                placeholder="0x…"
                className="min-w-[220px] flex-1 h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm font-mono"
              />
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
                onClick={() => void runAnalyze(true)}
              >
                {loading ? "Analyzing…" : "Analyze wallet"}
              </Button>
              {hasWalletAnalysis && (
                <Button type="button" size="sm" variant="outline" disabled={loading} onClick={clearWalletAnalysis}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Polymarket Radar topic</label>
            <div className="flex flex-wrap gap-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. bitcoin, fed, election, tariffs"
                className="min-w-[220px] flex-1 h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
              />
              <Button type="button" size="sm" variant="outline" disabled={topicLoading} onClick={() => void runTopicRadar()}>
                <Search className="h-3.5 w-3.5 mr-1" />
                {topicLoading ? "Scanning..." : "Run topic radar"}
              </Button>
              {hasTopicResult && (
                <Button type="button" size="sm" variant="outline" disabled={topicLoading} onClick={clearTopicRadar}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            {topicResult && (
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Topic signal: {topicResult.topic} · {topicResult.topTraderSignal ?? "mixed"} ·{" "}
                  Predicted win rate {fmtNum(topicResult.predictedWinRate ?? null, 1)}%
                </p>
                <p className="text-xs text-muted-foreground">{topicResult.recommendation}</p>
                <p className="text-xs text-muted-foreground">
                  Trader votes: Bullish {topicResult.bullishCount ?? 0} · Bearish {topicResult.bearishCount ?? 0} · Mixed{" "}
                  {topicResult.neutralCount ?? 0} · Wallets scanned {topicResult.scannedWallets ?? 0}
                </p>
                {(topicResult.topWallets ?? []).length > 0 && (
                  <div className="space-y-1 pt-1">
                    {(topicResult.topWallets ?? []).map((w) => (
                      <div key={w.address} className="text-xs rounded border border-zinc-200 dark:border-zinc-700 p-2">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">
                          {w.nickname ?? w.address} · Trades {w.topicTradeCount}
                        </p>
                        <p className="text-muted-foreground">
                          Buys {w.buyCount} / Sells {w.sellCount} · Topic win rate{" "}
                          {w.topicWinRate == null ? "—" : `${fmtNum(w.topicWinRate, 1)}%`} · Net flow {fmtUsd(w.topicNetFlowUsd, 2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {topicResult.note && <p className="text-[11px] text-muted-foreground">{topicResult.note}</p>}
              </div>
            )}
          </div>

          {(hasWalletAnalysis || hasTopicResult) && (
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clearAllResults}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear all results
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {trackerMsg && <p className="text-xs text-emerald-700 dark:text-emerald-300">{trackerMsg}</p>}

          {analyzed && analyzed.address && (
            <div className="space-y-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {analyzed.address}
                </Badge>
                {analyzed.polymarketProfileUrl && (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <a href={analyzed.polymarketProfileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Polymarket profile
                    </a>
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => void copyAddress()}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy address
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={clearWalletAnalysis}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear analysis
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Portfolio</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtUsd(analyzed.valueUsd ?? null)}</p>
                </div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Open positions</p>
                  <p className="text-sm font-semibold tabular-nums">{analyzed.positionCount ?? "—"}</p>
                </div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Closed positions</p>
                  <p className="text-sm font-semibold tabular-nums">{closedCount || "—"}</p>
                </div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Win rate</p>
                  <p className="text-sm font-semibold tabular-nums">{winRate == null ? "—" : `${fmtNum(winRate, 1)}%`}</p>
                </div>
              </div>

              {mergedStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Volume (Σ |size×price|)</p>
                    <p className="text-sm font-semibold tabular-nums">{fmtUsd(mergedStats.volumeUsd)}</p>
                  </div>
                  <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Amount (Σ |size|)</p>
                    <p className="text-sm font-semibold tabular-nums">{fmtNum(mergedStats.totalShares)}</p>
                  </div>
                  <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Net buy flow</p>
                    <p className="text-sm font-semibold tabular-nums">{fmtUsd(mergedStats.netFlowUsd)}</p>
                  </div>
                  <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Avg realized PnL</p>
                    <p className="text-sm font-semibold tabular-nums">{fmtUsd(avgRealizedPnl, 2)}</p>
                  </div>
                </div>
              )}
              {analyzed.tradeStatsNote && <p className="text-[10px] text-muted-foreground">{analyzed.tradeStatsNote}</p>}
              <p className="text-[10px] text-muted-foreground">
                Closed outcomes: Wins {wins} · Losses {losses}
                {cs && cs.zero > 0 ? ` · Ties ${cs.zero}` : ""} · Total {closedCount}. Win rate = wins ÷ (wins + losses)
                across the wallet&apos;s full closed-position history from Polymarket.
              </p>

              <div>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Use this wallet in Nova Polymarket</p>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end mb-2">
                  <div className="flex flex-col min-w-[160px] flex-1 max-w-xs">
                    <label className="text-[10px] text-muted-foreground mb-1">Tracker nickname (optional)</label>
                    <input
                      value={trackerNicknameInput}
                      onChange={(e) => setTrackerNicknameInput(e.target.value.slice(0, 120))}
                      placeholder="e.g. trader username"
                      className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="default" className="bg-violet-600 hover:bg-violet-700" onClick={sendToCopilot}>
                      Add to Polymarket Copilot
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={addingTracker} onClick={() => void addToMyTracker()}>
                      <ListPlus className="h-3.5 w-3.5 mr-1" />
                      {addingTracker ? "Adding…" : "Add to My Tracker"}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Copilot appends this wallet to your copy-trader list; Tracker saves it in your personal list for ongoing monitoring.
                  Nickname is prefilled when you open Analyze from Elite or Leaderboard.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 max-h-64 overflow-y-auto">
                  <p className="text-xs font-medium mb-2">Current positions (sample)</p>
                  <ul className="space-y-1 text-xs">
                    {(analyzed.positions ?? []).length === 0 ? (
                      <li className="text-muted-foreground">None returned.</li>
                    ) : (
                      analyzed.positions!.map((p, i) => (
                        <li key={i} className="border-b border-zinc-100 dark:border-zinc-800 pb-1">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{p.title ?? "—"}</span>
                          {p.outcome != null && <span className="text-muted-foreground"> — {p.outcome}</span>}
                          <span className="block text-muted-foreground tabular-nums">
                            Size {fmtNum(p.size ?? null)} · {fmtUsd(p.currentValue ?? null)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 max-h-64 overflow-y-auto">
                  <p className="text-xs font-medium mb-2">Trade tape (local time)</p>
                  <ul className="space-y-1 text-xs">
                    {allTrades.length === 0 ? (
                      <li className="text-muted-foreground">No fills in loaded pages.</li>
                    ) : (
                      allTrades.map((tr, i) => {
                        const tms = tradeTimestampToMs(tr.timestamp);
                        const slug = typeof tr.slug === "string" ? tr.slug : "";
                        const href = slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : analyzed.polymarketProfileUrl;
                        return (
                          <li key={`${i}-${tr.transactionHash ?? i}`} className="border-b border-zinc-100 dark:border-zinc-800 pb-1">
                            <div className="flex justify-between gap-2">
                              <span
                                className={
                                  String(tr.side).toUpperCase() === "BUY"
                                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                    : "text-rose-600 dark:text-rose-400 font-medium"
                                }
                              >
                                {tr.side ?? "—"}
                              </span>
                              <span className="text-muted-foreground shrink-0">{formatLocal(tms)}</span>
                            </div>
                            <p className="text-zinc-800 dark:text-zinc-200">{tr.title ?? "—"}</p>
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 text-[11px] hover:underline">
                                Open market / profile
                              </a>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                  {tradesHasMore && (
                    <Button type="button" size="sm" variant="outline" className="mt-2 w-full" disabled={loadingMore} onClick={() => void loadMoreTrades()}>
                      {loadingMore ? "Loading…" : "Load older fills"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
