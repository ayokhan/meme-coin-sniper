"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type NarrativeTool = {
  name: string;
  url: string | null;
  free: boolean;
  action: string;
};

type NarrativePhase = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  icon: string;
  tools: NarrativeTool[];
  checklist: string[];
  output: string;
};

const PHASES: NarrativePhase[] = [
  {
    id: "global",
    title: "GLOBAL TRENDS",
    subtitle: "What’s rising worldwide",
    description: "Spot themes and topics gaining traction globally. Meme coins often mirror or precede these trends.",
    color: "cyan",
    icon: "🌐",
    tools: [
      { name: "Google Trends", url: "https://trends.google.com/trends/explore", free: true, action: "Explore trending searches and topics by region and time range. Compare multiple terms." },
      { name: "Exploding Topics", url: "https://explodingtopics.com", free: true, action: "Discover topics and trends that are growing fast before they peak." },
      { name: "Trends24", url: "https://trends24.in", free: true, action: "Real-time trending hashtags and topics by country (Twitter/X, Google, etc.)." },
      { name: "Google Trends – Trending now", url: "https://trends.google.com/trending", free: true, action: "Daily trending searches; filter by category (e.g. News, Entertainment)." },
    ],
    checklist: [
      "Which topics or phrases are rising in the last 24h–7 days?",
      "Any major news or cultural moments (e.g. gov announcements, viral events)?",
      "Could this narrative spawn or already have a meme coin theme?",
    ],
    output: "Short list of global narratives to watch → map to potential coin themes",
  },
  {
    id: "us",
    title: "US TRENDS",
    subtitle: "What’s hot in the US",
    description: "US-driven narratives often lead meme coin cycles. Politics, pop culture, and news move markets.",
    color: "violet",
    icon: "🇺🇸",
    tools: [
      { name: "Google Trends (US)", url: "https://trends.google.com/trends/explore?geo=US", free: true, action: "US-only trending searches and comparisons." },
      { name: "X (Twitter) Trending (US)", url: "https://twitter.com/explore/tabs/trending", free: true, action: "See what’s trending on X in the US; often where meme narratives ignite." },
      { name: "Reddit r/trending / r/popular", url: "https://www.reddit.com/r/trending", free: true, action: "Trending and popular posts; many meme themes start here." },
      { name: "TikTok Trending", url: "https://www.tiktok.com/explore", free: true, action: "Trending sounds and hashtags; youth-driven narratives that can spill into crypto." },
    ],
    checklist: [
      "What’s trending in the US in the last 24–48 hours?",
      "Any political, celebrity, or “alien-level” news that could become a meme?",
      "Is there already a coin with this narrative, or room for a new one?",
    ],
    output: "US narrative shortlist → cross-check with existing meme coins",
  },
  {
    id: "memes",
    title: "TRENDING MEMES",
    subtitle: "Viral memes and formats",
    description: "Memes that are going viral often get tokenized. Track formats and characters that are spreading.",
    color: "amber",
    icon: "📷",
    tools: [
      { name: "Know Your Meme", url: "https://knowyourmeme.com", free: true, action: "Track meme origins, spread, and current viral memes." },
      { name: "Reddit r/memes, r/dankmemes", url: "https://www.reddit.com/r/memes", free: true, action: "See what meme formats and themes are blowing up." },
      { name: "X (Twitter) – search by hashtag", url: "https://twitter.com/search-advanced", free: true, action: "Search viral hashtags and meme phrases; see engagement and velocity." },
      { name: "Imgur / 9GAG trending", url: "https://imgur.com", free: true, action: "Trending image memes; often early signal for tokenizable characters or jokes." },
    ],
    checklist: [
      "Which meme formats or characters are spreading fastest this week?",
      "Is there a clear “face” or “name” that could become a token (e.g. a character, politician, animal)?",
      "Has this meme already been tokenized? If not, is the timing right?",
    ],
    output: "List of viral memes with token potential → timing and uniqueness check",
  },
  {
    id: "coins",
    title: "TRENDING MEME COINS",
    subtitle: "Coins already riding narratives",
    description: "See which coins are pumping and what narratives they’re tied to. Validate your narrative against live markets.",
    color: "emerald",
    icon: "🪙",
    tools: [
      { name: "DexScreener (Solana)", url: "https://dexscreener.com/solana", free: true, action: "New and trending pairs; filter by volume and liquidity. Same data as your Go Hunting / Surge tabs." },
      { name: "DexScreener – New Pairs", url: "https://dexscreener.com/solana/new", free: true, action: "Newest Solana tokens; spot narrative-themed launches early." },
      { name: "CoinGecko – Trending", url: "https://www.coingecko.com/en/trending", free: true, action: "Trending coins across chains; see which narratives are already in play." },
      { name: "Pump.fun (Solana)", url: "https://pump.fun", free: true, action: "New meme coins on Solana; many narrative-driven launches start here." },
      { name: "Birdeye – Solana trending", url: "https://birdeye.so/trending", free: true, action: "Trending and top gainers on Solana; narrative + momentum view." },
    ],
    checklist: [
      "Which meme coins are trending or pumping in the last 24h?",
      "What narrative does each tie to (e.g. aliens, politics, animal, game)?",
      "Is your chosen narrative already crowded or still early?",
    ],
    output: "Narrative ↔ coin map → decide: ride existing trend or hunt for early narrative",
  },
];

