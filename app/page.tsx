"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

type Token = {
  id: string;
  symbol: string;
  name: string;
  contractAddress: string;
  viralScore: number;
  liquidity: number | null;
  priceUSD: number | null;
  pairAddress: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  launchedAt: string;
  kolCount?: number;
  volume24h?: number | null;
  volume1h?: number | null;
  volume6h?: number | null;
  volume5m?: number | null;
  volume15m?: number | null;
  volume30m?: number | null;
  txnsBuys24h?: number | null;
  txnsSells24h?: number | null;
};

type WalletAlert = {
  contractAddress: string;
  symbol: string;
  name: string;
  buyerCount: number;
  buyers: Array<{ address: string; label?: string }>;
  liquidity?: number | null;
  priceUSD?: number | null;
};

const AUTO_REFRESH_SECONDS = 60;

type TabId = "new" | "trending" | "surge" | "ct" | "wallets" | "transactions" | "ai-analysis";
const PAID_TABS: TabId[] = ["surge", "transactions", "ai-analysis", "ct", "wallets"];

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const isPaid = (session?.user as { isPaid?: boolean } | undefined)?.isPaid ?? false;
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("new");
  const [ctAccounts, setCtAccounts] = useState<{ username: string; tier: string; weight: number; url: string }[]>([]);
  const [trackedWallets, setTrackedWallets] = useState<{ address: string; label?: string }[]>([]);
  const [walletAlerts, setWalletAlerts] = useState<WalletAlert[]>([]);
  const [surgeWindow, setSurgeWindow] = useState<"5m" | "15m" | "30m" | "1h" | "6h" | "24h">("24h");

  useEffect(() => {
    setMounted(true);
  }, []);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<"idle" | "scan" | "twitter">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [dexTest, setDexTest] = useState<{ ok: boolean; message: string; newPairs?: number; trending?: number; sample?: string } | null>(null);
  const [moralisTest, setMoralisTest] = useState<{ ok: boolean; message: string; count?: number } | null>(null);
  const [twitterTest, setTwitterTest] = useState<{ ok: boolean; message: string; missing?: string[] } | null>(null);
  const [aiAnalysisCa, setAiAnalysisCa] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    score: number;
    signal: "buy" | "no_buy";
    reasons: string[];
    tokenInfo: { symbol?: string; name?: string; liquidityUsd?: number; volume24h?: number; priceUsd?: number | null; priceChange24hPct?: number; securityIssues?: string[]; securityWarnings?: string[] };
  } | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  const fetchTokens = async (tab: TabId = activeTab, showLoading = true) => {
    if (tab === "ai-analysis") {
      if (showLoading) setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError(null);
    try {
      if (tab === "wallets") {
        const res = await fetch("/api/wallet-tracker");
        const data = await res.json();
        if (data.success) {
          setWalletAlerts(data.alerts ?? []);
          setLastFetched(new Date());
        } else {
          if (res.status === 403 && data.locked) setError(data.error || "Subscribe to access this feature.");
          else setError(data.error || "Failed to load wallet alerts");
        }
        if (showLoading) setLoading(false);
        return;
      }
      const surgeWindowParam = tab === "surge" ? surgeWindow : "24h";
      const url =
        tab === "trending" ? "/api/trending"
        : tab === "surge" ? `/api/surge?window=${surgeWindowParam}&limit=80`
        : tab === "transactions" ? "/api/surge?window=24h&limit=80"
        : tab === "new" ? "/api/new-pairs?maxAgeMinutes=60&limit=50"
        : tab === "ct" ? "/api/tokens?source=twitter"
        : "/api/tokens";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens);
        setLastFetched(new Date());
      } else {
        if (res.status === 403 && data.locked) setError(data.error || "Subscribe to access this feature.");
        else setError(data.error || "Failed to load tokens");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchCtAccounts = async () => {
    try {
      const res = await fetch("/api/ct-accounts");
      const data = await res.json();
      if (data.success) setCtAccounts(data.accounts || []);
    } catch {
      setCtAccounts([]);
    }
  };

  const fetchTrackedWallets = async () => {
    try {
      const res = await fetch("/api/ct-wallets");
      const data = await res.json();
      if (data.success) setTrackedWallets(data.wallets || []);
    } catch {
      setTrackedWallets([]);
    }
  };

  // Free users: only allow New pairs and Trending tabs
  useEffect(() => {
    if (status === "loading") return;
    if (!isPaid && PAID_TABS.includes(activeTab)) setActiveTab("new");
  }, [isPaid, status, activeTab]);

  useEffect(() => {
    fetchTokens(activeTab);
    if (activeTab === "ct") fetchCtAccounts();
    if (activeTab === "wallets") fetchTrackedWallets();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "surge") fetchTokens("surge");
  }, [surgeWindow]);

  // Auto-refresh current tab every 60s (skip wallet tab to avoid heavy Helius calls)
  useEffect(() => {
    if (activeTab === "wallets" || activeTab === "ai-analysis") return;
    const interval = setInterval(() => fetchTokens(activeTab, false), AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const runAiAnalysis = async () => {
    const ca = aiAnalysisCa.trim();
    if (!ca) {
      setAiAnalysisError("Enter a contract address.");
      return;
    }
    setAiAnalysisError(null);
    setAiAnalysisResult(null);
    setAiAnalysisLoading(true);
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: ca }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAnalysisResult({
          score: data.score,
          signal: data.signal === "buy" ? "buy" : "no_buy",
          reasons: data.reasons ?? [],
          tokenInfo: data.tokenInfo ?? {},
        });
      } else {
        if (res.status === 403 && data.locked) setAiAnalysisError(data.error || "Subscribe to access AI Analysis.");
        else setAiAnalysisError(data.error || "Analysis failed.");
      }
    } catch (e) {
      setAiAnalysisError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // Sort transactions tab by total txns (buys + sells) desc
  const tokensForDisplay =
    activeTab === "transactions" && tokens.length > 0
      ? [...tokens].sort((a, b) => {
          const ta = (a.txnsBuys24h ?? 0) + (a.txnsSells24h ?? 0);
          const tb = (b.txnsBuys24h ?? 0) + (b.txnsSells24h ?? 0);
          return tb - ta;
        })
      : tokens;

  const formatVol = (v: number | null | undefined) =>
    v != null ? `$${(v / 1000).toFixed(1)}k` : "—";

  const testDexScreener = async () => {
    setDexTest(null);
    try {
      const res = await fetch("/api/test-dexscreener");
      const data = await res.json();
      setDexTest({
        ok: data.success,
        message: data.message || (data.success ? "DexScreener OK" : "DexScreener failed"),
        newPairs: data.newPairsCount,
        trending: data.trendingCount,
        sample: data.sample?.symbol ? `${data.sample.symbol} (${data.sample.dexId})` : undefined,
      });
    } catch {
      setDexTest({ ok: false, message: "Request failed" });
    }
  };

  const testMoralis = async () => {
    setMoralisTest(null);
    try {
      const res = await fetch("/api/test-moralis");
      const data = await res.json();
      setMoralisTest({
        ok: data.success,
        message: data.message || (data.success ? "Moralis OK" : "Moralis failed"),
        count: data.count,
      });
    } catch {
      setMoralisTest({ ok: false, message: "Request failed" });
    }
  };

  const testTwitter = async () => {
    setTwitterTest(null);
    try {
      const res = await fetch("/api/test-twitter");
      const data = await res.json();
      setTwitterTest({
        ok: data.success,
        message: data.message || (data.success ? "Twitter scan OK" : "Twitter scan failed"),
        missing: data.missing || [],
      });
    } catch {
      setTwitterTest({ ok: false, message: "Request failed" });
    }
  };

  const runScan = async (type: "scan" | "twitter") => {
    setScanning(type);
    setError(null);
    try {
      const url = type === "twitter" ? "/api/scan-twitter" : "/api/scan?type=new";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        await fetchTokens();
        if (data.tokens?.length > 0) {
          setError(null);
        }
      } else {
        const msg = data.error ? (data.hint ? `${data.error} ${data.hint}` : data.error) : data.hint || "Scan failed";
        setError(msg);
      }
      if (data.success && type === "twitter" && data.tokens?.length > 0) {
        setActiveTab("ct");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setScanning("idle");
    }
  };

  const formatLiq = (v: number | null) =>
    v != null ? `$${(v / 1000).toFixed(1)}k` : "—";
  const formatPrice = (v: number | null) =>
    v != null
      ? v < 0.01
        ? v.toExponential(2)
        : v.toFixed(6)
      : "—";
  const formatAge = (launchedAt: string) => {
    if (!launchedAt) return "—";
    const ms = Date.now() - new Date(launchedAt).getTime();
    const m = Math.floor(ms / 60000);
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(ms / 86400000);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };
  const dexUrl = (t: Token) =>
    t.pairAddress
      ? `https://dexscreener.com/solana/${t.pairAddress}`
      : `https://dexscreener.com/solana/${t.contractAddress}`;
  const pumpFunUrl = (t: Token) => `https://pump.fun/coin/${t.contractAddress}`;
  const axiomUrl = (t: Token) =>
    `https://axiom.trade/swap?chain=sol&inputMint=${encodeURIComponent(t.contractAddress)}`;
  const maestroUrl = (t: Token) =>
    `https://t.me/maestro?start=${encodeURIComponent(t.contractAddress)}`;

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden">
      {/* Electric background */}
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,var(--nova-glow),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,var(--nova-glow),transparent)]"
        aria-hidden
      />
      <div className="fixed inset-0 -z-10 bg-zinc-100 dark:bg-zinc-950" aria-hidden />
      <div
        className="fixed inset-0 -z-10 opacity-[0.4] dark:opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="flex flex-col">
              <span
                className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-blue-500 bg-clip-text text-transparent bg-[length:200%_100%] drop-shadow-sm"
                style={{ animation: "nova-gradient-shift 6s ease infinite" }}
              >
                NovaStaris
              </span>
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold mt-0.5 tracking-wide bg-gradient-to-r from-amber-400 via-yellow-300 to-cyan-400 bg-clip-text text-transparent dark:from-amber-300 dark:via-yellow-200 dark:to-cyan-300">
                <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0 animate-[nova-zap-pulse_2s_ease-in-out_infinite]" aria-hidden />
                Your Advanced AI Lightning Sniper
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 p-0.5" role="group" aria-label="Theme">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  !mounted ? "text-zinc-500 dark:text-zinc-400" : theme === "light"
                    ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  !mounted ? "text-zinc-500 dark:text-zinc-400" : theme === "dark"
                    ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  !mounted ? "text-zinc-500 dark:text-zinc-400" : theme === "system"
                    ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                System
              </button>
            </div>
            {status !== "authenticated" && (
              <Button variant="outline" size="sm" asChild className="border-zinc-200 dark:border-zinc-700">
                <Link href="/register">Sign in</Link>
              </Button>
            )}
            {status === "authenticated" && !isPaid && (
              <Button size="sm" asChild className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700">
                <Link href="/subscribe">Upgrade to Pro</Link>
              </Button>
            )}
            {status === "authenticated" && isPaid && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50">Pro</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTokens()}
              disabled={loading}
              className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 transition-colors"
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => runScan("scan")}
              disabled={scanning !== "idle"}
              className="bg-gradient-to-r from-cyan-500 via-violet-500 to-blue-600 text-white border-0 hover:opacity-95 hover:shadow-lg hover:shadow-cyan-500/25 dark:shadow-cyan-500/15 transition-all"
            >
              {scanning === "scan" ? "Scanning…" : "Scan new pairs"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runScan("twitter")}
              disabled={scanning !== "idle"}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
            >
              {scanning === "twitter" ? "Scanning CT…" : "Scan Twitter"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 shadow-sm">
            {error}
          </div>
        )}
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testDexScreener}
            className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50"
          >
            Test DexScreener
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={testMoralis}
            className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50"
          >
            Test Moralis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={testTwitter}
            className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50"
          >
            Test Twitter Scan
          </Button>
        </div>
        {dexTest && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              dexTest.ok
                ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
            }`}
          >
            <strong>DexScreener:</strong> {dexTest.message}
            {dexTest.ok && (
              <span className="ml-2">
                — New pairs (last 60m): {dexTest.newPairs ?? "—"}, Trending: {dexTest.trending ?? "—"}
                {dexTest.sample && ` · Sample: ${dexTest.sample}`}
              </span>
            )}
          </div>
        )}
        {moralisTest && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              moralisTest.ok
                ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
            }`}
          >
            <strong>Moralis (Pump.fun):</strong> {moralisTest.message}
            {moralisTest.count !== undefined && (
              <span className="ml-2">— New tokens: {moralisTest.count}</span>
            )}
          </div>
        )}
        {twitterTest && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              twitterTest.ok
                ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
            }`}
          >
            <strong>Twitter scan:</strong> {twitterTest.message}
          </div>
        )}

        <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-lg dark:shadow-none dark:shadow-[0_0_0_1px_rgba(34,211,238,0.06)] overflow-hidden">
          <CardHeader className="pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
              Tokens by viral score
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              Higher score = better liquidity, security &amp; socials. <strong className="text-cyan-600 dark:text-cyan-400">40+</strong> = high confidence · <strong>30–39</strong> = watch · <strong>20–29</strong> = risky · <strong>15–19</strong> = very new (Pump.fun).
            </p>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">How it works</summary>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-1">
                <li><strong>New pairs</strong> = live pairs created in the last 60 minutes. <strong>Trending</strong> = live by 24h volume + price change. <strong>Surge</strong> = high volume in 5m–24h window. <strong>Transactions</strong> = buys vs sells (24h), sorted by activity.</li>
                <li><strong>CT Scan</strong>: When 3+ tracked KOLs tweet the same coin → potential viral.</li>
                <li><strong>NovaStaris AI Analysis</strong>: Paste a token contract address; NovaStaris AI scores it 0–100, gives a buy/no-buy signal, and explains why.</li>
                <li><strong>Wallet Tracker</strong>: When 3+ tracked wallets buy the same token → alert with coin + buyers.</li>
              </ul>
            </details>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="mt-4">
              <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 flex-wrap h-auto gap-1 p-1.5 rounded-lg">
                <TabsTrigger value="new" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">New pairs</TabsTrigger>
                <TabsTrigger value="trending" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Trending</TabsTrigger>
                {isPaid && (
                  <>
                    <TabsTrigger value="surge" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Surge</TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Transactions</TabsTrigger>
                    <TabsTrigger value="ai-analysis" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">NovaStaris AI Analysis</TabsTrigger>
                    <TabsTrigger value="ct" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">CT Scan</TabsTrigger>
                    <TabsTrigger value="wallets" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Wallet Tracker</TabsTrigger>
                  </>
                )}
                {!isPaid && (
                  <Link href="/subscribe">
                    <span className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 transition-colors cursor-pointer">
                      Upgrade to Pro
                    </span>
                  </Link>
                )}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {activeTab === "ct" && ctAccounts.length > 0 && (
              <details className="mx-6 mt-4 mb-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Accounts we track ({ctAccounts.length})
                </summary>
                <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2">
                  {ctAccounts.slice(0, 50).map((a) => (
                    <a
                      key={a.username}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-zinc-700 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                    >
                      @{a.username}
                    </a>
                  ))}
                  {ctAccounts.length > 50 && <span className="text-xs text-muted-foreground">+{ctAccounts.length - 50} more</span>}
                </div>
              </details>
            )}
            {activeTab === "surge" && (
              <div className="mx-6 mt-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-3">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Volume window:</span>
                {(["5m", "15m", "30m", "1h", "6h", "24h"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSurgeWindow(w)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      surgeWindow === w
                        ? "bg-cyan-500 text-white dark:bg-cyan-600"
                        : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"
                    }`}
                  >
                    {w}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">5m/15m/30m estimated from 1h. Up to 80 coins.</span>
              </div>
            )}
            {activeTab === "wallets" && (
              <details className="mx-6 mt-4 mb-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Wallets we track ({trackedWallets.length})
                </summary>
                <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2">
                  {trackedWallets.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      When 3+ tracked wallets buy the same coin, it appears here. Configure tracked wallets in settings.
                    </span>
                  ) : (
                    trackedWallets.map((w) => (
                      <a
                        key={w.address}
                        href={`https://solscan.io/account/${w.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-zinc-700 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                      >
                        {w.label ? `${w.label}: ` : ""}
                        {w.address.slice(0, 4)}…{w.address.slice(-4)}
                      </a>
                    ))
                  )}
                </div>
              </details>
            )}
            {loading && activeTab !== "ai-analysis" ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <span className="inline-block animate-[nova-shimmer_1.2s_ease-in-out_infinite]">Loading…</span>
              </div>
            ) : activeTab === "ai-analysis" ? (
              <div className="mx-6 py-8 max-w-2xl">
                <p className="text-sm text-muted-foreground mb-4">
                  Enter a Solana token contract address (CA). NovaStaris AI will analyze on-chain data and security, then give a score (0–100) and reasons.
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="ai-ca" className="sr-only">Contract address</label>
                    <input
                      id="ai-ca"
                      type="text"
                      placeholder="e.g. So11111111111111111111111111111111111111112"
                      value={aiAnalysisCa}
                      onChange={(e) => { setAiAnalysisCa(e.target.value); setAiAnalysisError(null); }}
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <Button
                    onClick={runAiAnalysis}
                    disabled={aiAnalysisLoading}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
                  >
                    {aiAnalysisLoading ? "Analyzing…" : "Analyze"}
                  </Button>
                </div>
                {aiAnalysisError && (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{aiAnalysisError}</p>
                )}
                {aiAnalysisResult && (
                  <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{aiAnalysisResult.tokenInfo?.symbol ?? "—"}</span>
                        <span className="text-sm text-muted-foreground">{aiAnalysisResult.tokenInfo?.name}</span>
                      </div>
                      <div
                        className={`text-4xl font-bold tabular-nums ${
                          aiAnalysisResult.score >= 76 ? "text-emerald-600 dark:text-emerald-400" :
                          aiAnalysisResult.score >= 51 ? "text-cyan-600 dark:text-cyan-400" :
                          aiAnalysisResult.score >= 26 ? "text-amber-600 dark:text-amber-400" :
                          "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {aiAnalysisResult.score}
                        <span className="text-lg font-normal text-muted-foreground ml-1">/ 100</span>
                      </div>
                      <Badge
                        className={`text-sm font-bold px-3 py-1 ${
                          aiAnalysisResult.signal === "buy"
                            ? "bg-emerald-500 text-white dark:bg-emerald-600 border-0 hover:bg-emerald-600 dark:hover:bg-emerald-700"
                            : "bg-rose-500 text-white dark:bg-rose-600 border-0 hover:bg-rose-600 dark:hover:bg-rose-700"
                        }`}
                      >
                        {aiAnalysisResult.signal === "buy" ? "BUY" : "NO BUY"}
                      </Badge>
                    </div>
                    {aiAnalysisResult.tokenInfo && (aiAnalysisResult.tokenInfo.liquidityUsd != null || aiAnalysisResult.tokenInfo.volume24h != null) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Liquidity ${(aiAnalysisResult.tokenInfo.liquidityUsd ?? 0).toLocaleString()} · Vol 24h ${(aiAnalysisResult.tokenInfo.volume24h ?? 0).toLocaleString()}
                        {aiAnalysisResult.tokenInfo.priceChange24hPct != null && ` · ${aiAnalysisResult.tokenInfo.priceChange24hPct >= 0 ? "+" : ""}${aiAnalysisResult.tokenInfo.priceChange24hPct.toFixed(1)}% 24h`}
                      </p>
                    )}
                    {(aiAnalysisResult.tokenInfo?.securityIssues?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{(aiAnalysisResult.tokenInfo?.securityIssues ?? []).join(" ")}</p>
                    )}
                    <ul className="mt-4 list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {aiAnalysisResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : activeTab === "wallets" ? (
              walletAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm text-center px-6">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">No wallet alerts yet.</p>
                  <p className="mt-2">
                    When 3+ tracked wallets buy the same token, it appears here. Configure wallet tracking in settings.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                      <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Coin</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Buyers</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                      <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Who bought</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletAlerts.map((a) => (
                      <TableRow key={a.contractAddress} className="border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20">
                        <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{a.symbol}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 border-0 font-semibold">{a.buyerCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatLiq(a.liquidity ?? null)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatPrice(a.priceUSD ?? null)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {a.buyers.slice(0, 5).map((b) => (b.label ? b.label : `${b.address.slice(0, 4)}…${b.address.slice(-4)}`)).join(", ")}
                          {a.buyers.length > 5 && ` +${a.buyers.length - 5}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <a href={`https://dexscreener.com/solana/${a.contractAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Dex</a>
                            <a href={`https://pump.fun/${a.contractAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Pump</a>
                            <a href={`https://axiom.trade/swap?chain=sol&inputMint=${encodeURIComponent(a.contractAddress)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Axiom</a>
                            <a href={`https://t.me/maestro?start=${encodeURIComponent(a.contractAddress)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="Maestro">Maestro</a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : tokensForDisplay.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm text-center px-6">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {activeTab === "ct" ? "No CT tokens yet." : activeTab === "surge" ? "No surge tokens right now." : activeTab === "transactions" ? "No transaction data yet." : activeTab === "trending" ? "No trending tokens right now." : activeTab === "new" ? "No new pairs in the last 60m." : "No tokens yet."}
                </p>
                <p className="mt-2">
                  {activeTab === "ct"
                    ? "Run \"Scan Twitter\" to find coins mentioned by 3+ tracked KOLs."
                    : activeTab === "surge"
                      ? `Surge shows coins with high volume in the selected window (${surgeWindow}). 5m/15m/30m estimated from 1h. Live from DexScreener, up to 80 coins.`
                      : activeTab === "transactions"
                        ? "Transactions tab shows coins by 24h buy/sell counts. Data from Surge (DexScreener). Refreshes every 60s."
                        : activeTab === "trending"
                          ? "Trending = live by 24h volume + price change. Try again in a moment."
                          : activeTab === "new"
                            ? "Live new pairs = pairs created in the last 60 minutes (DexScreener). Refreshes every 60s."
                            : "Run Scan to save tokens to the DB, or use New pairs for live recent listings."}
                </p>
                <p className="mt-4 text-xs max-w-md text-zinc-500 dark:text-zinc-400">
                  {activeTab === "surge"
                    ? `Surge: volume in last ${surgeWindow}. List auto-refreshes every 60s.`
                    : activeTab === "transactions"
                      ? "Sorted by total transactions (buys + sells) descending."
                      : activeTab === "ct"
                        ? "CT Scan: KOLs, smart money. When 3+ tweet the same coin → potential viral."
                        : activeTab === "new"
                          ? "New pairs = created in last 60m. List auto-refreshes every 60s."
                          : "Trending = live movers. List auto-refreshes every 60s."}
                </p>
              </div>
            ) : activeTab === "transactions" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Symbol</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-zinc-700 dark:text-zinc-300">Name</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Age</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Vol 24h</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Buys</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Sells</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokensForDisplay.map((t) => (
                    <TableRow key={t.id} className="border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20">
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{t.symbol}</TableCell>
                      <TableCell className="max-w-[140px] truncate hidden sm:table-cell text-muted-foreground">{t.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{formatAge(t.launchedAt)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatLiq(t.liquidity)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-cyan-700 dark:text-cyan-300">{formatVol(t.volume24h)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{(t.txnsBuys24h ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">{(t.txnsSells24h ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatPrice(t.priceUSD)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <a href={dexUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Dex</a>
                          <a href={pumpFunUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Pump</a>
                          <a href={axiomUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Axiom</a>
                          <a href={maestroUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="Maestro">Maestro</a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Symbol</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-zinc-700 dark:text-zinc-300">Name</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Score</TableHead>
                    {activeTab === "surge" && <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Vol ({surgeWindow})</TableHead>}
                    {activeTab === "surge" && <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">TXNS</TableHead>}
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Age</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokensForDisplay.map((t) => (
                    <TableRow
                      key={t.id}
                      className="border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20"
                    >
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{t.symbol}</TableCell>
                      <TableCell className="max-w-[140px] truncate hidden sm:table-cell text-muted-foreground">
                        {t.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Badge variant="secondary" className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 border-0 font-semibold">
                            {t.viralScore}
                          </Badge>
                          {activeTab === "ct" && t.kolCount != null && (
                            <span className="text-xs text-muted-foreground" title="KOLs who tweeted">
                              {t.kolCount} KOL{t.kolCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {activeTab === "surge" && (
                        <TableCell className="text-right tabular-nums font-medium text-cyan-700 dark:text-cyan-300">
                          {formatVol(
                            surgeWindow === "5m" ? t.volume5m
                            : surgeWindow === "15m" ? t.volume15m
                            : surgeWindow === "30m" ? t.volume30m
                            : surgeWindow === "1h" ? t.volume1h
                            : surgeWindow === "6h" ? t.volume6h
                            : t.volume24h
                          )}
                        </TableCell>
                      )}
                      {activeTab === "surge" && (
                        <TableCell className="text-right tabular-nums text-xs">
                          {t.txnsBuys24h != null || t.txnsSells24h != null ? (
                            <>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {((t.txnsBuys24h ?? 0) + (t.txnsSells24h ?? 0)).toLocaleString()}
                              </span>
                              <span className="block text-muted-foreground">
                                {(t.txnsBuys24h ?? 0).toLocaleString()} / {(t.txnsSells24h ?? 0).toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                        {formatAge(t.launchedAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLiq(t.liquidity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPrice(t.priceUSD)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <a
                            href={dexUrl(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                          >
                            Dex
                          </a>
                          <a
                            href={pumpFunUrl(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                          >
                            Pump
                          </a>
                          <a
                            href={axiomUrl(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                          >
                            Axiom
                          </a>
                          <a
                            href={maestroUrl(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                            title="Open in Maestro Telegram bot"
                          >
                            Maestro
                          </a>
                          {t.twitter && (
                            <a
                              href={t.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                            >
                              X
                            </a>
                          )}
                          {t.telegram && (
                            <a
                              href={t.telegram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                            >
                              TG
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
