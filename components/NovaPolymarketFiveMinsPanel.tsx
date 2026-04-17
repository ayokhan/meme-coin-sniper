"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Bell, BellOff, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AnalyzeJson = {
  success?: boolean;
  error?: string;
  fiveMinsDisabled?: boolean;
  pair?: string;
  symbolInput?: string;
  lastClose?: number | null;
  dataSourceNote?: string;
  polymarketStyleUrl?: string;
  direction?: "Up" | "Down" | "Unclear";
  confidencePct?: number;
  summary?: string;
  factors?: string[];
  riskNote?: string;
};

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeJson | null>(null);

  const [monitorOn, setMonitorOn] = useState(false);
  const [monitorMs, setMonitorMs] = useState<(typeof MONITOR_MS_OPTIONS)[number]["ms"]>(30_000);
  const [monitorNote, setMonitorNote] = useState<string | null>(null);
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
        body: JSON.stringify({ symbol: s }),
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
      return data;
    } catch {
      setError("Network error.");
      setResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [symbol]);

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
          const msg = `${data.pair ?? symbol}: model flipped from ${prev.direction} to ${dir} (confidence ${conf}%).`;
          setMonitorNote(msg);
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Nova 5 mins — signal change", { body: msg });
          }
        }
        lastDirectionalRef.current = { direction: dir, confidencePct: conf };
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
      setMonitorNote("Browser notifications are not available here.");
      return;
    }
    const p = await Notification.requestPermission();
    setMonitorNote(p === "granted" ? "Notifications enabled for monitor alerts." : `Notification permission: ${p}`);
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
            style markets. AI reads recent <strong className="text-zinc-700 dark:text-zinc-300">1m spot candles</strong> (Binance) plus simple
            structure cues — not the Chainlink stream Polymarket uses to resolve.
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
            <Button
              type="button"
              className="bg-sky-600 hover:bg-sky-700 text-white h-9"
              disabled={loading}
              onClick={() => void runAnalyze()}
            >
              {loading ? "Analyzing…" : "Run AI analysis"}
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
                    if (!e.target.checked) setMonitorNote(null);
                  }}
                  className="rounded border-zinc-400"
                />
                Run on an interval and alert when the model flips between Up and Down
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
            {monitorNote && <p className="text-[11px] text-emerald-700 dark:text-emerald-300">{monitorNote}</p>}
            <p className="text-[10px] text-muted-foreground">
              Monitor calls the same analyze endpoint each tick. Alerts fire when two consecutive <strong>directional</strong> results disagree
              (Up vs Down). &quot;Unclear&quot; steps reset the flip detector.
            </p>
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {result?.success && (
            <div className="space-y-2 rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {result.pair}
                </Badge>
                {result.lastClose != null && Number.isFinite(result.lastClose) && (
                  <span className="text-xs text-muted-foreground">Spot last close ≈ {result.lastClose.toLocaleString()}</span>
                )}
              </div>
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
                  {result.direction ?? "—"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Confidence {typeof result.confidencePct === "number" ? `${result.confidencePct}%` : "—"}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
