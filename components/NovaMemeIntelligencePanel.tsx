"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MemeQResult = {
  symbol: string;
  resolvedNote?: string | null;
  currentPrice: number | null;
  currentMarketCap?: number | null;
  marketCapSource?: "marketCap";
  analyzedAt?: string;
  pairAddress?: string | null;
  dexUrl?: string | null;
  confidenceNotes?: string[];
  marketDirection: "bullish" | "bearish" | "sideways";
  recommendation?: { signal: "buy" | "no_buy"; note: string };
  overallTrendlineSummary?: string;
  deadFlag?: { dead: boolean; note: string };
  timeframes: Array<{
    id: string;
    label: string;
    support: number;
    resistance: number;
    supportTouches: number;
    resistanceTouches: number;
    direction: "bullish" | "bearish" | "sideways";
  }>;
};

type MemeSmartResult = {
  symbol: string;
  resolvedNote?: string | null;
  currentPrice: number | null;
  currentMarketCap?: number | null;
  marketCapSource?: "marketCap";
  analyzedAt?: string;
  pairAddress?: string | null;
  dexUrl?: string | null;
  confidenceNotes?: string[];
  smartShortEntry: number;
  smartLongEntry: number;
  recommendedDirection: "long" | "short" | "neutral";
  recommendationNote: string;
  trendlineConfidence: "high" | "medium" | "low";
  trendlineConfidenceNote: string;
  deadFlag: { dead: boolean; note: string };
  recommendation?: { signal: "buy" | "no_buy"; note: string };
  timeframes: Array<{
    id: string;
    label: string;
    high: number;
    low: number;
    supportTouches: number;
    resistanceTouches: number;
    direction: "bullish" | "bearish" | "sideways";
  }>;
};

type TopMemeCoin = {
  symbol: string;
  name: string;
  chain: string;
  contractAddress: string;
  marketCap: number;
  liquidity: number;
  priceUSD: number | null;
  priceChange24h: number;
  score: number;
  deadFlag: boolean;
  qualityNote: string;
};

