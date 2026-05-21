"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { NovaExtraHourStat, NovaExtraLookbackId, NovaExtraResult, NovaExtraTimeWindow } from "@/lib/nova-extra";
import {
  NOVA_EXTRA_HIGH_WIN_RATE_PCT,
  NOVA_EXTRA_LOOKBACK_OPTIONS,
  NOVA_EXTRA_TIMEZONE_OPTIONS,
} from "@/lib/nova-extra";

type Props = {
  enabled: boolean;
  isVip: boolean;
};

const AUTO_TZ = "__auto__";

function biasBadge(bias: string): string {
  if (bias === "long") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10";
  if (bias === "short") return "border-rose-500/60 text-rose-700 dark:text-rose-300 bg-rose-500/10";
  return "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";
}

function windowCard(w: NovaExtraTimeWindow) {
  return (
    <div
      key={`${w.bias}-${w.startHourLocal}-${w.endHourLocal}`}
      className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-white/60 dark:bg-zinc-900/60 p-3"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Badge variant="outline" className={biasBadge(w.bias)}>
          {w.bias === "long" ? "Long bias" : "Short bias"}
        </Badge>
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.label}</span>
        <span className="text-[10px] text-muted-foreground uppercase">{w.confidence} confidence</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Avg {w.avgReturnPct >= 0 ? "+" : ""}
        {w.avgReturnPct}% / hour · {w.avgWinRatePct}% up hours · {w.samples} samples
      </p>
    </div>
  );
}

