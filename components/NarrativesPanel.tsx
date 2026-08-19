"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* ---------- Types ---------- */

type NarrativeTimeframe = "4h" | "daily" | "weekly";

type TopCoin = {
  name: string;
  symbol: string;
  address: string;
  chain: string;
  volumeUsd: number;
  priceChange24h: number;
};

type NarrativeItem = {
  name: string;
  heat: number;
  direction: "rising" | "peaking" | "fading";
  coinCount: number;
  topCoins: TopCoin[];
  keywords: string[];
  summary: string;
};

type ScanResult = {
  timeframe: NarrativeTimeframe;
  narratives: NarrativeItem[];
  scannedAt: string;
  pairsScanned: number;
};

/* ---------- Old guide phases (moved to DIY sub-tab) ---------- */

type NarrativeTool = { name: string; url: string | null; free: boolean; action: string };
type NarrativePhase = { id: string; title: string; subtitle: string; description: string; color: string; icon: string; tools: NarrativeTool[]; checklist: string[]; output: string };

const PHASES: NarrativePhase[] = [
  {
    id: "global", title: "GLOBAL TRENDS", subtitle: "What's rising worldwide",
    description: "Spot themes and topics gaining traction globally. Meme coins often mirror or precede these trends.",
    color: "cyan", icon: "🌐",
    tools: [
      { name: "Google Trends", url: "https://trends.google.com/trends/explore", free: true, action: "Explore trending searches and topics by region and time range." },
      { name: "Exploding Topics", url: "https://explodingtopics.com", free: true, action: "Discover topics growing fast before they peak." },
      { name: "Trends24", url: "https://trends24.in", free: true, action: "Real-time trending hashtags by country." },
    ],
    checklist: ["Which topics are rising in the last 24h–7d?", "Any major news that could spawn a meme coin?", "Could this narrative already have a token?"],
    output: "Global narratives → map to potential coin themes",
  },
  {
    id: "us", title: "US TRENDS", subtitle: "What's hot in the US",
    description: "US-driven narratives often lead meme coin cycles. Politics, pop culture, and news move markets.",
    color: "violet", icon: "🇺🇸",
    tools: [
      { name: "Google Trends (US)", url: "https://trends.google.com/trends/explore?geo=US", free: true, action: "US-only trending searches." },
      { name: "X (Twitter) Trending", url: "https://twitter.com/explore/tabs/trending", free: true, action: "What's trending on X in the US." },
      { name: "Reddit r/popular", url: "https://www.reddit.com/r/popular", free: true, action: "Trending posts; many meme themes start here." },
    ],
    checklist: ["What's trending in the US right now?", "Any political/celebrity news that could become a meme?", "Is there already a coin with this narrative?"],
    output: "US narrative shortlist → cross-check with existing coins",
  },
  {
    id: "memes", title: "TRENDING MEMES", subtitle: "Viral memes and formats",
    description: "Memes that are going viral often get tokenized. Track formats and characters spreading.",
    color: "amber", icon: "📷",
    tools: [
      { name: "Know Your Meme", url: "https://knowyourmeme.com", free: true, action: "Track meme origins and current viral memes." },
      { name: "Reddit r/memes", url: "https://www.reddit.com/r/memes", free: true, action: "See what meme formats are blowing up." },
      { name: "Imgur trending", url: "https://imgur.com", free: true, action: "Trending image memes; early signal for tokenizable characters." },
    ],
    checklist: ["Which meme formats are spreading fastest this week?", "Is there a 'face' or 'name' that could become a token?", "Has this meme already been tokenized?"],
    output: "Viral memes with token potential → timing check",
  },
  {
    id: "coins", title: "TRENDING COINS", subtitle: "Coins already riding narratives",
    description: "See which coins are pumping and what narratives they're tied to.",
    color: "emerald", icon: "🪙",
    tools: [
      { name: "DexScreener (Solana)", url: "https://dexscreener.com/solana", free: true, action: "New and trending pairs." },
      { name: "Pump.fun", url: "https://pump.fun", free: true, action: "New meme coins on Solana." },
      { name: "CoinGecko Trending", url: "https://www.coingecko.com/en/trending", free: true, action: "Trending coins across chains." },
    ],
    checklist: ["Which meme coins are trending in the last 24h?", "What narrative does each tie to?", "Is the narrative crowded or still early?"],
    output: "Narrative ↔ coin map → ride existing or hunt early",
  },
];

