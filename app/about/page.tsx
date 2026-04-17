"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Brain, Target, Shield, Sparkles, TrendingUp, BarChart3, Activity, MessageCircle } from "lucide-react";

function AboutContent() {
  const searchParams = useSearchParams();
  const copy = (searchParams.get("copy") ?? "a").toLowerCase();
  const isVariantB = copy === "b";

  const heroTitle = isVariantB
    ? "Trade With Clarity. Execute With Conviction."
    : "From Meme Coin Edge to Multi-Market Execution.";
  const heroBody = isVariantB
    ? "NovaStaris unifies Solana/BSC meme coin intelligence, futures workflow, and prediction-market radar so you can make faster, better-structured decisions under pressure."
    : "NovaStaris started as a meme coin intelligence engine. Today it is a full multi-market decision platform for Solana + BSC meme coins, Crypto Futures, and prediction markets.";
  const heroTail = isVariantB
    ? "One platform for signal, structure, and speed."
    : "One dashboard. One workflow. Faster conviction.";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 sm:px-4 py-8 sm:py-12">
        <div className="text-center mb-12">
          <p className="inline-flex items-center rounded-full border border-cyan-200/70 dark:border-cyan-800/70 bg-cyan-50/70 dark:bg-cyan-950/40 px-3 py-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300 mb-4">
            NovaStaris Positioning {isVariantB ? "B" : "A"}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-blue-500 bg-clip-text text-transparent">
            About NovaStaris
          </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{heroTitle}</strong>{" "}
              {heroBody} Use{" "}
              <strong className="text-cyan-600 dark:text-cyan-400">NovaStaris AI Agent</strong> for fast contract
              analysis, <strong className="text-cyan-600 dark:text-cyan-400">Crypto Futures</strong> tooling for
              execution framing, and <strong className="text-cyan-600 dark:text-cyan-400">Nova Polymarket Pro</strong>{" "}
              for wallet intelligence and radar-driven market context. {heroTail}
            </p>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
              Built for traders who want to act before the crowd, not react after the move.
            </p>
        </div>

        <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-lg overflow-hidden mb-8">
          <CardContent className="p-6 space-y-6 text-zinc-700 dark:text-zinc-300">
              <p className="text-base leading-relaxed">
                <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris</strong> is built for serious traders
                who need signal, speed, and structure. We combine real-time market discovery, agentic AI analysis, and
                actionable workflows so you can move from idea to execution with clarity instead of noise.
              </p>
              <p className="text-base leading-relaxed">
                Marketing promise, operational reality: faster research loops, cleaner entries, and stronger discipline.
                You get fewer random bets and more repeatable decision-making across volatile markets.
              </p>
              <p className="text-base leading-relaxed">
                From meme coin momentum to futures structure and prediction-market edge, NovaStaris gives you a complete
                stack: <strong className="text-zinc-900 dark:text-zinc-100">Surge</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Transactions</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Crypto Narratives</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">NovaForecast + NovaRadar</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">NovaQ</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Nova Investment Agent</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Trading Bot</strong>, and{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Nova Polymarket Pro</strong>. VIP on-demand
                workspaces also include <strong className="text-zinc-900 dark:text-zinc-100">Nova Prop Firm Bot</strong>{" "}
                and <strong className="text-zinc-900 dark:text-zinc-100">Nova Ultimate</strong>. This is no longer just
                a coin scanner - it is an integrated growth and execution suite.
              </p>
              <p className="text-base leading-relaxed">
                <strong className="text-zinc-900 dark:text-zinc-100">Trending perps</strong>—one feed, all the heat. See what’s pumping or dumping across 5m, 15m, 30m, 1h, and 24h so you catch momentum before the crowd.{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Perp Radar</strong> scans for the biggest 24h perp movers across exchanges so you don’t miss 100%+ runs.{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Crypto Futures</strong> gives Pro and VIP users two edges: <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Chart Analysis</strong>—upload a chart (any timeframe), set margin and leverage, and get AI support/resistance, entry zone, take profit and stop loss tailored for futures; <strong className="text-zinc-900 dark:text-zinc-100">Institutional Workflow</strong>—a 4-phase checklist (macro bias, daily flow check, pre-trade setup, execution rules) using powerful tools (COT reports via CFTC and Tradingster, Coinglass, CryptoQuant, Arkham, Whale Alert) and six non-negotiable rules so you trade with institutional flow instead of against it. VIP-only tools in that workflow also include <strong className="text-zinc-900 dark:text-zinc-100">Nova Forecast &amp; NovaQ</strong>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Nova Investment Agent</strong>{" "}
                <span className="text-zinc-600 dark:text-zinc-500">(Finance &amp; Investment Agent)</span>,{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">Nova+</strong>, and <strong className="text-zinc-900 dark:text-zinc-100">NovaScalper</strong>.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 pt-4">
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <Brain className="h-6 w-6 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI capacity</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Our AI evaluates liquidity, security, and socials to score tokens and explain why—so you get a second opinion in seconds, not guesswork.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <Target className="h-6 w-6 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Built to snipe</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      New pairs, trending, surge, and transaction views on Solana; BSC tab with Go Hunting (New pairs, Final Stretch, Migrated, Trending) for meme coins on Binance Smart Chain. No fluff, no noise.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <Shield className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Viral score</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Every token gets a viral score based on liquidity, security, and socials—so you know at a glance what’s high conviction vs high risk.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <Sparkles className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">VIP: CT Scan, Wallet Tracker, Coach Calls, NovaForecast, NovaQ, Nova Investment Agent (Finance &amp; Investment), Nova+, NovaScalper + AI Trading Bot</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      VIP subscribers get CT Scan (Twitter tracker) on-demand and Wallet Tracker access: Top Leverage Traders for all VIP users, plus Meme Coins Traders on-demand. Add Coach Calls + Telegram Signals, <strong className="text-zinc-900 dark:text-zinc-100">NovaForecast Agent</strong>, <strong className="text-zinc-900 dark:text-zinc-100">NovaQ</strong> (support/resistance + direction), <strong className="text-zinc-900 dark:text-zinc-100">Nova Investment Agent</strong>{" "}
                      <span className="text-zinc-600 dark:text-zinc-500">(Finance &amp; Investment Agent)</span>{" "}
                      for risk/duration leverage framing, <strong className="text-zinc-900 dark:text-zinc-100">Nova+</strong> and{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">NovaScalper</strong> under Crypto Futures (access rules apply), plus the NovaStaris AI Trading Bot (Blofin). Add your own meme coin wallets (max 5) or leverage wallets (unlimited). Coach Calls: exclusive CA in-app and via Telegram; add your Telegram ID to get signals there.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <TrendingUp className="h-6 w-6 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Trending perps</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      One feed for the biggest perp movers—5m to 24h. Spot momentum early, then use Crypto Futures (AI or Institutional Workflow) to trade with an edge.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <TrendingUp className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Perp Radar</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Cross-exchange radar for the biggest 24h perp movers—so you can catch Binance and CEX perps going 100%+ before CT wakes up.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4">
                  <TrendingUp className="h-6 w-6 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Crypto Futures</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Chart Analysis</strong> — upload a chart, set margin and leverage; get AI support/resistance, entry zone, take profit and stop loss. <strong className="text-zinc-900 dark:text-zinc-100">Institutional Workflow</strong> — 4-phase system (macro bias, daily flow, pre-trade, execution) with powerful tools and six rules so you trade with institutional flow. VIP: <strong className="text-zinc-900 dark:text-zinc-100">Nova Investment Agent</strong>{" "}
                      <span className="text-zinc-600 dark:text-zinc-500">(Finance &amp; Investment Agent)</span>,{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">Nova+</strong>, and <strong className="text-zinc-900 dark:text-zinc-100">NovaScalper</strong> appear alongside forecast &amp; Q tools for eligible accounts.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border-2 border-emerald-200/80 dark:border-emerald-700/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-4">
                  <MessageCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">NovaConnect</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      The first social platform built for crypto traders. Post in the community feed, see who’s online, and DM other traders—share ideas, charts, and alpha without leaving NovaStaris. Pro/VIP or admin-approved access.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border-2 border-cyan-200/80 dark:border-cyan-700/80 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 sm:col-span-2">
                  <BarChart3 className="h-6 w-6 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">NovaStaris AI Trading Bot — Crypto Futures (Blofin)</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Automate long/short with simple strategy, indicators, AI, or <strong className="text-zinc-900 dark:text-zinc-100">hybrid</strong> (TA + AI must agree). Configure symbol, leverage, TP/SL; run demo or live on Blofin. Place limit orders at AI-suggested entry; optional AI monitor evaluates positions and can close on negative trend. Start, stop, or close with one click. <strong className="text-amber-700 dark:text-amber-400">VIP + On demand.</strong> Same area includes VIP{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">Nova Investment Agent</strong>{" "}
                      <span className="text-zinc-600 dark:text-zinc-500">(Finance &amp; Investment Agent)</span>,{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">Nova+</strong> (analysis framing), and a separate tab,{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">NovaScalper</strong>, for a different style of automation when enabled—details are product-only. Wallet tracking lives under the Wallet Tracker tab. Other dashboard tabs cover <strong className="text-zinc-900 dark:text-zinc-100">Crypto Narratives</strong>, <strong className="text-zinc-900 dark:text-zinc-100">NovaRadar</strong> (NovaForecast), <strong className="text-zinc-900 dark:text-zinc-100">Nova Polymarket Pro</strong>, <strong className="text-zinc-900 dark:text-zinc-100">Nova Prop Firm Bot</strong>, and <strong className="text-zinc-900 dark:text-zinc-100">Nova Ultimate</strong> where your plan and on-demand flags apply.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border-2 border-cyan-200/80 dark:border-cyan-700/80 bg-cyan-50/60 dark:bg-cyan-950/30 p-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Ready to trade with a system, not emotion?
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Start with Pro for daily edge. Upgrade to VIP when you want Nova Polymarket Pro, on-demand bot workspaces, and advanced tactical workflows.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white">
                    <Link href="/subscribe">Start your plan</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/">Open dashboard</Link>
                  </Button>
                </div>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 pt-2">
                NovaStaris does not provide financial advice. Always do your own research and never risk more than you can afford to lose.
              </p>
            </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button asChild className="bg-gradient-to-r from-cyan-500 via-violet-500 to-blue-600 text-white border-0">
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-500">Loading…</div>}>
      <AboutContent />
    </Suspense>
  );
}
