"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <Link href="/" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <p className="text-sm text-muted-foreground">
              NovaStaris is a multi-market workspace: meme coins, crypto perps, forex &amp; indices, and prediction markets.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            <p>
              <strong>Go Hunting / Trending / Surge / Transactions:</strong> early discovery and momentum monitoring across
              supported markets.
            </p>
            <p>
              <strong>NovaStaris AI Agent:</strong> quick AI contract analysis with risk framing.
            </p>
            <p>
              <strong>Crypto Futures:</strong> AI chart analysis + institutional workflow support for structured execution.
            </p>
            <p>
              <strong>NovaForecast Agent (VIP):</strong> scan crypto perp ranges—high/low zones, NovaQ structure, NovaRadar for
              limit orders. Built for BTC, ETH, alts, and metals on supported venues.
            </p>
            <p>
              <strong>Nova Forex Agent (VIP):</strong> your broker-style Market Watch in one tab—refresh gold, FX majors, indices,
              and top equities, then run <strong>NovaQ Forex</strong> (support, resistance, touch counts), Smart Analysis, Fib,
              Radar, and optional Scalp on symbols like <strong>XAUUSD</strong>. Separate desk from crypto; same Nova discipline.
            </p>
            <p>
              <strong>Nova Futures Narratives:</strong> headline narrative + CFTC institutional positioning context.
            </p>
            <p>
              <strong>Nova Eagle / Crypto Buddie:</strong> VIP futures intelligence tabs for whale positioning and short-horizon
              reads.
            </p>
            <p>
              <strong>Wallet Tracker:</strong> monitor tracked wallet behavior and convert insights into watchlists.
            </p>
            <p>
              <strong>VIP/UVIP workspaces:</strong> advanced decision and execution tools (Polymarket Pro, prop-firm bot, Ultimate,
              and more) when your plan and admin flags allow.
            </p>
            <p className="text-xs text-muted-foreground pt-2">
              Not financial advice. Forex and metals quotes are reference OHLC; always confirm prices with your broker.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
