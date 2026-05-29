"use client";

import { Badge } from "@/components/ui/badge";
import { formatQuotePrice } from "@/lib/format-quote-price";

export type NovaQTimeframeRow = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  supportTouches: number;
  resistanceTouches: number;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  trendlineSlopePctWindow?: number;
  trendlineRead?: string;
  demandSupplyRead?: string;
  direction: "bullish" | "bearish" | "sideways";
};

type Props = {
  timeframes: NovaQTimeframeRow[];
  currentPrice: number | null;
};

function touchLabel(count: number): string {
  if (count <= 0) return "No touches";
  return `${count} touch${count === 1 ? "" : "es"}`;
}

function dirBadge(direction: "bullish" | "bearish" | "sideways"): string {
  if (direction === "bullish") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10";
  if (direction === "bearish") return "border-rose-500/60 text-rose-700 dark:text-rose-300 bg-rose-500/10";
  return "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";
}

function tlBadge(bias: "up" | "down" | "flat"): string {
  if (bias === "up") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300";
  if (bias === "down") return "border-rose-500/60 text-rose-700 dark:text-rose-300";
  return "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";
}

export default function NovaQTimeframeTable({ timeframes, currentPrice }: Props) {
  if (timeframes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Support / resistance per timeframe</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Period support (low) and resistance (high), retest counts, structure vs regression trendline, and blended
          direction. Bar shows where price sits in the range.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-700/90 overflow-hidden bg-white/40 dark:bg-zinc-900/40 divide-y divide-zinc-200/80 dark:divide-zinc-700/80">
        {timeframes.map((t) => {
          const range = t.resistance - t.support;
          let posPct = 50;
          if (currentPrice != null && range > 0) {
            posPct = Math.min(100, Math.max(0, ((currentPrice - t.support) / range) * 100));
          }
          const tlSlope =
            typeof t.trendlineSlopePctWindow === "number" ? t.trendlineSlopePctWindow : null;
          const struct = t.structureDirection ?? t.direction;

          return (
            <div
              key={t.id}
              className="px-3 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t.label}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] ${dirBadge(t.direction)}`}>
                    Blended: {t.direction}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${dirBadge(struct)}`}>
                    Structure: {struct}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${tlBadge(t.trendlineBias)}`}>
                    TL: {t.trendlineBias}
                    {tlSlope != null ? ` ${tlSlope >= 0 ? "+" : ""}${tlSlope.toFixed(2)}%` : ""}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">Support</span>
                  <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ${formatQuotePrice(t.support)}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 ${t.supportTouches > 0 ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground"}`}
                  >
                    {touchLabel(t.supportTouches)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">Resistance</span>
                  <p className="font-mono text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    ${formatQuotePrice(t.resistance)}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 ${t.resistanceTouches > 0 ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground"}`}
                  >
                    {touchLabel(t.resistanceTouches)}
                  </p>
                </div>
                <div className="col-span-2 md:col-span-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Range ${formatQuotePrice(range)}</span>
                    {currentPrice != null && range > 0 && <span>{posPct.toFixed(0)}% of range</span>}
                  </div>
                  <div className="relative h-2.5 rounded-full bg-zinc-200/80 dark:bg-zinc-700/80 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/40 via-zinc-400/20 to-rose-500/40" />
                    {currentPrice != null && range > 0 && (
                      <div
                        className="absolute top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white dark:border-zinc-900 bg-violet-500 shadow-sm"
                        style={{ left: `clamp(0px, calc(${posPct}% - 7px), calc(100% - 14px))` }}
                      />
                    )}
                  </div>
                  {currentPrice != null && range > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      Now ${formatQuotePrice(currentPrice)}
                    </p>
                  )}
                </div>
              </div>

              {t.demandSupplyRead ? (
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed" title={t.trendlineRead}>
                  {t.demandSupplyRead}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
