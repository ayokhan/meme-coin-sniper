"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Bell, BellOff, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NOVA_FIVE_MINS_HORIZONS, type NovaFiveMinsHorizonMinutes } from "@/lib/nova-five-mins-spot";

type TapeRegime = "up_slope" | "down_slope" | "sideways" | "mixed";

type AnalyzeJson = {
  success?: boolean;
  error?: string;
  fiveMinsDisabled?: boolean;
  pair?: string;
  symbolInput?: string;
  horizonMinutes?: number;
  lastClose?: number | null;
  benchmarkOpen?: number | null;
  /** @deprecated use benchmarkOpen */
  benchmarkOpen5m?: number | null;
  alignedWithSignal?: boolean;
  tapeRegime?: TapeRegime;
  feed?: string;
  canSubmitOwnerFeedback?: boolean;
  dataSourceNote?: string;
  polymarketStyleUrl?: string;
  direction?: "Up" | "Down" | "Unclear";
  confidencePct?: number;
  summary?: string;
  factors?: string[];
  riskNote?: string;
};

const TAPE_REGIME_LABEL: Record<TapeRegime, string> = {
  up_slope: "Tape: trending up",
  down_slope: "Tape: trending down",
  sideways: "Tape: sideways / range",
  mixed: "Tape: mixed — two-way",
};

function leanLabel(direction: string | undefined): string {
  if (direction === "Up") return "Up";
  if (direction === "Down") return "Down";
  return "Neutral — chop / no edge";
}

const MONITOR_MS_OPTIONS = [
  { ms: 10_000, label: "Every 10 sec" },
  { ms: 30_000, label: "Every 30 sec" },
  { ms: 60_000, label: "Every 60 sec" },
  { ms: 120_000, label: "Every 120 sec" },
] as const;

function isDirectional(d: string | undefined): d is "Up" | "Down" {
  return d === "Up" || d === "Down";
}

