"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ToolSignal = { long: string; short: string };

type PhaseTool = {
  name: string;
  url: string | null;
  free: boolean;
  action: string;
  signal: ToolSignal;
};

type Phase = {
  id: string;
  title: string;
  subtitle: string;
  timeframe: string;
  color: string;
  icon: string;
  tools: PhaseTool[];
  checklist: string[];
  output: string;
};

type ToolStackItem = {
  name: string;
  use: string;
  tier: "Core" | "Support" | "Optional";
  free: boolean;
};

const PHASES: Phase[] = [
  {
    id: "macro",
    title: "MACRO BIAS",
    subtitle: "Weekly · Sunday Evening",
    timeframe: "Sets your directional bias for the week",
    color: "cyan",
    icon: "🌐",
    tools: [
      {
        name: "COT Report (CFTC)",
        url: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
        free: true,
        action: "Check if institutions are net LONG or SHORT on BTC/ETH futures",
        signal: {
          long: "Institutions increasing net longs + commercials hedging short = bullish",
          short: "Institutions reducing longs + adding shorts = bearish",
        },
      },
      {
        name: "Tradingster COT (Futures breakdown)",
        url: "https://tradingster.com/cot/futures/fin/133741",
        free: true,
        action: "View COT breakdown by category (commercial, non-commercial, etc.) for crypto futures",
        signal: {
          long: "Use with CFTC data to confirm institutional positioning",
          short: "Use with CFTC data to confirm institutional positioning",
        },
      },
      {
        name: "Glassnode (Free Tier)",
        url: "https://studio.glassnode.com",
        free: true,
        action: "Check MVRV Z-Score, SOPR, and Exchange Net Flow (weekly)",
        signal: {
          long: "MVRV below 1 (undervalued), negative exchange net flow (accumulation)",
          short: "MVRV above 3 (overheated), positive exchange net flow (distribution)",
        },
      },
      {
        name: "TradingView COT Indicator",
        url: "https://www.tradingview.com",
        free: true,
        action: "Overlay COT data on your BTC chart — look at leveraged fund positioning",
        signal: {
          long: "Leveraged funds < 20th percentile (extreme short = contrarian long)",
          short: "Leveraged funds > 80th percentile (extreme long = contrarian short)",
        },
      },
    ],
    checklist: [
      "Are institutions net long or short this week?",
      "Is the market in accumulation or distribution phase?",
      "Does COT positioning show any extremes?",
    ],
    output: "Weekly bias → LONG / SHORT / NEUTRAL",
  },
  {
    id: "daily",
    title: "DAILY FLOW CHECK",
    subtitle: "Daily · Morning Routine (15 min)",
    timeframe: "Confirms or contradicts your weekly bias",
    color: "violet",
    icon: "📊",
    tools: [
      {
        name: "CryptoQuant",
        url: "https://cryptoquant.com",
        free: true,
        action: "Check Exchange Inflow/Outflow, Whale Ratio, Fund Flow Ratio",
        signal: {
          long: "High exchange outflows (whales withdrawing = accumulating)",
          short: "High exchange inflows (whales depositing = preparing to sell)",
        },
      },
      {
        name: "Arkham Intelligence",
        url: "https://platform.arkhamintelligence.com",
        free: true,
        action: "Monitor labeled institutional wallets — check for large movements",
        signal: {
          long: "Institutions moving stables to exchanges (buying incoming)",
          short: "Institutions moving BTC/ETH to exchanges (selling incoming)",
        },
      },
      {
        name: "Whale Alert (Telegram)",
        url: "https://whale-alert.io",
        free: true,
        action: "Review overnight large transactions — note direction and size",
        signal: {
          long: "Large USDT/USDC transfers TO exchanges (buy pressure coming)",
          short: "Large BTC/ETH transfers TO exchanges (sell pressure coming)",
        },
      },
    ],
    checklist: [
      "Do whale flows confirm your weekly bias?",
      "Any major institutional wallet movements overnight?",
      "Is exchange net flow supporting longs or shorts?",
    ],
    output: "Daily confirmation → ALIGNED / CONFLICTING with weekly bias",
  },
  {
    id: "pretrade",
    title: "PRE-TRADE SETUP",
    subtitle: "Before Every Trade · 10 min",
    timeframe: "Identifies optimal entry timing and leverage risk",
    color: "amber",
    icon: "⚡",
    tools: [
      {
        name: "Coinglass",
        url: "https://www.coinglass.com",
        free: true,
        action: "Check Funding Rates, Open Interest, Long/Short Ratio, Liquidation Map",
        signal: {
          long: "Funding deeply negative (shorts overleveraged → squeeze setup). Liquidation clusters above price (magnet). OI rising with price.",
          short: "Funding extremely positive (longs overleveraged → dump setup). Liquidation clusters below price (magnet). OI diverging from price.",
        },
      },
      {
        name: "Coinglass Liquidation Heatmap",
        url: "https://www.coinglass.com/LiquidationHeatMap",
        free: true,
        action: "Identify where the liquidity pools are — price tends to hunt these levels",
        signal: {
          long: "Heavy short liquidation cluster just above current price = price likely to sweep up",
          short: "Heavy long liquidation cluster just below current price = price likely to sweep down",
        },
      },
      {
        name: "Coinglass OI + Funding Combo",
        url: "https://www.coinglass.com/FundingRate",
        free: true,
        action: "Cross-reference OI changes with funding rate direction",
        signal: {
          long: "OI increasing + funding negative = smart money accumulating longs quietly",
          short: "OI increasing + funding positive = overleveraged longs = short setup",
        },
      },
    ],
    checklist: [
      "Is funding rate at an extreme? (> 0.05% or < -0.03%)",
      "Where are the liquidation clusters?",
      "Does OI direction confirm your trade bias?",
      "Is leverage risk acceptable for your position size?",
    ],
    output: "Entry signal → GO / WAIT / FADE",
  },
  {
    id: "execute",
    title: "EXECUTION RULES",
    subtitle: "During Trade · Discipline Protocol",
    timeframe: "Risk management and position management",
    color: "emerald",
    icon: "🎯",
    tools: [
      {
        name: "Position Sizing Rule",
        url: null,
        free: true,
        action: "Never risk more than 1-2% of total capital per trade",
        signal: {
          long: "Calculate: (Account × 0.02) ÷ (Entry - Stop Loss) = Position Size",
          short: "Same formula. Tighter stop = larger size. Wider stop = smaller size.",
        },
      },
      {
        name: "Leverage Guidelines",
        url: null,
        free: true,
        action: "Match leverage to conviction level from your analysis",
        signal: {
          long: "All 3 phases aligned (macro + daily + pre-trade) → up to 10x. Only 2 aligned → 3-5x max. Only 1 → skip or spot only.",
          short: "Same framework. Never max leverage unless all signals converge.",
        },
      },
      {
        name: "Exit Strategy",
        url: null,
        free: true,
        action: "Pre-define TP and SL before entering — no emotional exits",
        signal: {
          long: "TP at liquidation cluster levels (where shorts will get squeezed). Trail stop after 2R profit.",
          short: "TP at long liquidation clusters below. Trail stop after 2R profit.",
        },
      },
    ],
    checklist: [
      "Position size ≤ 2% risk per trade?",
      "Leverage matches conviction score?",
      "Stop loss and take profit SET before entry?",
      "No revenge trading after a loss?",
    ],
    output: "Trade executed with full plan → MANAGE or CUT",
  },
];

