"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  ExternalLink,
  ListPlus,
  Radar,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PolymarketLeaderboardCategory } from "@/lib/polymarket-data-api";
import type { EliteConsensusSignal, EliteTrader } from "@/lib/polymarket-elite";
import { NOVASTARIS_POLY_OPEN_RADAR_ANALYZE } from "@/lib/novastaris-polymarket-events";

type TimeUi = "DAY" | "WEEK" | "MONTH" | "ALL";

type SignalsJson = {
  success?: boolean;
  error?: string;
  eliteDisabled?: boolean;
  category?: string;
  timePeriod?: string;
  lookbackHours?: number;
  eliteTraders?: EliteTrader[];
  signals?: EliteConsensusSignal[];
  scannedAt?: string;
  note?: string;
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
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

function fmtLocalTime(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NovaPolymarketElitePanel() {
  const [timePeriod, setTimePeriod] = useState<TimeUi>("WEEK");
  const [category, setCategory] = useState<PolymarketLeaderboardCategory>("OVERALL");
  const [eliteTraders, setEliteTraders] = useState<EliteTrader[]>([]);
  const [signals, setSignals] = useState<EliteConsensusSignal[]>([]);
  const [lookbackHours, setLookbackHours] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [trackingAddr, setTrackingAddr] = useState<string | null>(null);

  useEffect(() => {
    if (!actionToast) return;
    const t = window.setTimeout(() => setActionToast(null), 5000);
    return () => clearTimeout(t);
  }, [actionToast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ category, timePeriod });
      const res = await fetch(`/api/polymarket-elite/signals?${q.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as SignalsJson;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to load elite signals.");
        setEliteTraders([]);
        setSignals([]);
        return;
      }
      setEliteTraders(data.eliteTraders ?? []);
      setSignals(data.signals ?? []);
      setLookbackHours(data.lookbackHours ?? null);
      setNote(data.note ?? null);
      setScannedAt(data.scannedAt ?? null);
    } catch {
      setError("Failed to load elite signals.");
      setEliteTraders([]);
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [category, timePeriod]);

  useEffect(() => {
    void load();
  }, [load]);

  const addToTracker = async (wallet: string) => {
    setTrackingAddr(wallet);
    try {
      const res = await fetch("/api/user/polymarket-tracker-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setActionToast(j.error ?? "Could not add wallet to tracker.");
        return;
      }
      setActionToast("Wallet added to Polymarket Tracker.");
    } catch {
      setActionToast("Could not add wallet to tracker.");
    } finally {
      setTrackingAddr(null);
    }
  };

  const openRadarAnalyze = (wallet: string) => {
    window.dispatchEvent(
      new CustomEvent(NOVASTARIS_POLY_OPEN_RADAR_ANALYZE, { detail: { wallet } })
    );
    setActionToast("Opening Polymarket Radar to analyze this wallet…");
  };

  const buySignals = signals.filter((s) => s.side === "BUY");
  const sellSignals = signals.filter((s) => s.side === "SELL");

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Polymarket Elite
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            We pull the Polymarket leaderboard, rank the top profitable traders by volume + P/L, then surface markets where multiple elites are taking the{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">same side</strong> — that overlap is your signal.
          </p>
          <ol className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5 list-decimal list-inside">
            <li>Leaderboard → top 5 elite wallets (profit + volume)</li>
            <li>Scan their recent trades</li>
            <li>Highlight markets where 2+ elites align on the same outcome</li>
          </ol>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Scan
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="https://polymarket.com/leaderboard" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Leaderboard
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
      </div>

      {actionToast && (
        <div className="rounded-md border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100 break-words">
          {actionToast}
        </div>
      )}

      {scannedAt && !loading && (
        <p className="text-xs text-muted-foreground">
          Last scan: {new Date(scannedAt).toLocaleString()}
          {lookbackHours != null ? ` · Trade window: last ${lookbackHours}h` : null}
        </p>
      )}

      <div className="min-w-0 grid grid-cols-1 min-[1180px]:grid-cols-[minmax(0,1fr)_18rem] gap-4 items-start">
        <Card className="min-w-0 border-zinc-200/80 dark:border-zinc-700/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Elite consensus signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground">Scanning leaderboard and elite wallets…</p>
            ) : buySignals.length === 0 && sellSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No overlapping trades among the current elite set in this window. Try Weekly or Monthly, or scan again later.
              </p>
            ) : (
              <>
                {buySignals.length > 0 && (
                  <SignalSection title="Buy consensus" signals={buySignals} onTrack={addToTracker} onAnalyze={openRadarAnalyze} trackingAddr={trackingAddr} />
                )}
                {sellSignals.length > 0 && (
                  <SignalSection title="Sell consensus" signals={sellSignals} onTrack={addToTracker} onAnalyze={openRadarAnalyze} trackingAddr={trackingAddr} />
                )}
              </>
            )}
            {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-500" />
              Elite traders (top 5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : eliteTraders.length === 0 ? (
              <p className="text-xs text-muted-foreground">No profitable traders found for this period.</p>
            ) : (
              eliteTraders.map((t) => (
                <div
                  key={t.proxyWallet}
                  className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 p-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      #{t.rank} {t.displayName}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Elite
                    </Badge>
                  </div>
                  <p className="text-muted-foreground font-mono truncate">{t.proxyWallet}</p>
                  <p>
                    P/L {fmtUsdSigned(t.pnl)} · Vol {fmtUsd(t.vol)}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      disabled={trackingAddr === t.proxyWallet}
                      onClick={() => void addToTracker(t.proxyWallet)}
                    >
                      <ListPlus className="h-3 w-3 mr-0.5" />
                      Track
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => openRadarAnalyze(t.proxyWallet)}
                    >
                      <Radar className="h-3 w-3 mr-0.5" />
                      Analyze
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignalSection({
  title,
  signals,
  onTrack,
  onAnalyze,
  trackingAddr,
}: {
  title: string;
  signals: EliteConsensusSignal[];
  onTrack: (wallet: string) => void;
  onAnalyze: (wallet: string) => void;
  trackingAddr: string | null;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</h4>
      {signals.map((s) => (
        <div
          key={`${s.slug}-${s.outcome}-${s.side}`}
          className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 leading-snug">{s.title}</p>
              <p className="text-sm text-cyan-700 dark:text-cyan-300 mt-0.5">
                {s.side} · <strong>{s.outcome}</strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <Badge
                className={
                  s.strength === "strong"
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                    : "bg-amber-500 hover:bg-amber-500 text-white"
                }
              >
                {s.strength === "strong" ? "Strong" : "Moderate"}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {s.walletCount} elites
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Notional ~{fmtUsd(s.totalNotionalUsd)}</span>
            <span>Last activity {fmtLocalTime(s.lastActivityMs)}</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8" asChild>
            <Link href={s.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Open market
            </Link>
          </Button>
          <div className="border-t border-zinc-200/80 dark:border-zinc-700/80 pt-2 space-y-1.5">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Wallets on this signal</p>
            {s.wallets.map((w) => (
              <div
                key={w.address}
                className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-md bg-white/60 dark:bg-zinc-950/40 px-2 py-1.5 border border-zinc-100 dark:border-zinc-800"
              >
                <span className="truncate">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{w.displayName}</span>
                  <span className="text-muted-foreground ml-1">
                    · {w.buyCount} buy{w.buyCount !== 1 ? "s" : ""}
                    {w.sellCount > 0 ? ` / ${w.sellCount} sell` : ""} · {fmtUsd(w.notionalUsd)}
                  </span>
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    disabled={trackingAddr === w.address}
                    onClick={() => onTrack(w.address)}
                  >
                    Track
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => onAnalyze(w.address)}>
                    Analyze
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
