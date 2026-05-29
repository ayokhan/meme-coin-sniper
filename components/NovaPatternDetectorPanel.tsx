"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQuotePriceUsd } from "@/lib/format-quote-price";
import type { NovaPatternResult, NovaPatternWeekdayRow } from "@/lib/nova-pattern-detector";
import {
  NOVA_PATTERN_LOOKBACK_OPTIONS,
  NOVA_PATTERN_TYPE_OPTIONS,
} from "@/lib/nova-pattern-detector";
import { NOVA_EXTRA_TIMEZONE_OPTIONS } from "@/lib/nova-extra";

type Props = {
  enabled: boolean;
  isVip: boolean;
};

const AUTO_TZ = "__auto__";

function biasBadgeClass(bias: NovaPatternWeekdayRow["bias"]): string {
  if (bias === "long") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10";
  if (bias === "short") return "border-rose-500/60 text-rose-700 dark:text-rose-300 bg-rose-500/10";
  return "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";
}

function strengthLabel(s: NovaPatternWeekdayRow["strength"]): string {
  if (s === "strong") return "Strong edge";
  if (s === "moderate") return "Moderate edge";
  return "Weak / noise";
}

export default function NovaPatternDetectorPanel({ enabled, isVip }: Props) {
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch {
      return "America/New_York";
    }
  }, []);

  const [symbol, setSymbol] = useState("XAU");
  const [lookbackId, setLookbackId] = useState("6w");
  const [patternTypeId, setPatternTypeId] = useState("playbook");
  const [timezoneChoice, setTimezoneChoice] = useState(AUTO_TZ);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaPatternResult | null>(null);

  const resolvedTimezone =
    timezoneChoice === AUTO_TZ ? browserTz : timezoneChoice;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-pattern-detector", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, lookbackId, patternTypeId, timezone: resolvedTimezone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Analysis failed");
        setResult(null);
        return;
      }
      setResult(data.result as NovaPatternResult);
    } catch {
      setError("Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, lookbackId, patternTypeId, resolvedTimezone]);

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Nova Pattern Detector is not enabled for this site yet. Ask an admin to turn on the feature flag.
      </p>
    );
  }

  if (!isVip) {
    return (
      <p className="text-sm text-muted-foreground">
        Nova Pattern Detector is for VIP subscribers. Upgrade to unlock day-of-week, 48h cycle, and weekly rhythm
        playbooks for XAU, BTC, and more.
      </p>
    );
  }

  const showDow =
    result &&
    (result.patternTypeId === "playbook" || result.patternTypeId === "day_of_week") &&
    result.dayOfWeek.length > 0;
  const show48h =
    result &&
    (result.patternTypeId === "playbook" || result.patternTypeId === "cycle_48h") &&
    result.cycle48h;
  const showWeekly =
    result &&
    (result.patternTypeId === "playbook" || result.patternTypeId === "weekly_rhythm") &&
    result.weeklyRhythm.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Pattern Detector</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Behavioral playbook — not NovaQ support/resistance. Learn from history: which weekdays tend to rally or fade,
          whether sharp 48h moves often retrace in the next 48h, and weekly rhythms (e.g. Monday up → Tuesday down).
          Pick how far back to study; pattern type narrows the report. XAU/XAG use Blofin; others use Hyperliquid.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Contract
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="XAU, BTC, ETH…"
            className="mt-1 block w-28 rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Learn from
          <select
            value={lookbackId}
            onChange={(e) => setLookbackId(e.target.value)}
            className="mt-1 block rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {NOVA_PATTERN_LOOKBACK_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Pattern focus
          <select
            value={patternTypeId}
            onChange={(e) => setPatternTypeId(e.target.value)}
            className="mt-1 block min-w-[200px] rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {NOVA_PATTERN_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Weekday timezone
          <select
            value={timezoneChoice}
            onChange={(e) => setTimezoneChoice(e.target.value)}
            className="mt-1 block min-w-[180px] rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            <option value={AUTO_TZ}>Auto (browser)</option>
            {NOVA_EXTRA_TIMEZONE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void run()} disabled={loading}>
          {loading ? "Analyzing…" : "Run playbook"}
        </Button>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold">{result.symbol}</span>
              {result.currentPrice != null && (
                <span className="text-sm text-muted-foreground">{formatQuotePriceUsd(result.currentPrice)}</span>
              )}
              <Badge variant="outline" className="border-violet-500/60 text-violet-700 dark:text-violet-300 bg-violet-500/10">
                {result.playbookHeadline}
              </Badge>
              <span className="text-[10px] text-muted-foreground uppercase">
                {result.dataSource} · {result.lookbackLabel} · {result.timezoneLabel}
              </span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{result.traderBrief}</p>
            {(result.bestLongDay || result.bestShortDay) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {result.bestLongDay && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">Best long day</p>
                    <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                      {result.bestLongDay.label} · avg +{result.bestLongDay.avgReturnPct}% ·{" "}
                      {result.bestLongDay.winRatePct}% green ({result.bestLongDay.samples} samples)
                    </p>
                  </div>
                )}
                {result.bestShortDay && (
                  <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs">
                    <p className="font-semibold text-rose-700 dark:text-rose-300">Best short / fade day</p>
                    <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                      {result.bestShortDay.label} · avg {result.bestShortDay.avgReturnPct}% ·{" "}
                      {Math.round(100 - result.bestShortDay.winRatePct)}% red ({result.bestShortDay.samples} samples)
                    </p>
                  </div>
                )}
              </div>
            )}
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {result.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>

          {showDow && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                Day of week ({result.timezoneLabel})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Day</TableHead>
                      <TableHead className="text-right text-xs">Avg %</TableHead>
                      <TableHead className="text-right text-xs">Green %</TableHead>
                      <TableHead className="text-right text-xs">n</TableHead>
                      <TableHead className="text-xs">Bias</TableHead>
                      <TableHead className="text-xs">Edge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.dayOfWeek.map((d) => (
                      <TableRow key={d.dayIndex}>
                        <TableCell className="text-xs font-medium">{d.label}</TableCell>
                        <TableCell
                          className={`text-right text-xs tabular-nums font-mono ${
                            d.avgReturnPct >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {d.avgReturnPct >= 0 ? "+" : ""}
                          {d.avgReturnPct}%
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{d.winRatePct}%</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{d.samples}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={biasBadgeClass(d.bias)}>
                            {d.bias}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{strengthLabel(d.strength)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {show48h && result.cycle48h && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">48-hour cycle</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 p-2">
                  <p className="text-muted-foreground text-[10px] uppercase">Median 48h move</p>
                  <p className="font-mono font-semibold tabular-nums">
                    {result.cycle48h.median48hReturnPct >= 0 ? "+" : ""}
                    {result.cycle48h.median48hReturnPct}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">{result.cycle48h.total48hWindows} windows</p>
                </div>
                <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2">
                  <p className="text-muted-foreground text-[10px] uppercase">
                    After +{result.cycle48h.rallyThresholdPct}% 48h rally
                  </p>
                  <p className="font-mono font-semibold tabular-nums">
                    Next 48h avg {result.cycle48h.afterRallyNext48hAvgPct}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Retrace {result.cycle48h.afterRallyRetraceRatePct}% · n={result.cycle48h.samplesAfterRally}
                  </p>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                  <p className="text-muted-foreground text-[10px] uppercase">
                    After −{result.cycle48h.rallyThresholdPct}% 48h drop
                  </p>
                  <p className="font-mono font-semibold tabular-nums">
                    Next 48h avg {result.cycle48h.afterDropNext48hAvgPct}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Bounce {result.cycle48h.afterDropBounceRatePct}% · n={result.cycle48h.samplesAfterDrop}
                  </p>
                </div>
              </div>
            </div>
          )}

          {showWeekly && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Weekly rhythm</h3>
              <div className="space-y-2">
                {result.weeklyRhythm.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3 text-xs"
                  >
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{w.label}</p>
                    <p className="text-muted-foreground mt-1">{w.description}</p>
                    <p className="mt-1 tabular-nums">
                      Hit rate <span className="font-semibold">{w.hitRatePct}%</span> ({w.samples} samples)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">{result.contractNote}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