const TOOL_STACK: ToolStackItem[] = [
  { name: "Coinglass", use: "Derivatives data, funding, OI, liquidations", tier: "Core", free: true },
  { name: "CryptoQuant", use: "Exchange flows, whale ratio, miner data", tier: "Core", free: true },
  { name: "Arkham Intelligence", use: "Labeled institutional wallet tracking", tier: "Core", free: true },
  { name: "TradingView", use: "Charts + COT indicators overlay", tier: "Core", free: true },
  { name: "COT Reports (CFTC)", use: "Weekly CFTC institutional positioning", tier: "Core", free: true },
  { name: "Whale Alert", use: "Real-time large transaction alerts", tier: "Support", free: true },
  { name: "Glassnode", use: "On-chain macro cycle indicators", tier: "Support", free: true },
  { name: "Nansen", use: "Smart money tracking (limited free)", tier: "Optional", free: false },
];

const RULES = [
  { title: "THE CONVERGENCE RULE", color: "cyan", content: "Only trade when at least 2 of 3 analysis phases agree on direction. All 3 aligned = max conviction (higher leverage). Only 1 = skip the trade entirely." },
  { title: "THE 3-5-7 FRAMEWORK", color: "violet", content: "Risk max 3% per trade. Cap total portfolio exposure at 5% across all open positions. Target minimum 7% gain on winners. This keeps your R:R above 2:1." },
  { title: "FUNDING RATE EXTREMES", color: "amber", content: "When funding exceeds ±0.05%, the opposite side usually wins within 24-48 hours. Extremely positive funding → short setup. Extremely negative funding → long setup. This is the single most reliable free signal available." },
  { title: "LIQUIDATION HUNTING", color: "emerald", content: "Price gravitates toward the largest liquidation clusters like a magnet. Use the Coinglass heatmap to identify where the liquidity is. Price will likely visit those levels before reversing — set your TPs accordingly." },
  { title: "THE STABLECOIN SIGNAL", color: "orange", content: "When you see large USDT/USDC inflows to exchanges on Arkham + Whale Alert, it typically precedes buying. When you see large BTC/ETH inflows, selling is likely. This gives you 15-60 minutes of lead time on major moves." },
  { title: "NEVER FIGHT THE COT", color: "rose", content: "If the weekly COT report shows institutions are strongly positioned one way, don't take the opposite trade on lower timeframes. You might get a scalp, but the trend will win. Institutional bias = your bias." },
];

