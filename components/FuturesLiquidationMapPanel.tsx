"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Cluster = {
  label: string;
  side: "long_liq_below" | "short_liq_above";
  price: number;
  distancePct: number;
  intensity: "low" | "medium" | "high";
  estimatedLiquidityUsd: number;
  reason: string;
};

type Result = {
  symbol: string;
  markPrice: number;
  dayChangePct: number;
  fundingRatePct: number;
  openInterest: number;
  volume24h: number;
  volatilityPct: number;
  bias: "long" | "short" | "neutral";
  confidence: "low" | "medium" | "high";
  summary: string;
  liquidityRead: string;
  clusters: Cluster[];
  recommendations: {
    buyArea: string;
    noBuyArea: string;
    stopArea: string;
    noStopArea: string;
    riskNote: string;
  };
  disclaimer: string;
};

function barClass(side: Cluster["side"]): string {
  return side === "short_liq_above"
    ? "bg-emerald-500/75 dark:bg-emerald-400/70"
    : "bg-rose-500/75 dark:bg-rose-400/70";
}

export default function FuturesLiquidationMapPanel() {
  const [symbol, setSymbol] = useState("BTC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    const s = symbol.trim();
    if (!s) {
      setError("Enter a contract symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/futures/liquidation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: s }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to load liquidation map.");
        return;
      }
      setResult(data as Result);
    } catch {
      setError("Failed to load liquidation map.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-lg">Liquidation Map</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter a contract (BTC, ETH, SOL, XAU-style symbol) to view likely liquidity pools, liquidation bands, and trade area guidance.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="liq-symbol" className="block text-xs text-muted-foreground mb-1">
                Contract
              </label>
              <input
                id="liq-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTC"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={run} disabled={loading} className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700">
              {loading ? "Analyzing…" : "Search liquidation map"}
            </Button>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{result.symbol}</h3>
                <Badge variant="outline">
                  Bias: {result.bias === "long" ? "Long" : result.bias === "short" ? "Short" : "Neutral"}
                </Badge>
                <Badge variant="secondary">Confidence: {result.confidence}</Badge>
              </div>
              <p className="text-sm">{result.summary}</p>
              <p className="text-xs text-muted-foreground">{result.liquidityRead}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">Price: <strong>{result.markPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong></div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">24h: <strong>{result.dayChangePct >= 0 ? "+" : ""}{result.dayChangePct.toFixed(2)}%</strong></div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">Funding: <strong>{result.fundingRatePct >= 0 ? "+" : ""}{result.fundingRatePct.toFixed(4)}%</strong></div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">Volatility: <strong>{result.volatilityPct.toFixed(2)}%</strong></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Liquidity clusters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.clusters.map((c, i) => (
                <div key={`${c.label}-${i}`} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{c.label}</span>
                    <span className="text-muted-foreground">
                      {c.side === "short_liq_above" ? "Above price" : "Below price"} · {c.distancePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full ${barClass(c.side)}`}
                      style={{ width: `${Math.min(100, Math.max(18, c.intensity === "high" ? 88 : c.intensity === "medium" ? 62 : 38))}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300">
                    Price level: <strong>{c.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> · Est. liquidity:{" "}
                    <strong>${c.estimatedLiquidityUsd.toLocaleString()}</strong>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trade area guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-semibold text-emerald-600 dark:text-emerald-400">Buy area:</span> {result.recommendations.buyArea}</p>
              <p><span className="font-semibold text-amber-600 dark:text-amber-400">No buy area:</span> {result.recommendations.noBuyArea}</p>
              <p><span className="font-semibold text-cyan-600 dark:text-cyan-400">Stop area:</span> {result.recommendations.stopArea}</p>
              <p><span className="font-semibold text-rose-600 dark:text-rose-400">No stop area:</span> {result.recommendations.noStopArea}</p>
              <p className="text-xs text-muted-foreground mt-3">{result.recommendations.riskNote}</p>
              <p className="text-[11px] text-muted-foreground">{result.disclaimer}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