function hourRowClass(h: NovaExtraHourStat): string {
  if (h.highSuccessRate && h.bias === "long") {
    return "bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40";
  }
  if (h.highSuccessRate && h.bias === "short") {
    return "bg-rose-500/15 ring-1 ring-inset ring-rose-500/40";
  }
  if (h.strength === "strong" && h.bias === "long") return "bg-emerald-500/5";
  if (h.strength === "strong" && h.bias === "short") return "bg-rose-500/5";
  if (h.strength === "moderate" && h.bias !== "neutral") return "bg-zinc-500/5";
  return "";
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function NovaExtraPanel({ enabled, isVip }: Props) {
  const [symbol, setSymbol] = useState("BTC");
  const [lookbackId, setLookbackId] = useState<NovaExtraLookbackId>("6w");
  const [timezonePick, setTimezonePick] = useState(AUTO_TZ);
  const [detectedTz, setDetectedTz] = useState("UTC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaExtraResult | null>(null);

  useEffect(() => {
    setDetectedTz(detectBrowserTimezone());
  }, []);

  const effectiveTimezone = useMemo(
    () => (timezonePick === AUTO_TZ ? detectedTz : timezonePick),
    [timezonePick, detectedTz]
  );

  const timezoneSelectValue = useMemo(() => {
    if (timezonePick === AUTO_TZ) return AUTO_TZ;
    if (NOVA_EXTRA_TIMEZONE_OPTIONS.some((z) => z.id === timezonePick)) return timezonePick;
    return timezonePick;
  }, [timezonePick]);

  const run = useCallback(async () => {
    if (!enabled) {
      setError("Nova Extra is not available on your account yet. Contact support if you need access.");
      return;
    }
    if (!isVip) {
      setError("Nova Extra is for VIP subscribers.");
      return;
    }
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setError("Enter a contract symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: sym,
          lookbackId,
          timezone: effectiveTimezone,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        result?: NovaExtraResult;
      };
      if (!res.ok || !data.success) {
        setResult(null);
        setError(data.error ?? "Nova Extra failed");
        return;
      }
      setResult(data.result ?? null);
    } catch {
      setError("Nova Extra request failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, isVip, symbol, lookbackId, effectiveTimezone]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Nova Extra</h2>
        <p className="text-sm text-muted-foreground">
          Nova Extra is not available on your account yet. Contact support if you need access.
        </p>
      </div>
    );
  }

  const sortedHours = result
    ? [...result.hours].sort((a, b) => {
        if (a.highSuccessRate !== b.highSuccessRate) return a.highSuccessRate ? -1 : 1;
        return a.hourLocal - b.hourLocal;
      })
    : [];

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Extra</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          See which <strong className="text-zinc-700 dark:text-zinc-300">local hours</strong> and{" "}
          <strong className="text-zinc-700 dark:text-zinc-300">time ranges</strong> tended to push price up or down. Pick
          how far back to study and your timezone — highlighted rows show high directional success (≥
          {NOVA_EXTRA_HIGH_WIN_RATE_PCT}% win rate for long/short bias). Not a guarantee.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Symbol</span>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTC, XAU, XAUUSD"
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-36 bg-white dark:bg-zinc-800 block"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Look back</span>
          <select
            value={lookbackId}
            onChange={(e) => setLookbackId(e.target.value as NovaExtraLookbackId)}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 min-w-[8.5rem] bg-white dark:bg-zinc-800 block"
          >
            {NOVA_EXTRA_LOOKBACK_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Timezone</span>
          <select
            value={timezoneSelectValue}
            onChange={(e) => setTimezonePick(e.target.value)}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 min-w-[11rem] max-w-[14rem] bg-white dark:bg-zinc-800 block"
          >
            <option value={AUTO_TZ}>Auto — {detectedTz}</option>
            {NOVA_EXTRA_TIMEZONE_OPTIONS.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={run} disabled={loading}>
          {loading ? "Analyzing…" : "Run Nova Extra"}
        </Button>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.summary}</p>
          <p className="text-xs text-muted-foreground">{result.contractNote}</p>
          <p className="text-xs text-muted-foreground">
            Data: {result.dataSource} · {result.lookbackLabel} · {result.totalCandles} hourly bars · {result.timezoneNote}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">When to lean Long</h3>
              <p className="text-xs text-muted-foreground">{result.longTradeHint}</p>
              {result.bestLongWindows.length > 0 ? (
                result.bestLongWindows.map(windowCard)
              ) : (
                <p className="text-xs text-muted-foreground">No strong multi-hour long window in this sample.</p>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">When to lean Short</h3>
              <p className="text-xs text-muted-foreground">{result.shortTradeHint}</p>
              {result.bestShortWindows.length > 0 ? (
                result.bestShortWindows.map(windowCard)
              ) : (
                <p className="text-xs text-muted-foreground">No strong multi-hour short window in this sample.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
              Hour-by-hour ({result.timezone})
            </h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              Rows with a green or red ring: ≥{NOVA_EXTRA_HIGH_WIN_RATE_PCT}% success rate for that hour&apos;s bias (sorted
              to top).
            </p>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-md border border-zinc-200/80 dark:border-zinc-700/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Local hour</TableHead>
                    <TableHead className="text-xs text-right">Avg %</TableHead>
                    <TableHead className="text-xs text-right">Up %</TableHead>
                    <TableHead className="text-xs text-right">Samples</TableHead>
                    <TableHead className="text-xs">Bias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHours.map((h) => (
                    <TableRow key={h.hourLocal} className={hourRowClass(h)}>
                      <TableCell className="text-xs font-medium">
                        {h.label}
                        {h.highSuccessRate && (
                          <Badge variant="outline" className="ml-1.5 text-[9px] border-amber-500/50 text-amber-700 dark:text-amber-300">
                            High success
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-xs text-right tabular-nums ${h.avgReturnPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                      >
                        {h.avgReturnPct >= 0 ? "+" : ""}
                        {h.avgReturnPct}%
                      </TableCell>
                      <TableCell
                        className={`text-xs text-right tabular-nums ${h.highSuccessRate ? "font-semibold text-amber-700 dark:text-amber-300" : ""}`}
                      >
                        {h.winRatePct}%
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{h.samples}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${biasBadge(h.bias)}`}>
                          {h.bias}
                          {h.strength !== "weak" ? ` · ${h.strength}` : ""}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
