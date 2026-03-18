"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";

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

type SymbolResult = {
  hasSetup: boolean;
  message?: string;
  symbol?: string;
  exchange?: string;
  fundingRate?: number;
  signal: Record<string, unknown> | null;
};

type ChartResult = {
  setup: string;
  confluenceScore: number;
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  summary: string;
  reasons: string[];
  demandZoneNote?: string;
  fibNote?: string;
};

export default function OnlineBossDemandFibPlaybook() {
  const [copied, setCopied] = useState(false);
  const [symbolExchange, setSymbolExchange] = useState<"binance" | "hyperliquid">("binance");
  const [symbolInput, setSymbolInput] = useState("");
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [symbolResult, setSymbolResult] = useState<SymbolResult | null>(null);
  const [chartFile, setChartFile] = useState<File | null>(null);
  const [chartSymbolHint, setChartSymbolHint] = useState("");
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartResult, setChartResult] = useState<ChartResult | null>(null);
  const [signalCopied, setSignalCopied] = useState(false);

  const runSymbolScan = async () => {
    setSymbolError(null);
    setSymbolResult(null);
    const s = symbolInput.trim();
    if (!s) {
      setSymbolError(symbolExchange === "hyperliquid" ? "Enter a coin (e.g. BTC, SOL)." : "Enter a symbol (e.g. BTC/USDT).");
      return;
    }
    setSymbolLoading(true);
    try {
      const res = await fetch("/api/admin/demand-fib-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: s, exchange: symbolExchange }),
      });
      const data = await res.json();
      if (!data.success) {
        setSymbolError(data.error ?? "Scan failed.");
        return;
      }
      setSymbolResult({
        hasSetup: data.hasSetup,
        message: data.message,
        symbol: data.symbol,
        exchange: data.exchange,
        fundingRate: data.fundingRate,
        signal: data.signal,
      });
    } catch {
      setSymbolError("Request failed.");
    } finally {
      setSymbolLoading(false);
    }
  };

  const runChartScan = async () => {
    setChartError(null);
    setChartResult(null);
    if (!chartFile) {
      setChartError("Choose a chart image.");
      return;
    }
    setChartLoading(true);
    try {
      const form = new FormData();
      form.append("chart", chartFile);
      if (chartSymbolHint.trim()) form.append("symbol", chartSymbolHint.trim());
      const res = await fetch("/api/admin/demand-fib-strategy", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) {
        setChartError(data.error ?? "Analysis failed.");
        return;
      }
      setChartResult(data.chart);
    } catch {
      setChartError("Request failed.");
    } finally {
      setChartLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-sm text-zinc-800 dark:text-zinc-200">
      <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 p-4">
        <p className="font-semibold text-amber-900 dark:text-amber-200">Owner-only playbook</p>
        <p className="text-xs text-muted-foreground mt-1">
          LONG-focused strategy: demand zone + deep Fib. No Telegram alerts. Run a scan below or read the reference.
        </p>
      </div>

      <section className="rounded-xl border-2 border-amber-300/50 dark:border-amber-700/50 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/30 p-4 space-y-5">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Run strategy (this tab only)</h3>

        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">A) Symbol scan</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSymbolExchange("binance")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                symbolExchange === "binance"
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              Binance USDT-M
            </button>
            <button
              type="button"
              onClick={() => setSymbolExchange("hyperliquid")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                symbolExchange === "hyperliquid"
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              Hyperliquid
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {symbolExchange === "binance"
              ? "Examples: BTC/USDT, ETHUSDT, SOLUSDT."
              : "Perp coin only (HL universe). Examples: BTC, ETH, SOL, HYPE."}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder={symbolExchange === "hyperliquid" ? "e.g. BTC" : "e.g. BTC/USDT"}
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              className="flex-1 min-w-[160px] rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
            <Button
              type="button"
              disabled={symbolLoading}
              onClick={runSymbolScan}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {symbolLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run symbol scan"}
            </Button>
          </div>
          {symbolError && <p className="text-xs text-rose-600 dark:text-rose-400">{symbolError}</p>}
          {symbolResult && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80 p-3 text-xs space-y-2">
              <p className="font-medium">
                {symbolResult.symbol}
                {symbolResult.exchange === "hyperliquid" ? " · Hyperliquid" : " · Binance"}
              </p>
              {symbolResult.fundingRate != null && (
                <p className="text-muted-foreground">
                  Funding: {(Number(symbolResult.fundingRate) * 100).toFixed(4)}%
                  {symbolResult.exchange === "binance" ? " (8h est.)" : " (HL hourly)"}
                </p>
              )}
              <p className={symbolResult.hasSetup ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                {symbolResult.message}
              </p>
              {symbolResult.hasSetup && symbolResult.signal && (
                <>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <span>Entry</span>
                    <span className="font-mono">{String((symbolResult.signal as { entryPrice?: number }).entryPrice)}</span>
                    <span>SL</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      {String((symbolResult.signal as { stopLoss?: number }).stopLoss)}
                    </span>
                    <span>TP1 (50%)</span>
                    <span className="font-mono text-emerald-600">{String((symbolResult.signal as { takeProfit1?: number }).takeProfit1)}</span>
                    <span>TP2 (38.2%)</span>
                    <span className="font-mono text-emerald-600">{String((symbolResult.signal as { takeProfit2?: number }).takeProfit2)}</span>
                    <span>R:R</span>
                    <span>{String((symbolResult.signal as { riskRewardRatio?: number }).riskRewardRatio?.toFixed?.(2))}:1</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const t = (symbolResult.signal as { formatted?: string }).formatted ?? "";
                      navigator.clipboard.writeText(t).then(() => {
                        setSignalCopied(true);
                        setTimeout(() => setSignalCopied(false), 2000);
                      });
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {signalCopied ? "Copied" : "Copy signal text"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">B) Chart upload (AI vision)</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-amber-100 file:px-2 file:py-1 dark:file:bg-amber-950"
            onChange={(e) => setChartFile(e.target.files?.[0] ?? null)}
          />
          <input
            type="text"
            placeholder="Optional: BTC, XAUUSD…"
            value={chartSymbolHint}
            onChange={(e) => setChartSymbolHint(e.target.value)}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          <Button type="button" disabled={chartLoading} onClick={runChartScan} variant="secondary">
            {chartLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze chart"}
          </Button>
          {chartError && <p className="text-xs text-rose-600 dark:text-rose-400">{chartError}</p>}
          {chartResult && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80 p-3 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    chartResult.setup === "LONG" ? "bg-emerald-500 text-white" : "bg-zinc-500 text-white"
                  }`}
                >
                  {chartResult.setup}
                </span>
                <span className="text-muted-foreground">Score {(chartResult.confluenceScore * 100).toFixed(0)}%</span>
              </div>
              <p>{chartResult.summary}</p>
              <div className="grid grid-cols-2 gap-1">
                <span>Entry</span>
                <span className="font-mono">{chartResult.entry}</span>
                <span>SL</span>
                <span className="font-mono text-rose-600">{chartResult.sl}</span>
                <span>TP1</span>
                <span className="font-mono text-emerald-600">{chartResult.tp1}</span>
                <span>TP2</span>
                <span className="font-mono text-emerald-600">{chartResult.tp2}</span>
              </div>
              {(chartResult.demandZoneNote || chartResult.fibNote) && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  {[chartResult.demandZoneNote, chartResult.fibNote].filter(Boolean).join(" · ")}
                </p>
              )}
              <ul className="list-disc list-inside space-y-0.5">
                {chartResult.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

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
          Symbol scan: <strong>Binance USDT-M</strong> or <strong>Hyperliquid</strong> 4h/5m klines +{" "}
          <code className="text-amber-700 dark:text-amber-400">detectDemandFibSetup()</code>. Chart = Claude vision. No Telegram.
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