const TF_OPTIONS = ["30s", "1m", "2m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "24h", "1w"];
const PRICE_FACTOR_TF_OPTIONS = ["60s", "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "24h", "48h", "72h", "1w"];

type MemePriceFactorResult = {
  symbol: string;
  contract: string;
  currentMcap: number;
  rows: Array<{
    timeframe: string;
    timeframeLabel: string;
    lowMcap: number;
    highMcap: number;
    lowCount: number;
    highCount: number;
    netChangePct?: number;
  }>;
  analyzedAt: string;
  pairAddress?: string | null;
  dexUrl?: string | null;
};

function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export default function NovaMemeIntelligencePanel() {
  const [subTab, setSubTab] = useState<"nova-q-memes" | "nova-smart-memes" | "top-meme-coins" | "meme-price-factor">("nova-q-memes");
  const [timeframes, setTimeframes] = useState<string[]>(["1m", "5m", "15m", "1h", "24h"]);
  const [symbol, setSymbol] = useState("PEPE");
  const [symbols, setSymbols] = useState("PEPE,DOGE,SHIB");
  const [priceFactorContract, setPriceFactorContract] = useState("");
  const [priceFactorTfs, setPriceFactorTfs] = useState<string[]>(["1m", "5m", "15m", "1h", "24h"]);
  const [priceFactorResult, setPriceFactorResult] = useState<MemePriceFactorResult | null>(null);
  const [addonFlags, setAddonFlags] = useState<{ novaQMemes: boolean; novaSmartMemes: boolean; topMemeCoins: boolean; memePriceFactor: boolean } | null>(null);
  const [qResult, setQResult] = useState<MemeQResult | null>(null);
  const [smartResults, setSmartResults] = useState<MemeSmartResult[]>([]);
  const [topCoins, setTopCoins] = useState<TopMemeCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyContract = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress((prev) => (prev === address ? null : prev)), 1500);
    } catch {
      // ignore clipboard permission failures
    }
  };

  useEffect(() => {
    if (subTab === "top-meme-coins" && topCoins.length === 0 && !loading) {
      void loadTopMemeCoins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  useEffect(() => {
    fetch("/api/futures/vip-addon-flags", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        const flags = {
          novaQMemes: !!d.novaQMemes,
          novaSmartMemes: !!d.novaSmartMemes,
          topMemeCoins: !!d.topMemeCoins,
          memePriceFactor: !!d.memePriceFactor,
        };
        setAddonFlags(flags);
        const ordered: Array<typeof subTab> = ["nova-q-memes", "nova-smart-memes", "top-meme-coins", "meme-price-factor"];
        const enabledMap: Record<typeof subTab, boolean> = {
          "nova-q-memes": flags.novaQMemes,
          "nova-smart-memes": flags.novaSmartMemes,
          "top-meme-coins": flags.topMemeCoins,
          "meme-price-factor": flags.memePriceFactor,
        };
        if (!enabledMap[subTab]) {
          const firstEnabled = ordered.find((id) => enabledMap[id]);
          if (firstEnabled) setSubTab(firstEnabled);
        }
      })
      .catch(() => {});
  }, [subTab]);

  const runNovaQMemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meme-intelligence/nova-q-memes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframes }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) setQResult(data.result as MemeQResult);
      else setError(data?.error ?? "Failed to run NovaQ - Memes.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run NovaQ - Memes.");
    } finally {
      setLoading(false);
    }
  };

  const runNovaSmartMemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsedSymbols = symbols.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      const res = await fetch("/api/meme-intelligence/nova-smart-memes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: parsedSymbols, timeframes }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.results)) setSmartResults(data.results as MemeSmartResult[]);
      else setError(data?.error ?? "Failed to run Nova Smart Analysis for Memes.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run Nova Smart Analysis for Memes.");
    } finally {
      setLoading(false);
    }
  };

  const loadTopMemeCoins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meme-intelligence/top-meme-coins", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.coins)) setTopCoins(data.coins as TopMemeCoin[]);
      else setError(data?.error ?? "Failed to load Top Meme coins.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Top Meme coins.");
    } finally {
      setLoading(false);
    }
  };

  const runMemePriceFactor = async () => {
    setLoading(true);
    setError(null);
    setPriceFactorResult(null);
    try {
      const res = await fetch("/api/meme-intelligence/meme-price-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: priceFactorContract.trim(), timeframes: priceFactorTfs }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) setPriceFactorResult(data.result as MemePriceFactorResult);
      else setError(data?.error ?? "Failed to run Meme Price Factor.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run Meme Price Factor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-3 sm:mx-6 py-6 sm:py-8">
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)} className="space-y-4">
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg flex-wrap h-auto gap-1 w-full">
          {(addonFlags?.novaQMemes ?? true) && <TabsTrigger value="nova-q-memes" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white dark:data-[state=active]:bg-fuchsia-600">NovaQ - Memes</TabsTrigger>}
          {(addonFlags?.novaSmartMemes ?? true) && <TabsTrigger value="nova-smart-memes" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white dark:data-[state=active]:bg-fuchsia-600">Nova Smart Analysis for Memes</TabsTrigger>}
          {(addonFlags?.topMemeCoins ?? true) && <TabsTrigger value="top-meme-coins" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white dark:data-[state=active]:bg-fuchsia-600">Top Meme coins</TabsTrigger>}
          {(addonFlags?.memePriceFactor ?? true) && <TabsTrigger value="meme-price-factor" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white dark:data-[state=active]:bg-fuchsia-600">Meme Price Factor</TabsTrigger>}
        </TabsList>

        <TabsContent value="nova-q-memes" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Meme-focused support/resistance, market structure, trendline, liquidity pressure, direction, and dead/downside warnings.</p>
          <div className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="flex flex-wrap gap-2 items-center">
            {TF_OPTIONS.map((tf) => (
              <label key={tf} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800">
                <input
                  type="checkbox"
                  checked={timeframes.includes(tf)}
                  onChange={() => setTimeframes((prev) => (prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]))}
                />
                {tf}
              </label>
            ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="text-sm border rounded-md px-3 py-2 h-10 w-full sm:w-[360px] bg-white dark:bg-zinc-800"
                placeholder="Ticker or contract (Solana/BSC)"
              />
              <Button className="h-10 px-4 w-full sm:w-auto" onClick={runNovaQMemes} disabled={loading || timeframes.length === 0}>
                {loading ? "Running..." : "Run NovaQ - Memes"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {qResult && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base font-mono">{qResult.symbol}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">Direction: {qResult.marketDirection}</Badge>
                  {qResult.recommendation ? (
                    <Badge className={qResult.recommendation.signal === "buy" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                      {qResult.recommendation.signal === "buy" ? "Buy" : "No buy"}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">Price: {qResult.currentPrice != null ? `$${qResult.currentPrice.toLocaleString()}` : "—"}</span>
                  <span className="text-xs text-muted-foreground">MCap: {formatUsdCompact(qResult.currentMarketCap ?? null)}</span>
                  {qResult.deadFlag?.dead ? <Badge className="bg-rose-600 text-white">Dead / avoid buy</Badge> : <Badge variant="secondary">Not dead</Badge>}
                </div>
                {qResult.recommendation?.note ? <p className="text-xs text-muted-foreground">{qResult.recommendation.note}</p> : null}
                {qResult.deadFlag?.note ? <p className="text-xs text-muted-foreground">{qResult.deadFlag.note}</p> : null}
                {qResult.resolvedNote ? <p className="text-xs text-cyan-600 dark:text-cyan-400">{qResult.resolvedNote}</p> : null}
                {qResult.analyzedAt ? <p className="text-xs text-muted-foreground">Analyzed: {new Date(qResult.analyzedAt).toLocaleString()} · Source: {qResult.marketCapSource ?? "marketCap"}</p> : null}
                {qResult.dexUrl ? <a href={qResult.dexUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">View selected pair on DexScreener</a> : null}
                {qResult.confidenceNotes?.length ? (
                  <div className="rounded-md border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 px-2 py-1">
                    {qResult.confidenceNotes.map((n, i) => (
                      <p key={`q-note-${i}`} className="text-xs text-amber-700 dark:text-amber-300">{n}</p>
                    ))}
                  </div>
                ) : null}
                {qResult.overallTrendlineSummary ? <p className="text-xs text-muted-foreground">{qResult.overallTrendlineSummary}</p> : null}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>TF</TableHead><TableHead className="text-right">Support MCap</TableHead><TableHead className="text-right">S touches</TableHead><TableHead className="text-right">Resistance MCap</TableHead><TableHead className="text-right">R touches</TableHead><TableHead>Direction</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {qResult.timeframes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.label}</TableCell>
                          <TableCell className="text-right font-mono">{formatUsdCompact(r.support)}</TableCell>
                          <TableCell className="text-right font-mono">{r.supportTouches}</TableCell>
                          <TableCell className="text-right font-mono">{formatUsdCompact(r.resistance)}</TableCell>
                          <TableCell className="text-right font-mono">{r.resistanceTouches}</TableCell>
                          <TableCell className="capitalize">{r.direction}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="nova-smart-memes" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Meme-focused smart entries, trendline confidence, direction call, and dead/downside warnings.</p>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="flex flex-wrap gap-2 items-center mb-2">
              {TF_OPTIONS.map((tf) => (
                <label key={`smart-${tf}`} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={timeframes.includes(tf)}
                    onChange={() => setTimeframes((prev) => (prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]))}
                  />
                  {tf}
                </label>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={symbols}
                onChange={(e) => setSymbols(e.target.value.toUpperCase())}
                className="text-sm border rounded-md px-3 py-2 h-10 w-full sm:w-[420px] bg-white dark:bg-zinc-800"
                placeholder="Symbols or contracts, comma-separated"
              />
              <Button className="h-10 px-4 w-full sm:w-auto" onClick={runNovaSmartMemes} disabled={loading || timeframes.length === 0}>
                {loading ? "Running..." : "Run Nova Smart Memes"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {smartResults.length > 0 && (
            <div className="space-y-3">
              {smartResults.map((r) => (
                <Card key={r.symbol}>
                  <CardContent className="py-3 text-sm space-y-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-mono font-semibold">{r.symbol}</span>
                      <Badge variant="outline" className="capitalize">Direction: {r.recommendedDirection}</Badge>
                      {r.recommendation ? (
                        <Badge className={r.recommendation.signal === "buy" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                          {r.recommendation.signal === "buy" ? "Buy" : "No buy"}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className="capitalize">Confidence: {r.trendlineConfidence}</Badge>
                      {r.deadFlag.dead ? <Badge className="bg-rose-600 text-white">Dead / going down</Badge> : null}
                    </div>
                    {r.recommendation?.note ? <p className="text-xs text-muted-foreground">{r.recommendation.note}</p> : null}
                    <p className="text-xs text-muted-foreground">{r.recommendationNote}</p>
                    {r.resolvedNote ? <p className="text-xs text-cyan-600 dark:text-cyan-400">{r.resolvedNote}</p> : null}
                    {r.analyzedAt ? <p className="text-xs text-muted-foreground">Analyzed: {new Date(r.analyzedAt).toLocaleString()} · Source: {r.marketCapSource ?? "marketCap"}</p> : null}
                    {r.dexUrl ? <a href={r.dexUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">View selected pair on DexScreener</a> : null}
                    {r.confidenceNotes?.length ? (
                      <div className="rounded-md border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 px-2 py-1">
                        {r.confidenceNotes.map((n, i) => (
                          <p key={`${r.symbol}-note-${i}`} className="text-xs text-amber-700 dark:text-amber-300">{n}</p>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{r.trendlineConfidenceNote}</p>
                    <p className="text-xs text-muted-foreground">Current MCap: <span className="font-mono">{formatUsdCompact(r.currentMarketCap ?? null)}</span></p>
                    <p className="text-xs">Resistance MCap: <span className="font-mono">{formatUsdCompact(r.smartShortEntry)}</span> · Support MCap: <span className="font-mono">{formatUsdCompact(r.smartLongEntry)}</span></p>
                    {r.timeframes.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Touches (first TF {r.timeframes[0].label}): support {r.timeframes[0].supportTouches}, resistance {r.timeframes[0].resistanceTouches}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="top-meme-coins" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Reliable meme-coin candidates (not honeypot, stronger liquidity/market cap, older listings) for scalp/swing watchlists.</p>
          <Button className="h-10 px-4 w-full sm:w-auto" onClick={loadTopMemeCoins} disabled={loading}>
            {loading ? "Loading..." : "Refresh Top Meme coins"}
          </Button>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {topCoins.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coin</TableHead><TableHead>Chain</TableHead><TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">MCap</TableHead><TableHead className="text-right">Liquidity</TableHead><TableHead className="text-right">24h %</TableHead><TableHead>Status</TableHead><TableHead>Contract</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCoins.map((c) => (
                    <TableRow key={c.contractAddress}>
                      <TableCell><div className="font-medium">{c.symbol}</div><div className="text-[11px] text-muted-foreground">{c.name}</div></TableCell>
                      <TableCell className="uppercase text-xs">{c.chain}</TableCell>
                      <TableCell className="text-right font-mono">{c.score}</TableCell>
                      <TableCell className="text-right font-mono">${c.marketCap.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${c.liquidity.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-mono ${c.priceChange24h >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{c.priceChange24h.toFixed(2)}%</TableCell>
                      <TableCell>{c.deadFlag ? <Badge variant="destructive">Caution</Badge> : <Badge variant="secondary">Healthy</Badge>}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => void copyContract(c.contractAddress)}
                          title={c.contractAddress}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          {copiedAddress === c.contractAddress ? "Copied" : "Copy CA"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="meme-price-factor" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Paste a Solana or BSC contract, choose timeframe, then get high/low market-cap bands and touch counts.</p>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              {PRICE_FACTOR_TF_OPTIONS.map((tf) => (
                <label key={`mpf-${tf}`} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={priceFactorTfs.includes(tf)}
                    onChange={() =>
                      setPriceFactorTfs((prev) => (prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]))
                    }
                  />
                  {tf}
                </label>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={priceFactorContract}
                onChange={(e) => setPriceFactorContract(e.target.value.trim())}
                className="text-sm border rounded-md px-3 py-2 h-10 w-full sm:w-[420px] bg-white dark:bg-zinc-800"
                placeholder="Paste Solana/BSC contract"
              />
              <Button className="h-10 px-4 w-full sm:w-auto" onClick={runMemePriceFactor} disabled={loading || !priceFactorContract.trim() || priceFactorTfs.length === 0}>
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {priceFactorResult && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base">{priceFactorResult.symbol} · Meme Price Factor</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">Analyzed: {new Date(priceFactorResult.analyzedAt).toLocaleString()}</p>
                {priceFactorResult.dexUrl ? <a href={priceFactorResult.dexUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">View selected pair on DexScreener</a> : null}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TF</TableHead>
                        <TableHead className="text-right">Current MCap</TableHead>
                        <TableHead className="text-right">Low MCap</TableHead>
                        <TableHead className="text-right">Low count</TableHead>
                        <TableHead className="text-right">High MCap</TableHead>
                        <TableHead className="text-right">High count</TableHead>
                        <TableHead className="text-right">Net change %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono">{formatUsdCompact(priceFactorResult.currentMcap)}</TableCell>
                        <TableCell colSpan={6} className="text-muted-foreground text-xs">Rows by selected timeframe</TableCell>
                      </TableRow>
                      {priceFactorResult.rows.map((r) => (
                        <TableRow key={`mpf-row-${r.timeframe}`}>
                          <TableCell>{r.timeframeLabel}</TableCell>
                          <TableCell className="text-right font-mono">{formatUsdCompact(priceFactorResult.currentMcap)}</TableCell>
                          <TableCell className="text-right font-mono">{formatUsdCompact(r.lowMcap)}</TableCell>
                          <TableCell className="text-right font-mono">{r.lowCount}</TableCell>
                          <TableCell className="text-right font-mono">{formatUsdCompact(r.highMcap)}</TableCell>
                          <TableCell className="text-right font-mono">{r.highCount}</TableCell>
                          <TableCell className={`text-right font-mono ${(r.netChangePct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {(r.netChangePct ?? 0).toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