/* ---------- Helpers ---------- */

const DIRECTION_BADGE: Record<string, { label: string; class: string }> = {
  rising: { label: "Rising", class: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  peaking: { label: "Peak", class: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  fading: { label: "Fading", class: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
};

function HeatBar({ heat }: { heat: number }) {
  const color = heat >= 70 ? "bg-emerald-500" : heat >= 40 ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground shrink-0">Heat</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${heat}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 w-12 text-right">{heat}/100</span>
    </div>
  );
}

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/* ---------- Sub-components ---------- */

function CoinRow({ coin: c }: { coin: TopCoin }) {
  const [copied, setCopied] = useState(false);
  const shortAddr = c.address ? `${c.address.slice(0, 6)}…${c.address.slice(-4)}` : "";

  const copyCA = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(c.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const analyzeUrl = c.chain === "bsc" || c.chain === "bnb"
    ? `/?tab=ai-analysis&chain=bsc&ca=${c.address}`
    : `/?tab=ai-analysis&ca=${c.address}`;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{c.symbol}</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">{c.chain}</span>
        </div>
        {c.address && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground">{shortAddr}</span>
            <button
              onClick={copyCA}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              {copied ? "Copied!" : "Copy CA"}
            </button>
            <a
              href={analyzeUrl}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-colors"
            >
              AI Analyze
            </a>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground">{formatVol(c.volumeUsd)}</span>
        <span className={`text-xs font-mono ${c.priceChange24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
          {c.priceChange24h >= 0 ? "+" : ""}{c.priceChange24h.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function NarrativeCard({ item }: { item: NarrativeItem }) {
  const [expanded, setExpanded] = useState(false);
  const badge = DIRECTION_BADGE[item.direction] ?? DIRECTION_BADGE.rising;

  return (
    <Card
      className="cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">{item.name}</CardTitle>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.class}`}>
                {badge.label}
              </span>
              <span className="text-xs text-muted-foreground">{item.coinCount} coin{item.coinCount !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>
          </div>
          <span className={`text-lg transition-transform duration-200 text-muted-foreground ${expanded ? "rotate-90" : ""}`}>→</span>
        </div>
        <div className="mt-2">
          <HeatBar heat={item.heat} />
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-3 animate-in fade-in duration-200">
          {item.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.keywords.map((kw) => (
                <span key={kw} className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  {kw}
                </span>
              ))}
            </div>
          )}
          {item.topCoins.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Top coins</p>
              <div className="space-y-1.5">
                {item.topCoins.map((c, i) => (
                  <CoinRow key={i} coin={c} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DiyResearchTab() {
  const [activePhase, setActivePhase] = useState(0);
  const COLOR_CLASSES: Record<string, string> = {
    cyan: "text-cyan-500 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    violet: "text-violet-500 dark:text-violet-400 border-violet-500/30 bg-violet-500/10",
    amber: "text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
    emerald: "text-emerald-500 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manual research sources for finding narratives yourself. Open these sites, spot trends, then map them to coins.
      </p>
      {PHASES.map((phase, i) => {
        const colorClass = COLOR_CLASSES[phase.color] ?? COLOR_CLASSES.cyan;
        const isActive = activePhase === i;
        return (
          <Card
            key={phase.id}
            className={`cursor-pointer transition-all border-2 ${isActive ? "border-zinc-300 dark:border-zinc-600 shadow-sm" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
            onClick={() => setActivePhase(i)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">{phase.icon}</span>
                <div className="flex-1 min-w-0">
                  <CardTitle className={`text-sm font-mono font-bold tracking-wider ${colorClass}`}>{phase.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{phase.subtitle}</p>
                </div>
                <span className={`text-lg ${colorClass} transition-transform duration-200 ${isActive ? "rotate-90" : ""}`}>→</span>
              </div>
            </CardHeader>
            {isActive && (
              <CardContent className="pt-0 space-y-4 animate-in fade-in duration-200">
                <p className="text-sm text-muted-foreground">{phase.description}</p>
                <div className="space-y-2">
                  {phase.tools.map((tool, j) => (
                    <div key={j} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{tool.name}</span>
                        {tool.free && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">FREE</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{tool.action}</p>
                      {tool.url && (
                        <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-1 inline-block" onClick={(e) => e.stopPropagation()}>
                          Open →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <ul className="space-y-1">
                  {phase.checklist.map((item, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <span className={`text-[8px] ${colorClass}`}>◆</span>{item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Main component ---------- */

type SubTab = "scanner" | "diy";

export default function NarrativesPanel({ isPaid }: { isPaid?: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>("scanner");
  const [timeframe, setTimeframe] = useState<NarrativeTimeframe>("daily");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitLocked, setLimitLocked] = useState(false);

  const scan = useCallback(async (tf: NarrativeTimeframe) => {
    setLoading(true);
    setError(null);
    setLimitLocked(false);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);
      const res = await fetch("/api/narrative-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ timeframe: tf }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { data = { success: false, error: text || "Server returned invalid response." }; }
      if (!res.ok || !data.success) {
        if (data.limitReached || data.locked) setLimitLocked(true);
        setError((data.error as string) || "Scan failed.");
        return;
      }
      setResult(data.result as ScanResult);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Scan timed out — try again or pick a shorter timeframe.");
      } else {
        setError("Network error — check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTimeframeChange = (tf: NarrativeTimeframe) => {
    setTimeframe(tf);
    scan(tf);
  };

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Narrative-first meme coin hunting
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-amber-400 to-violet-500 dark:from-cyan-300 dark:via-amber-300 dark:to-violet-400 bg-clip-text text-transparent">
          Narratives
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          Catch the trending meme coin narratives. The scanner clusters new token launches + Google Trends to surface themes early — so you can find the next pump before it peaks.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-zinc-200 dark:border-zinc-800">
        <button
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${subTab === "scanner" ? "border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-transparent text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          onClick={() => setSubTab("scanner")}
        >
          Narrative Scanner
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${subTab === "diy" ? "border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-transparent text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          onClick={() => setSubTab("diy")}
        >
          DIY Research
        </button>
      </div>

      {subTab === "diy" ? (
        <DiyResearchTab />
      ) : (
        <div className="space-y-4">
          {/* Timeframe + Scan */}
          <div className="flex flex-wrap items-center gap-2">
            {(["4h", "daily", "weekly"] as NarrativeTimeframe[]).map((tf) => (
              <Button
                key={tf}
                size="sm"
                variant={timeframe === tf && result?.timeframe === tf ? "default" : "outline"}
                onClick={() => handleTimeframeChange(tf)}
                disabled={loading}
              >
                {tf === "4h" ? "Last 4h" : tf === "daily" ? "Today" : "This week"}
              </Button>
            ))}
            {!result && !loading && (
              <Button size="sm" onClick={() => scan(timeframe)} disabled={loading} className="ml-auto">
                Scan narratives
              </Button>
            )}
          </div>

          {/* Status */}
          {loading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Scanning narratives… (takes ~15s)</span>
            </div>
          )}

          {error && (
            <div className={`rounded-lg border p-4 ${limitLocked ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <p className={`text-sm ${limitLocked ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`}>{error}</p>
              {limitLocked && (
                <a href="/subscribe" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-2 inline-block">
                  Upgrade to Pro / VIP →
                </a>
              )}
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {result.narratives.length} narrative{result.narratives.length !== 1 ? "s" : ""} found · {result.pairsScanned} pairs scanned · {new Date(result.scannedAt).toLocaleTimeString()}
                </p>
                <Button size="sm" variant="ghost" onClick={() => scan(timeframe)} disabled={loading} className="text-xs">
                  Refresh
                </Button>
              </div>
              <div className="space-y-3">
                {result.narratives.map((item, i) => (
                  <NarrativeCard key={i} item={item} />
                ))}
              </div>
              {result.narratives.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No strong narratives detected for this timeframe. Try a wider window.
                </p>
              )}
            </>
          )}

          {/* Initial state */}
          {!result && !loading && !error && (
            <div className="text-center py-10 space-y-3">
              <p className="text-4xl">🔍</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Select a timeframe and hit <strong>Scan narratives</strong> to discover what themes are driving meme coin launches right now.
              </p>
              {!isPaid && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Free plan: 1 scan per day. Pro/VIP: unlimited.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