const COLOR_CLASSES: Record<string, string> = {
  cyan: "text-cyan-500 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  violet: "text-violet-500 dark:text-violet-400 border-violet-500/30 bg-violet-500/10",
  amber: "text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
  emerald: "text-emerald-500 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  orange: "text-orange-500 dark:text-orange-400 border-orange-500/30 bg-orange-500/10",
  rose: "text-rose-500 dark:text-rose-400 border-rose-500/30 bg-rose-500/10",
};

const PROGRESS_BG: Record<string, string> = {
  cyan: "bg-cyan-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
};

const BORDER_L_CLASS: Record<string, string> = {
  cyan: "border-l-cyan-500",
  violet: "border-l-violet-500",
  amber: "border-l-amber-500",
  emerald: "border-l-emerald-500",
  orange: "border-l-orange-500",
  rose: "border-l-rose-500",
};

function PhaseCard({ phase, isActive, onClick }: { phase: Phase; isActive: boolean; onClick: () => void }) {
  const [expandedTool, setExpandedTool] = useState<number | null>(null);
  const colorClass = COLOR_CLASSES[phase.color] ?? COLOR_CLASSES.cyan;

  return (
    <Card
      className={`cursor-pointer transition-all duration-300 border-2 ${
        isActive ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/80 shadow-md" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
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
            <p className="text-sm text-muted-foreground mt-1">{phase.timeframe}</p>
          </div>
          <span className={`text-lg ${colorClass} transition-transform duration-300 ${isActive ? "rotate-90" : ""}`}>→</span>
        </div>
      </CardHeader>
      {isActive && (
        <CardContent className="pt-0 space-y-5 animate-in fade-in duration-300">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Tools & Signals</p>
            <div className="space-y-2">
              {phase.tools.map((tool, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                    expandedTool === i ? "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-600" : "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onClick={(e) => { e.stopPropagation(); setExpandedTool(expandedTool === i ? null : i); }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{tool.name}</span>
                      {tool.url && (
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px]">{(() => { try { return new URL(tool.url!).hostname; } catch { return tool.url; } })()}</span>
                      )}
                    </div>
                    {tool.free && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">FREE</span>
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
                  {expandedTool === i && (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">▲ Long signal</p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{tool.signal.long}</p>
                      </div>
                      <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-2.5">
                        <p className="text-[10px] font-mono text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">▼ Short signal</p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{tool.signal.short}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Checklist</p>
            <ul className="space-y-1">
              {phase.checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <span className={`text-[8px] ${colorClass}`}>◆</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={`rounded-lg border p-3 ${colorClass} border-current/20 bg-current/5`}>
            <span className="text-xs font-mono font-semibold">OUTPUT → {phase.output}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function FuturesWorkflow() {
  const [activePhase, setActivePhase] = useState(0);
  const [view, setView] = useState<"workflow" | "toolstack" | "rules">("workflow");

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Institutional Flow Trading System</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 dark:from-cyan-300 dark:via-blue-300 dark:to-cyan-400 bg-clip-text text-transparent">
          Leverage Trading Workflow
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          4-phase system using free tools to track institutional positioning and time your long/short entries. All 3 phases aligned = high conviction (up to 10x). Only 2 = conservative (3-5x). Only 1 = skip.
        </p>
        <div className="flex gap-1 mt-4">
          {(["workflow", "toolstack", "rules"] as const).map((tab) => (
            <Button
              key={tab}
              variant={view === tab ? "secondary" : "ghost"}
              size="sm"
              className="font-mono text-[11px] uppercase tracking-wider"
              onClick={() => setView(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {view === "workflow" && (
        <>
          <Card className="mb-6 border-cyan-200 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-cyan-800 dark:text-cyan-200">How the Institutional Workflow gives you an edge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p className="leading-relaxed">
                The workflow is built on one idea: institutions show their bias in data (COT, flows, funding). If you align with that bias instead of fading it, you improve your odds on leveraged trades.
              </p>
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong className="text-zinc-900 dark:text-zinc-100">Convergence rule:</strong> Only take leverage when at least 2 of the first 3 phases (macro, daily flow, pre-trade) agree. All 3 aligned = high conviction (e.g. up to 10x). Only 2 = moderate (3–5x). Only 1 = skip or spot only.</li>
                <li><strong className="text-zinc-900 dark:text-zinc-100">Funding extreme:</strong> When funding is very positive, longs are crowded → bias to shorts (and vice versa). One of the most reliable free edges.</li>
                <li><strong className="text-zinc-900 dark:text-zinc-100">Liquidation hunting:</strong> Price often sweeps the main liquidation cluster before reversing. Use the heatmap to set take profits near those levels.</li>
                <li><strong className="text-zinc-900 dark:text-zinc-100">Stablecoin vs coin flows:</strong> Large stable inflows to exchanges often precede buying; large BTC/ETH inflows often precede selling. Gives you a short lead if you check flows regularly.</li>
              </ul>
              <p className="leading-relaxed pt-1">
                <strong className="text-zinc-900 dark:text-zinc-100">Best use:</strong> do Phase 1 (macro) weekly, Phase 2 (daily flow) each morning, then Phase 3 (pre-trade) only when you’re about to open a trade. Use Phase 4 (execution rules) every time you enter. Never max leverage unless all three analysis phases agree.
              </p>
            </CardContent>
          </Card>
          <div className="flex gap-1 mb-6">
            {PHASES.map((p, i) => (
              <div
                key={p.id}
                className={`flex-1 h-1 rounded-full transition-all ${i <= activePhase ? PROGRESS_BG[p.color] ?? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
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
        </>
      )}

      {view === "toolstack" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-4">
            All tools are free or have sufficient free tiers for this workflow. No $799 subscriptions needed.
          </p>
          {TOOL_STACK.map((tool, i) => (
            <Card key={i} className="border-zinc-200 dark:border-zinc-800">
              <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{tool.name}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        tool.tier === "Core" ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" :
                        tool.tier === "Support" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-zinc-200 dark:bg-zinc-700 text-muted-foreground"
                      }`}
                    >
                      {tool.tier}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.use}</p>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${tool.free ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-orange-500/15 text-orange-600 dark:text-orange-400"}`}>
                  {tool.free ? "FREE" : "PAID"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === "rules" && (
        <div className="space-y-3">
          {RULES.map((rule, i) => (
            <Card key={i} className={`border-l-4 ${BORDER_L_CLASS[rule.color] ?? "border-l-cyan-500"} border-zinc-200 dark:border-zinc-800`}>
              <CardContent className="py-4 px-4">
                <h3 className={`text-xs font-mono font-bold tracking-wider mb-2 ${COLOR_CLASSES[rule.color]}`}>
                  {rule.title}
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{rule.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
