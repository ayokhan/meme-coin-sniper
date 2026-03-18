"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

const PLAYBOOK_COPY = `ONLINE BOSS — Demand Zone + Deep Fib (LONG playbook)

Instruments: XAUUSD, BTC perp, MGC (micro gold), Silver CFDs
HTF: 3H/4H structure | LTF: 5m/1m entry

1) Demand zone (HTF): horizontal zone at prior support; e.g. XAU ~4960–4990, MGC ~4941 / ~5004.
2) Fib: swing high → swing low. Deep zone 76.4%–88.6% must overlap demand.
3) Entry: wick into zone on LTF; bullish reaction (engulfing, pin bar, close above zone top). MGC: market on confirm.
4) SL: below zone low | TP: 50% then 38.2% Fib (~1:2 to 1:3 R:R).
5) Top-down: HTF bias + LTF timing.
6) Crypto: optional funding filter (avoid crowded longs).

Not financial advice.`;

export default function OnlineBossDemandFibPlaybook() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-6 text-sm text-zinc-800 dark:text-zinc-200">
      <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 p-4">
        <p className="font-semibold text-amber-900 dark:text-amber-200">Owner-only playbook</p>
        <p className="text-xs text-muted-foreground mt-1">
          LONG-focused strategy: demand zone + deep Fib confluence. No Telegram alerts. Reference from Online Boss video walkthrough.
        </p>
      </div>

      <section>
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">Instruments & platforms (observed)</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800/80 text-left">
                <th className="p-2 font-medium">Segment</th>
                <th className="p-2 font-medium">Instrument</th>
                <th className="p-2 font-medium">Platform</th>
                <th className="p-2 font-medium">Timeframe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              <tr>
                <td className="p-2">Early</td>
                <td className="p-2">BTCUSDT Perp</td>
                <td className="p-2">BloFin</td>
                <td className="p-2">4H</td>
              </tr>
              <tr>
                <td className="p-2">Early</td>
                <td className="p-2">MGC (micro gold)</td>
                <td className="p-2">TopStep / TradingView</td>
                <td className="p-2">1m / 5m</td>
              </tr>
              <tr>
                <td className="p-2">Mid–late</td>
                <td className="p-2">XAUUSD</td>
                <td className="p-2">FOREX.com / TV</td>
                <td className="p-2">3H / 5m</td>
              </tr>
              <tr>
                <td className="p-2">Brief</td>
                <td className="p-2">Silver CFDs</td>
                <td className="p-2">TVC</td>
                <td className="p-2">5m</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">Core idea</h3>
        <p className="text-muted-foreground leading-relaxed">
          Multi-confluent <strong className="text-zinc-800 dark:text-zinc-200">support reversal</strong>: a wide horizontal{" "}
          <strong className="text-zinc-800 dark:text-zinc-200">demand zone</strong> on HTF aligns with a{" "}
          <strong className="text-zinc-800 dark:text-zinc-200">deep Fib retracement</strong> (76.4%–88.6%). Entry on LTF when
          price taps the zone and prints a bullish confirmation candle closing back above the zone top.
        </p>
      </section>

      <ol className="list-decimal list-inside space-y-4 marker:font-bold marker:text-amber-600 dark:marker:text-amber-400">
        <li>
          <span className="font-semibold">Demand zone (HTF)</span>
          <p className="mt-1 pl-0 text-muted-foreground leading-relaxed">
            Mark zone from prior consolidation / reversal. Examples: XAUUSD ~4,960–4,990; MGC ~4,941 and ~5,004. Zone = area
            where price previously base-built before impulse up.
          </p>
        </li>
        <li>
          <span className="font-semibold">Fibonacci</span>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            Retracement from swing high → swing low. Key levels: 38.2%, 50%, 61.8%, 76.4%, 78.6%, 88.6%. Deep pullback band
            (76.4–88.6%) overlapping the demand zone = confluence.
          </p>
        </li>
        <li>
          <span className="font-semibold">Entry trigger</span>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            LTF: lower wick into zone → bullish reaction (engulfing, hammer/pin bar, or strong close above zone top). MGC:
            market entry once candle confirms.
          </p>
        </li>
        <li>
          <span className="font-semibold">Trade management</span>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            <strong>SL:</strong> below demand zone low (structure). <strong>TP:</strong> toward 50% Fib, then 38.2% (prior swing
            area). Example XAU target zone ~5,022–5,040. Typical R:R ~1:2–1:3.
          </p>
        </li>
        <li>
          <span className="font-semibold">Multi-timeframe</span>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            3H/4H for direction + zone/Fib placement; 5m/1m for precise entry timing.
          </p>
        </li>
        <li>
          <span className="font-semibold">Funding (crypto)</span>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            On perps (e.g. BloFin), check funding as a filter: very positive funding = crowded longs; slightly negative / neutral
            can be more favorable for long continuation plays.
          </p>
        </li>
      </ol>

      <section>
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">Quick reference</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {[
            ["Signal type", "Demand + deep Fib (76.4–88.6%) confluence"],
            ["HTF / LTF", "3H–4H structure · 5m–1m entry"],
            ["Entry", "Reclaim above zone top at Fib confluence"],
            ["Stop", "Below zone low"],
            ["Targets", "50% Fib → 38.2% Fib"],
            ["Filters", "Funding (crypto), HTF bias"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2">
              <div className="font-medium text-zinc-600 dark:text-zinc-400">{k}</div>
              <div className="mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Code module (scanner-ready)</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
          Logic lives in <code className="text-amber-700 dark:text-amber-400">lib/demand-zone-fib-strategy.ts</code> —{" "}
          <code className="text-amber-700 dark:text-amber-400">detectDemandFibSetup()</code> on HTF/LTF OHLCV arrays. Not wired to
          alerts or live data in this tab.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300 dark:border-amber-700"
          onClick={() => {
            navigator.clipboard.writeText(PLAYBOOK_COPY).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          {copied ? "Copied!" : "Copy playbook summary"}
        </Button>
      </section>

      <p className="text-[11px] text-muted-foreground">Educational only. Not financial advice.</p>
    </div>
  );
}
