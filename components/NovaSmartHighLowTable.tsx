"use client";

import { Badge } from "@/components/ui/badge";
import { formatQuotePrice } from "@/lib/format-quote-price";

export type NovaSmartHighLowTf = {
  id: string;
  label: string;
  high: number;
  low: number;
  highTouches: number;
  lowTouches: number;
  direction: "bullish" | "bearish" | "sideways";
};

function touchLabel(count: number): string {
  if (count <= 0) return "No touches";
  return `${count} touch${count === 1 ? "" : "es"}`;
}

type Props = {
  timeframes: NovaSmartHighLowTf[];
  currentPrice: number | null;
};

function directionBadgeClass(direction: NovaSmartHighLowTf["direction"]): string {
  if (direction === "bullish") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10";
  if (direction === "bearish") return "border-rose-500/60 text-rose-700 dark:text-rose-300 bg-rose-500/10";
  return "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";
}

export default function NovaSmartHighLowTable({ timeframes, currentPrice }: Props) {
  if (timeframes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">High / low per timeframe</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Period high and low on each selected timeframe, with how often price traded near those levels (touches). Bar
          shows where price sits between low and high.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-700/90 overflow-hidden bg-white/40 dark:bg-zinc-900/40">
        <div className="hidden md:grid md:grid-cols-[7rem_1fr_1fr_4.5rem_1fr_4.5rem] gap-x-3 gap-y-0 px-3 py-2 bg-zinc-100/80 dark:bg-zinc-800/60 border-b border-zinc-200/80 dark:border-zinc-700/80">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeframe</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 text-right">
            High
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 text-right">
            Low
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Range
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">In range</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Bias
          </span>
        </div>

        <div className="divide-y divide-zinc-200/80 dark:divide-zinc-700/80">
          {timeframes.map((t) => {
            const range = t.high - t.low;
            const rangeLabel = range > 0 ? `$${formatQuotePrice(range)}` : "—";
            let posPct = 50;
            if (currentPrice != null && range > 0) {
              posPct = Math.min(100, Math.max(0, ((currentPrice - t.low) / range) * 100));
            }

            return (
              <div
                key={t.id}
                className="px-3 py-3 md:py-2.5 md:grid md:grid-cols-[7rem_1fr_1fr_4.5rem_1fr_4.5rem] md:gap-x-3 md:items-center hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center justify-between md:block mb-2 md:mb-0">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t.label}</span>
                  <Badge variant="outline" className={`md:hidden text-[10px] ${directionBadgeClass(t.direction)}`}>
                    {t.direction}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2 md:mb-0 md:contents">
                  <div className="md:text-right">
                    <span className="text-[10px] uppercase text-muted-foreground md:hidden block mb-0.5">High</span>
                    <p className="font-mono text-base md:text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ${formatQuotePrice(t.high)}
                    </p>
                    <p
                      className={`text-[10px] mt-0.5 tabular-nums ${
                        t.highTouches > 0
                          ? "text-slate-600 dark:text-slate-300 font-medium"
                          : "text-muted-foreground"
                      }`}
                      title="Bars whose high traded near this period high"
                    >
                      {touchLabel(t.highTouches)}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <span className="text-[10px] uppercase text-muted-foreground md:hidden block mb-0.5">Low</span>
                    <p className="font-mono text-base md:text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      ${formatQuotePrice(t.low)}
                    </p>
                    <p
                      className={`text-[10px] mt-0.5 tabular-nums ${
                        t.lowTouches > 0
                          ? "text-slate-600 dark:text-slate-300 font-medium"
                          : "text-muted-foreground"
                      }`}
                      title="Bars whose low traded near this period low"
                    >
                      {touchLabel(t.lowTouches)}
                    </p>
                  </div>
                </div>

                <div className="hidden md:block text-right">
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">{rangeLabel}</p>
                </div>

                <div className="md:col-span-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 md:hidden">
                    <span>Range {rangeLabel}</span>
                    {currentPrice != null && range > 0 && <span>{posPct.toFixed(0)}% of range</span>}
                  </div>
                  <div className="relative h-2.5 rounded-full bg-zinc-200/80 dark:bg-zinc-700/80 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-500/50 via-amber-500/30 to-emerald-500/50"
                      style={{ width: "100%" }}
                    />
                    {currentPrice != null && range > 0 && (
                      <div
                        className="absolute top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white dark:border-zinc-900 bg-violet-500 shadow-sm"
                        style={{ left: `clamp(0px, calc(${posPct}% - 7px), calc(100% - 14px))` }}
                        title={currentPrice != null ? `Current: $${formatQuotePrice(currentPrice)}` : undefined}
                      />
                    )}
                  </div>
                  <p className="hidden md:block text-[10px] text-muted-foreground mt-1 tabular-nums">
                    {currentPrice != null && range > 0
                      ? `Now $${formatQuotePrice(currentPrice)} · ${posPct.toFixed(0)}%`
                      : "—"}
                  </p>
                </div>

                <div className="hidden md:flex md:justify-end">
                  <Badge variant="outline" className={`text-[10px] capitalize ${directionBadgeClass(t.direction)}`}>
                    {t.direction}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