const COLOR_CLASSES: Record<string, string> = {
  cyan: "text-cyan-500 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  violet: "text-violet-500 dark:text-violet-400 border-violet-500/30 bg-violet-500/10",
  amber: "text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
  emerald: "text-emerald-500 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

function PhaseCard({
  phase,
  isActive,
  onClick,
}: {
  phase: NarrativePhase;
  isActive: boolean;
  onClick: () => void;
}) {
  const colorClass = COLOR_CLASSES[phase.color] ?? COLOR_CLASSES.cyan;

  return (
    <Card
      className={`cursor-pointer transition-all duration-300 border-2 ${
        isActive
          ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/80 shadow-md"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{phase.icon}</span>
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-sm font-mono font-bold tracking-wider ${colorClass}`}>
              {phase.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono tracking-wide mt-0.5">{phase.subtitle}</p>
            <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
          </div>
          <span
            className={`text-lg ${colorClass} transition-transform duration-300 ${isActive ? "rotate-90" : ""}`}
          >
            →
          </span>
        </div>
      </CardHeader>
      {isActive && (
        <CardContent className="pt-0 space-y-5 animate-in fade-in duration-300">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Sources &amp; tools
            </p>
            <div className="space-y-2">
              {phase.tools.map((tool, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {tool.name}
                    </span>
                    {tool.free && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        FREE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{tool.action}</p>
                  {tool.url && (
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-1 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Checklist
            </p>
            <ul className="space-y-1">
              {phase.checklist.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <span className={`text-[8px] ${colorClass}`}>◆</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div
            className={`rounded-lg border p-3 ${colorClass} border-current/20 bg-current/5`}
          >
            <span className="text-xs font-mono font-semibold">OUTPUT → {phase.output}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function NarrativesPanel() {
  const [activePhase, setActivePhase] = useState(0);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="mb-6">
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
          Meme coins are fueled by narratives. Use global trends, US trends, trending memes, and trending coins to spot themes early—then map them to new or existing tokens. When the US gov spoke about aliens, dozens of coins launched. Same idea for any viral story.
        </p>
      </div>

      <div className="flex gap-1 mb-6">
        {PHASES.map((p, i) => (
          <div
            key={p.id}
            className={`flex-1 h-1 rounded-full transition-all ${
              i <= activePhase
                ? p.color === "cyan"
                  ? "bg-cyan-500"
                  : p.color === "violet"
                    ? "bg-violet-500"
                    : p.color === "amber"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
      <div className="space-y-4">
        {PHASES.map((phase, i) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            isActive={activePhase === i}
            onClick={() => setActivePhase(i)}
          />
        ))}
      </div>
    </div>
  );
}
