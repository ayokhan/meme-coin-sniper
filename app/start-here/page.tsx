"use client";

import Link from "next/link";
import { Zap } from "lucide-react";

const PATHS = [
  {
    title: "Meme coin hunter",
    blurb: "Find early Solana & BSC momentum, then run AI contract analysis.",
    href: "/?tab=new",
    cta: "Open Go Hunting",
    steps: ["Go Hunting / Trending / Surge", "Transactions & Watchlist", "AI Agent for contract analysis"],
  },
  {
    title: "Futures & metals",
    blurb: "Structure crypto perp and metals trades with chart AI and VIP desks.",
    href: "/?tab=futures",
    cta: "Open Crypto Futures",
    steps: ["Crypto Futures — chart AI + workflow", "VIP: NovaForecast / NovaRadar / NovaQ", "VIP: Nova Forex for XAUUSD, FX, indices"],
  },
  {
    title: "Wallet tracking",
    blurb: "Follow smart money wallets and CT signals into actionable lists.",
    href: "/?tab=wallets",
    cta: "Open Wallet Tracker",
    steps: ["Wallet Tracker", "CT Scan (VIP / on-demand)", "Coach Calls"],
  },
  {
    title: "Prediction markets",
    blurb: "Polymarket wallet intelligence and radar-driven market context.",
    href: "/?tab=polymarket-bot",
    cta: "Open Polymarket",
    steps: ["Nova Polymarket tab", "Track wallets & radar", "VIP / on-demand if locked"],
  },
] as const;

const TAB_GROUPS = [
  {
    heading: "Core discovery",
    items: [
      { name: "Go Hunting / Trending / Surge", use: "Early meme discovery and momentum." },
      { name: "Transactions / Watchlist / BSC", use: "Flow monitoring and saved pairs." },
      { name: "AI Agent", use: "Fast contract analysis with risk framing." },
    ],
  },
  {
    heading: "Markets",
    items: [
      { name: "Crypto Futures", use: "Upload a chart → AI entry / TP / SL framing." },
      { name: "Trending Perps / Perp Radar / Narratives", use: "Perp context and narrative heat." },
    ],
  },
  {
    heading: "VIP desks",
    items: [
      { name: "NovaForecast / Nova Forex", use: "Perp ranges, NovaQ, Radar; forex Market Watch." },
      { name: "CT Scan / Wallet Tracker / Coach", use: "Twitter + wallet intel and coach signals." },
      { name: "Eagle / Buddie / Investment / Nova+", use: "Deeper VIP intelligence workspaces." },
    ],
  },
  {
    heading: "Bots & more",
    items: [
      { name: "Trading Bots / Forex Bots / Prop Firm", use: "Execution bots on your accounts." },
      { name: "Polymarket / Ultimate / University", use: "Prediction markets, advanced tools, education." },
      { name: "Chat / Support", use: "Ask us anything — top-right menu." },
    ],
  },
] as const;

export default function StartHerePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 sm:px-4 py-8 sm:py-12 space-y-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-400">
            Start here
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Pick one path. Open the right tab.
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            NovaStaris is a multi-market workspace. Don&apos;t open every tab on day one — choose how you trade,
            then use the matching tools.
          </p>
        </div>

        <section className="space-y-4" aria-labelledby="paths-heading">
          <h2 id="paths-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Your starting path
          </h2>
          <div className="space-y-3">
            {PATHS.map((path) => (
              <div
                key={path.title}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{path.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{path.blurb}</p>
                    <ol className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300 list-decimal list-inside">
                      {path.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <Link
                    href={path.href}
                    className="shrink-0 inline-flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    {path.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6" aria-labelledby="tabs-heading">
          <div>
            <h2 id="tabs-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Tab map
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              High-level only — open a tab when you need it.
            </p>
          </div>
          {TAB_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400 mb-2">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.name} className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400"> — {item.use}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Still stuck? Use <Link href="/chat" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">Chat</Link>{" "}
            or{" "}
            <Link href="/support" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">Support</Link>{" "}
            from the top menu.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Want the longer product story?{" "}
            <Link href="/about" className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200">
              About NovaStaris
            </Link>
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 pt-2">
            Not financial advice. Always confirm prices and risk with your broker or venue.
          </p>
        </section>
      </main>
    </div>
  );
}