export default function NovaPolymarketFiveMinsPanel() {
  const [symbol, setSymbol] = useState("BTC");
  const [horizonMinutes, setHorizonMinutes] = useState<NovaFiveMinsHorizonMinutes>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeJson | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [monitorOn, setMonitorOn] = useState(false);
  const [monitorMs, setMonitorMs] = useState<(typeof MONITOR_MS_OPTIONS)[number]["ms"]>(30_000);
  const [monitorInfo, setMonitorInfo] = useState<string | null>(null);
  const [monitorAlert, setMonitorAlert] = useState<string | null>(null);
  const lastDirectionalRef = useRef<{ direction: "Up" | "Down"; confidencePct: number } | null>(null);

  const runAnalyze = useCallback(async (): Promise<AnalyzeJson | null> => {
    const s = symbol.trim();
    if (!s) {
      setError("Enter a symbol (e.g. BTC).");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/polymarket-five-mins/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: s, horizonMinutes }),
      });
      const data = (await res.json()) as AnalyzeJson;
      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`);
        setResult(null);
        return null;
      }
      if (!data.success) {
        setError(data.error ?? "Analysis failed");
        setResult(null);
        return null;
      }
      setResult(data);
      setFeedbackDone(false);
      setFeedbackNotes("");
      setFeedbackError(null);
      return data;
    } catch {
      setError("Network error.");
      setResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [symbol, horizonMinutes]);

  const submitOwnerFeedback = async (outcome: "matched" | "missed" | "n_a") => {
    if (!result?.success || !result.canSubmitOwnerFeedback || !result.pair) return;
    setFeedbackBusy(true);
    setFeedbackError(null);
    try {
      const bench = result.benchmarkOpen ?? result.benchmarkOpen5m;
      const res = await fetch("/api/polymarket-five-mins/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          notes: feedbackNotes.trim() || undefined,
          symbolInput: result.symbolInput ?? symbol.trim(),
          pair: result.pair,
          horizonMinutes: result.horizonMinutes ?? horizonMinutes,
          direction: result.direction ?? "Unclear",
          convictionPct: result.confidencePct,
          tapeRegime: result.tapeRegime,
          lastClose: result.lastClose,
          benchmarkOpen: bench,
          feed: result.feed,
          analysisSummary: result.summary,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setFeedbackError(data?.error ?? `Save failed (${res.status})`);
        return;
      }
      setFeedbackDone(true);
    } catch {
      setFeedbackError("Network error saving feedback.");
    } finally {
      setFeedbackBusy(false);
    }
  };

  useEffect(() => {
    if (!monitorOn) return;
    let cancelled = false;

    const tick = async () => {
      const data = await runAnalyze();
      if (cancelled || !data?.success) return;
      const dir = data.direction;
      const conf = typeof data.confidencePct === "number" ? data.confidencePct : 0;
      const prev = lastDirectionalRef.current;
      if (isDirectional(dir)) {
        if (prev && isDirectional(prev.direction) && prev.direction !== dir) {
          const fromW = prev.direction === "Up" ? "upside" : "downside";
          const toW = dir === "Up" ? "upside" : "downside";
          const msg = `${data.pair ?? symbol}: the model’s bias just switched from ${fromW} to ${toW} (spot context only — not a trade signal).`;
          setMonitorAlert(msg);
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Nova 5 mins — bias reversed", {
              body: `${data.pair ?? symbol}: switched from ${fromW} to ${toW}.`,
            });
          }
        }
        lastDirectionalRef.current = { direction: dir, confidencePct: conf };
      } else {
        lastDirectionalRef.current = null;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), monitorMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [monitorOn, monitorMs, runAnalyze, symbol]);

  const requestNotifyPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMonitorInfo("Browser notifications are not available here.");
      return;
    }
    const p = await Notification.requestPermission();
    setMonitorInfo(p === "granted" ? "Browser alerts are on for monitor reversals." : `Notification permission: ${p}`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 border-sky-200/50 dark:border-sky-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" aria-hidden />
            Nova 5 mins (VIP)
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Short-horizon directional context inspired by Polymarket&apos;s{" "}
            <a
              href="https://polymarket.com/event/btc-updown-5m-1776452400"
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              5-minute Up / Down
            </a>{" "}
            style markets. Pick a <strong className="text-zinc-700 dark:text-zinc-300">horizon</strong> (5m / 15m / 60m) so the benchmark and AI
            prompt match that window; AI still reads <strong className="text-zinc-700 dark:text-zinc-300">1m candles</strong> (Binance) — not the
            Chainlink stream Polymarket uses to resolve.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-2 text-[11px] text-amber-900 dark:text-amber-100">
            Educational assistant only. Fast markets are noisy; signals can be wrong. Never risk more than you can lose.
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col min-w-[140px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1">Symbol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="BTC, ETH, SOL…"
                className="h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
              />
            </div>
            <div className="flex flex-col min-w-[120px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1">Horizon</label>
              <select
                value={horizonMinutes}
                onChange={(e) => setHorizonMinutes(Number(e.target.value) as NovaFiveMinsHorizonMinutes)}
                className="h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
              >
                {NOVA_FIVE_MINS_HORIZONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min (Polymarket-style)
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              className="bg-sky-600 hover:bg-sky-700 text-white h-9"
              disabled={loading}
              onClick={() => void runAnalyze()}
            >
              {loading ? "Analyzing…" : "Run Nova AI Analysis"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9" asChild>
              <a href="https://polymarket.com/crypto" target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Polymarket crypto
              </a>
            </Button>
          </div>

          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="h-4 w-4 text-sky-600 shrink-0" />
              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">AI monitor</span>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={monitorOn}
                  onChange={(e) => {
                    setMonitorOn(e.target.checked);
                    if (e.target.checked) lastDirectionalRef.current = null;
                    if (!e.target.checked) {
                      setMonitorInfo(null);
                      setMonitorAlert(null);
                    }
                  }}
                  className="rounded border-zinc-400"
                />
                Run on an interval and flag when the model’s directional bias flips (upside ↔ downside)
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-muted-foreground">Interval</label>
              <select
                value={monitorMs}
                onChange={(e) => setMonitorMs(Number(e.target.value) as (typeof MONITOR_MS_OPTIONS)[number]["ms"])}
                disabled={!monitorOn}
                className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-xs"
              >
                {MONITOR_MS_OPTIONS.map((o) => (
                  <option key={o.ms} value={o.ms}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void requestNotifyPermission()}>
                {typeof Notification !== "undefined" && Notification.permission === "granted" ? (
                  <Bell className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <BellOff className="h-3.5 w-3.5 mr-1" />
                )}
                Browser alerts…
              </Button>
            </div>
            {monitorAlert && (
              <div
                role="alert"
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-red-600/70 bg-red-600/15 dark:bg-red-950/50 dark:border-red-500/60 px-2.5 py-2 text-[11px] text-red-950 dark:text-red-100"
              >
                <span className="font-medium pr-2">{monitorAlert}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-red-900 dark:text-red-100 hover:bg-red-600/20"
                  onClick={() => setMonitorAlert(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}
            {monitorInfo && <p className="text-[11px] text-muted-foreground">{monitorInfo}</p>}
            <p className="text-[10px] text-muted-foreground">
              Each tick re-runs analysis. A <strong className="text-red-700 dark:text-red-300">red flag</strong> appears when two consecutive{" "}
              <strong>directional</strong> reads disagree (upside vs downside). A neutral / chop read clears the prior side so the next directional
              read starts fresh.
            </p>
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {result?.success && (() => {
            const bench = result.benchmarkOpen ?? result.benchmarkOpen5m;
            const hz = result.horizonMinutes ?? 5;
            return (
            <div
              className={cn(
                "space-y-2 rounded-md border p-3 transition-colors",
                result.alignedWithSignal && (result.direction === "Up" || result.direction === "Down")
                  ? "border-emerald-600/55 bg-emerald-500/10 dark:border-emerald-500/50 dark:bg-emerald-950/35"
                  : "border-zinc-200 dark:border-zinc-700 bg-transparent"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {result.pair}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {hz}m horizon
                </Badge>
                {result.lastClose != null && Number.isFinite(result.lastClose) && (
                  <span className="text-xs text-muted-foreground">Spot last close ≈ {result.lastClose.toLocaleString()}</span>
                )}
                {result.alignedWithSignal && (result.direction === "Up" || result.direction === "Down") && (
                  <span className="text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                    Spot vs ~{hz}m reference: on track with lean
                  </span>
                )}
              </div>
              {result.tapeRegime && (
                <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{TAPE_REGIME_LABEL[result.tapeRegime]}</p>
              )}
              {result.tapeRegime === "sideways" && (
                <p className="text-[11px] leading-snug rounded border border-amber-600/45 bg-amber-500/10 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 px-2 py-1.5">
                  Sideways / range tape: expect chop; the lean below is easy to invalidate on the next few prints.
                </p>
              )}
              {result.tapeRegime === "down_slope" && result.direction === "Up" && (
                <p className="text-[11px] leading-snug rounded border border-amber-600/45 bg-amber-500/10 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 px-2 py-1.5">
                  Recent drift is still leaning down while the model favors upside — treat as a tension, not confirmation.
                </p>
              )}
              {result.tapeRegime === "up_slope" && result.direction === "Down" && (
                <p className="text-[11px] leading-snug rounded border border-amber-600/45 bg-amber-500/10 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 px-2 py-1.5">
                  Recent drift is still leaning up while the model favors downside — treat as a tension, not confirmation.
                </p>
              )}
              {bench != null && Number.isFinite(bench) && (
                <p className="text-[10px] text-muted-foreground">
                  ~{hz}m reference (open of the 1m bar from ~{hz} minutes ago on this feed):{" "}
                  {bench.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </p>
              )}
              {result.direction === "Down" && (
                <div className="rounded-md border border-sky-700/35 bg-sky-950/30 dark:bg-sky-950/40 px-2.5 py-2 space-y-1">
                  <p className="text-[11px] font-semibold text-sky-100">Polymarket: does &quot;Down&quot; mean buy Down?</p>
                  <p className="text-[11px] text-sky-50/95 leading-snug">
                    <strong>Yes — same side.</strong> On Polymarket Up/Down markets, a <strong>Down</strong> lean here is talking about the same
                    outcome as choosing <strong>Down</strong> on the contract: you are lined up with the market resolving <strong>lower</strong>{" "}
                    than that window&apos;s reference (per that market&apos;s official rules — usually Chainlink vs the window open). This is{" "}
                    <strong>not</strong> a recommendation to trade; Binance can disagree from the oracle.
                  </p>
                </div>
              )}
              {result.direction === "Up" && (
                <div className="rounded-md border border-sky-700/35 bg-sky-950/30 dark:bg-sky-950/40 px-2.5 py-2 space-y-1">
                  <p className="text-[11px] font-semibold text-sky-100">Polymarket: does &quot;Up&quot; mean buy Up?</p>
                  <p className="text-[11px] text-sky-50/95 leading-snug">
                    <strong>Yes — same side.</strong> An <strong>Up</strong> lean matches buying <strong>Up</strong> on the contract: you are lined
                    up with resolve <strong>at or above</strong> the reference for that window (per market rules / oracle).{" "}
                    <strong>Not</strong> trading advice.
                  </p>
                </div>
              )}
              {result.direction === "Unclear" && (
                <div className="rounded-md border border-zinc-600/40 bg-zinc-900/50 px-2.5 py-2">
                  <p className="text-[11px] text-zinc-200 leading-snug">
                    <strong>Neutral / chop:</strong> there isn&apos;t a clean single-sided match to &quot;buy Up&quot; or &quot;buy Down&quot; from
                    this read — Polymarket tickets are binary, so consider waiting or very small size if you still play.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Lean</span>
                <Badge
                  className={
                    result.direction === "Up"
                      ? "bg-emerald-600 text-white"
                      : result.direction === "Down"
                        ? "bg-rose-600 text-white"
                        : "bg-zinc-500 text-white"
                  }
                >
                  {leanLabel(result.direction)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Conviction {typeof result.confidencePct === "number" ? `${result.confidencePct}%` : "—"}
                </span>
              </div>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{result.summary}</p>
              {result.factors && result.factors.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {result.factors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
              {result.dataSourceNote && <p className="text-[10px] text-muted-foreground">{result.dataSourceNote}</p>}
              {result.riskNote && <p className="text-[10px] text-amber-800/90 dark:text-amber-200/90">{result.riskNote}</p>}

              {result.canSubmitOwnerFeedback && (
                <div className="mt-3 pt-3 border-t border-zinc-600/40 space-y-2">
                  <p className="text-[11px] font-medium text-zinc-200">Owner — outcome for training</p>
                  <p className="text-[10px] text-muted-foreground">
                    After the window plays out vs this lean, log whether it helped. Stored for future model tuning (not shown to VIPs).
                  </p>
                  <textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Optional note (e.g. oracle vs Binance, news print, …)"
                    rows={2}
                    disabled={feedbackBusy || feedbackDone}
                    className="w-full max-w-lg text-xs rounded border border-zinc-600 bg-zinc-950/40 px-2 py-1.5 text-zinc-100 placeholder:text-zinc-500"
                  />
                  {feedbackError && <p className="text-xs text-red-400">{feedbackError}</p>}
                  {feedbackDone ? (
                    <p className="text-xs text-emerald-400">Saved. Thank you.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={feedbackBusy}
                        onClick={() => void submitOwnerFeedback("matched")}
                      >
                        Lean matched reality
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-rose-700/50 text-rose-200 hover:bg-rose-950/50"
                        disabled={feedbackBusy}
                        onClick={() => void submitOwnerFeedback("missed")}
                      >
                        Lean did not match
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        disabled={feedbackBusy}
                        onClick={() => void submitOwnerFeedback("n_a")}
                      >
                        N/A (no trade / skip)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
