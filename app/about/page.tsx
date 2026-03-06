"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Brain, Target, Shield, Sparkles, TrendingUp, BarChart3, Activity } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-blue-500 bg-clip-text text-transparent">
            About NovaStaris
          </h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Spot viral tokens before the crowd. Analyze with NovaStaris Advanced AI Agent in seconds. Move with smart money—Solana, BSC, Crypto Futures, and an automated <strong className="text-cyan-600 dark:text-cyan-400">NovaStaris AI Trading Bot</strong> (Crypto Futures) in one platform.
          </p>
        </div>

        <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-lg overflow-hidden mb-8">
          <CardContent className="p-6 space-y-6 text-zinc-700 dark:text-zinc-300">
              <p className="text-base leading-relaxed">
                <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris</strong> brings AI-powered discovery and analysis to <strong className="text-zinc-900 dark:text-zinc-100">Solana</strong> and <strong className="text-zinc-900 dark:text-zinc-100">BSC</strong> meme coins, plus <strong className="text-zinc-900 dark:text-zinc-100">Crypto Futures</strong>. We combine real-time on-chain data, social signals, and NovaStaris AI Agentic analysis so you can discover and evaluate viral tokens before the crowd—and decide with confidence.
              </p>
              <p className="text-base leading-relaxed">
                Our system surfaces new pairs, trending volume, and surge activity on Solana and BSC (BSC tab includes <strong className="text-zinc-900 dark:text-zinc-100">Go Hunting</strong>: New pairs, Final Stretch, Migrated, and Trending—all users can access the BSC tab). We layer on <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Agent</strong>: paste any Solana or BSC token contract address to get a 0–100 score, a clear buy/no-buy signal, and a concise explanation (BSC AI Agent is <strong className="text-zinc-900 dark:text-zinc-100">for Pro and VIP only</strong>). <strong className="text-zinc-900 dark:text-zinc-100">Pro</strong> subscribers get Surge, Transactions, NovaStaris AI Agent (Solana and BSC), and Crypto Futures. <strong className="text-zinc-900 dark:text-zinc-100">VIP</strong> adds the Twitter tracker (CT Scan), Wallet Tracker (Meme Coins Traders + Top Leverage Traders), Coach Calls + Telegram Signals, and the <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Trading Bot</strong> (Crypto Futures on Blofin—automate long/short with AI monitor and optional autopilot). Add your own meme coin wallets (max 5) or leverage wallets (unlimited). Coach Calls: exclusive CA in-app and via our Telegram Call channel; add your Telegram ID to get signals there.
              </p>
              <p className="text-base leading-relaxed">
                <strong className="text-zinc-900 dark:text-zinc-100">Trending perps</strong>—one feed, all the heat. See what’s pumping or dumping across 5m, 15m, 30m, 1h, and 24h so you catch momentum before the crowd. <strong className="text-zinc-900 dark:text-zinc-100">Crypto Futures</strong> gives Pro and VIP users two edges: <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Chart Analysis</strong>—upload a chart (any timeframe), set margin and leverage, and get AI support/resistance, entry zone, take profit and stop loss tailored for futures; <strong className="text-zinc-900 dark:text-zinc-100">Institutional Workflow</strong>—a 4-phase checklist (macro bias, daily flow check, pre-trade setup, execution rules) using powerful tools (COT reports via CFTC and Tradingster, Coinglass, CryptoQuant, Arkham, Whale Alert) and six non-negotiable rules so you trade with institutional flow instead of against it.
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
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">VIP: CT Scan, Wallet Tracker, Coach Calls + NovaStaris AI Trading Bot</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      VIP subscribers get CT Scan (Twitter tracker), Wallet Tracker (Meme Coins Traders + Top Leverage Traders), Coach Calls + Telegram Signals, and the NovaStaris AI Trading Bot (Crypto Futures on Blofin). Add your own meme coin wallets (max 5) or leverage wallets (unlimited). Coach Calls: exclusive CA in-app and via Telegram; add your Telegram ID to get signals there.
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
                  <TrendingUp className="h-6 w-6 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Crypto Futures</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Chart Analysis</strong> — upload a chart, set margin and leverage; get AI support/resistance, entry zone, take profit and stop loss. <strong className="text-zinc-900 dark:text-zinc-100">Institutional Workflow</strong> — 4-phase system (macro bias, daily flow, pre-trade, execution) with powerful tools and six rules so you trade with institutional flow.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border-2 border-cyan-200/80 dark:border-cyan-700/80 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 sm:col-span-2">
                  <BarChart3 className="h-6 w-6 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">NovaStaris AI Trading Bot — Crypto Futures (Blofin)</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Automate long/short with simple strategy, indicators, AI, or <strong className="text-zinc-900 dark:text-zinc-100">hybrid</strong> (TA + AI must agree). Configure symbol, leverage, TP/SL; run demo or live on Blofin. Place limit orders at AI-suggested entry; optional AI monitor evaluates positions and can close on negative trend. Start, stop, or close with one click. <strong className="text-amber-700 dark:text-amber-400">VIP + On demand.</strong> Wallet tracking (meme coins and Top Leverage Traders) lives under the Wallet Tracker tab. We are working toward per-user Blofin API configuration so you can connect your own account and run the bot with your keys; access is currently granted on demand.
                    </p>
                  </div>
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
