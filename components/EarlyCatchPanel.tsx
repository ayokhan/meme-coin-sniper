"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { fomoTokenUrl } from "@/lib/meme-token-links";

type EarlyCoin = {
  name: string;
  symbol: string;
  address: string;
  chain: string;
  marketCapUsd: number;
  liquidityUsd: number;
  volumeUsd: number;
  priceChange24h: number;
  ageMinutes: number;
  narrativeScore: number;
  narrativeTags: string[];
  reason: string;
  pairUrl: string;
};

type EarlyResult = {
  scannedAt: string;
  maxMarketCapUsd: number;
  minLiquidityUsd: number;
  maxAgeMinutes?: number;
  minNarrativeScore?: number;
  pairsScanned: number;
  coins: EarlyCoin[];
};

function fmtAgeCap(minutes?: number) {
  if (minutes == null) return null;
  if (minutes < 60) return `≤ ${Math.round(minutes)}m old`;
  if (minutes < 48 * 60) return `≤ ${(minutes / 60).toFixed(0)}h old`;
  return `≤ ${(minutes / (60 * 24)).toFixed(0)}d old`;
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function EarlyCatchPanel() {
  const [result, setResult] = useState<EarlyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitLocked, setLimitLocked] = useState(false);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLimitLocked(false);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 58000);
      const res = await fetch("/api/early-catch", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.limitReached || data.locked) setLimitLocked(true);
        setError(data.error || "Scan failed");
        return;
      }
      setResult(data.result as EarlyResult);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Scan timed out — try again.");
      } else {
        setError("Network error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Early Catch</h3>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
          Fresh memes (under ~3 days) under ~$20k with narrative theme/news heat and real early flow — not idle
          leftovers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void scan()} disabled={loading || limitLocked}>
          {loading ? "Scanning…" : result ? "Scan again" : "Scan Early Catch"}
        </Button>
        {result && (
          <span className="text-xs text-muted-foreground">
            {result.coins.length} coins · mcap ≤ {fmtUsd(result.maxMarketCapUsd)}
            {fmtAgeCap(result.maxAgeMinutes) ? ` · ${fmtAgeCap(result.maxAgeMinutes)}` : ""}
            {result.minNarrativeScore != null ? ` · score ≥ ${result.minNarrativeScore}` : ""} ·{" "}
            {result.pairsScanned} pairs scanned · {new Date(result.scannedAt).toLocaleString()}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && result.coins.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          No fresh micro-caps with good narrative heat and early flow right now. Try again later.
        </p>
      )}

      <div className="space-y-2">
        {result?.coins.map((c) => (
          <div
            key={c.address}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 px-3 py-2.5 space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{c.name}</span>
                <span className="text-xs text-muted-foreground ml-1.5">{c.symbol}</span>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">
                Score {c.narrativeScore}/100
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{c.reason}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>Mcap {fmtUsd(c.marketCapUsd)}</span>
              <span>Liq {fmtUsd(c.liquidityUsd)}</span>
              <span>Vol {fmtUsd(c.volumeUsd)}</span>
              <span className={c.priceChange24h >= 0 ? "text-emerald-600" : "text-red-500"}>
                {c.priceChange24h >= 0 ? "+" : ""}
                {c.priceChange24h.toFixed(1)}%
              </span>
              <span>Age {c.ageMinutes < 60 ? `${Math.round(c.ageMinutes)}m` : `${(c.ageMinutes / 60).toFixed(1)}h`}</span>
            </div>
            {c.narrativeTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {c.narrativeTags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-0.5">
              <a
                href={fomoTokenUrl(c.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
              >
                FOMO
              </a>
              <a
                href={c.pairUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
              >
                Dex
              </a>
              <a
                href={`/?tab=ai-analysis&ca=${c.address}`}
                className="text-[10px] px-2 py-1 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20"
              >
                AI Analyze
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
