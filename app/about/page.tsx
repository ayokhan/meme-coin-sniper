"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Brain, Target, Shield, Sparkles } from "lucide-react";

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
            Advanced AI-powered meme snipping for Solana. Spot viral tokens early, analyze with AI, and move with smart money.
          </p>
        </div>

        <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-lg overflow-hidden mb-8">
          <CardHeader className="pb-2">
            <CardContent className="p-6 pt-0 space-y-6 text-zinc-700 dark:text-zinc-300">
              <p className="text-base leading-relaxed">
                <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris</strong> is an advanced AI-powered meme snipping system built for Solana. We combine real-time on-chain data, social signals, and AI analysis so you can discover and evaluate viral tokens before the crowd—and decide with confidence.
              </p>
              <p className="text-base leading-relaxed">
                Our system surfaces new pairs, trending volume, and surge activity, then layers on <strong className="text-zinc-900 dark:text-zinc-100">NovaStaris AI Analysis</strong>: paste any token contract and get a 0–100 score, a clear buy/no-buy signal, and a concise explanation. Pro users also get CT Scan (influencer and smart-money buzz) and Wallet Tracker (alerts when tracked wallets pile into the same token), so you can move with the flow instead of chasing it.
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
                      New pairs, trending, surge, and transaction views put the right tokens in front of you—fast. No fluff, no noise.
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
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Pro tools</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      CT Scan and Wallet Tracker give Pro users an edge: spot coins going viral from smart money and get alerted when tracked wallets pile in.
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
