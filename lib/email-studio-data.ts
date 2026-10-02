/** Email Studio data angles (server only). Every number in an email comes from here, never from the AI. */
import { studioDb } from "@/lib/email-studio-db";
import { analyzeSessionSweep, resolveSweepSymbol } from "@/lib/session-sweep-data";
import { getStrongRunnerTrackRecord } from "@/lib/strong-runners-store";
import {
  SESSION_SWEEP_SYMBOLS,
  formatSweepPrice,
  type SessionSweepResult,
  type SweepTrade,
} from "@/lib/session-sweep-types";
import type { StudioAngle, StudioCell, StudioTable } from "@/lib/email-studio-types";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const DAY_MS = 86_400_000;

export type StudioFactSection = { key: string; title: string; table: StudioTable | null; fallbackNote: string };

export type StudioFacts = {
  angle: StudioAngle;
  eyebrow: string;
  sections: StudioFactSection[];
  /** Compact facts the AI may read for framing; it must not copy numbers into prose. */
  aiContext: string;
  lessonTopic: string;
  fallback: {
    subjects: string[];
    preheader: string;
    headline: string;
    hook: string;
    lesson: { title: string; body: string };
  };
  cta: { label: string; url: string };
};

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
}

function signedR(r: number): string {
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}R`;
}

function usd(n: number): string {
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/* ---------- Levels to watch ---------- */

const LEVEL_SYMBOLS = ["XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "BTC", "ETH"];

async function levelsFacts(): Promise<StudioFacts> {
  const results = await mapLimit(LEVEL_SYMBOLS, 3, async (s) => {
    const sym = resolveSweepSymbol(s);
    if (!sym) return null;
    return analyzeSessionSweep({ symbol: sym, timeframe: "5m", lookbackHours: 24, stopMode: "structure" }).catch(() => null);
  });
  const ok = results.filter((r): r is SessionSweepResult => !!r);
  if (!ok.length) throw new Error("Market data is unavailable right now. Try again in a minute.");

  const levelRows: StudioCell[][] = [];
  const setupRows: StudioCell[][] = [];
  const ctx: string[] = [];
  for (const r of ok) {
    const last = r.live.lastPrice;
    const open = r.levels
      .filter((l) => l.active && (l.status === "untouched" || l.status === "raiding"))
      .map((l) => ({ ...l, dist: last ? ((l.price - last) / last) * 100 : 0 }))
      .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))
      .slice(0, 2);
    for (const l of open) {
      levelRows.push([
        { text: r.label },
        { text: `${l.session} ${l.side}` },
        { text: formatSweepPrice(l.price) },
        { text: `${l.dist >= 0 ? "+" : "−"}${Math.abs(l.dist).toFixed(2)}%`, tone: "muted" },
        l.status === "raiding" ? { text: "Being tested", tone: "accent" } : { text: "Untouched" },
      ]);
      ctx.push(`${r.label}: ${l.session} ${l.side} ${l.status}, ${l.dist.toFixed(2)}% from price`);
    }
    const live = r.live;
    if (live.stage !== "idle" && live.direction) {
      const dir = live.direction === "long" ? "Long" : "Short";
      const what =
        live.stage === "swept"
          ? `Swept ${live.sweptSession} ${live.sweptSide}`
          : live.stage === "choch"
            ? `CHoCH after ${live.sweptSession} ${live.sweptSide} sweep`
            : `${dir} signal live`;
      const next =
        live.stage === "swept"
          ? `CHoCH close past ${formatSweepPrice(live.chochLevel)}`
          : live.stage === "choch"
            ? `BOS close past ${formatSweepPrice(live.bosLevel)}`
            : `Target ${formatSweepPrice(live.trade?.target ?? live.plannedTarget)}`;
      setupRows.push([{ text: r.label }, { text: what, tone: "accent" }, { text: next }]);
      ctx.push(`${r.label}: setup stage ${live.stage} (${dir.toLowerCase()} bias)`);
    }
  }

  const sections: StudioFactSection[] = [
    {
      key: "levels",
      title: "Session levels still in play",
      table: levelRows.length
        ? {
            columns: ["Market", "Level", "Price", "From price", "Status"],
            rows: levelRows,
            footnote: "Asia, London and New York session highs and lows not yet swept. Prices are reference feeds; your broker may differ slightly.",
          }
        : null,
      fallbackNote:
        "These are the highs and lows the last trading sessions left behind. Price often runs these levels to grab resting stop orders before choosing a direction.",
    },
  ];
  if (setupRows.length) {
    sections.push({
      key: "setups",
      title: "Setups forming right now",
      table: { columns: ["Market", "What happened", "Next trigger"], rows: setupRows },
      fallbackNote:
        "A sweep on its own is not a trade. The scanner waits for a change of character and a break of structure before calling an entry.",
    });
  }
  if (!levelRows.length && !setupRows.length) throw new Error("No open session levels right now. Try again after the next session closes.");

  return {
    angle: "levels",
    eyebrow: "Levels to watch",
    sections,
    aiContext: ctx.join("\n"),
    lessonTopic: "why session highs and lows act like magnets (resting stop orders / liquidity) and why you wait for confirmation after a sweep",
    fallback: {
      subjects: ["The levels gold and BTC are eyeing next", "Where the stops are sitting today", "Today's liquidity map: gold, FX, BTC"],
      preheader: "Untouched session highs and lows across gold, silver, FX and crypto perps.",
      headline: "The levels the market hasn't cleared yet",
      hook: "Every trading session leaves a high and a low behind. Stop orders pile up just beyond them, and price has a habit of going to collect them. Here is where those pools are sitting right now.",
      lesson: {
        title: "How to use a level",
        body: "A level being touched is not a signal. Wait for price to sweep it, reject, and break structure the other way. That sequence is what the Session Sweep scanner tracks for you.",
      },
    },
    cta: { label: "Open the live levels", url: `${APP_ORIGIN}/?tab=session-sweep` },
  };
}

/* ---------- What our scanner caught ---------- */

function setupText(t: SweepTrade): string {
  return `${t.direction === "long" ? "Long" : "Short"} after ${t.sweptSession} ${t.sweptSide} sweep`;
}

function outcomeCell(t: SweepTrade): StudioCell {
  const r = t.r ?? 0;
  const label = t.outcome === "tp" ? "Target" : t.outcome === "sl" ? "Stopped" : "Time exit";
  return { text: `${label} ${signedR(r)}`, tone: r > 0 ? "good" : r < 0 ? "bad" : "muted" };
}

async function scannerFacts(): Promise<StudioFacts> {
  const results = await mapLimit(SESSION_SWEEP_SYMBOLS, 4, (sym) =>
    analyzeSessionSweep({ symbol: sym, timeframe: "5m", lookbackHours: 7 * 24, stopMode: "structure", includeCosts: true })
      .then((r) => r)
      .catch(() => null)
  );
  const ok = results.filter((r): r is SessionSweepResult => !!r);
  if (!ok.length) throw new Error("Market data is unavailable right now. Try again in a minute.");

  const closed: { label: string; t: SweepTrade }[] = [];
  let openCount = 0;
  for (const r of ok) {
    for (const t of r.trades) {
      if (t.outcome === "open") openCount++;
      else if (t.r != null) closed.push({ label: r.label, t });
    }
  }
  if (!closed.length) throw new Error("The scanner closed no signals in the last 7 days, so there is nothing to report yet.");

  closed.sort((a, b) => (b.t.exitTs ?? b.t.entryTs) - (a.t.exitTs ?? a.t.entryTs));
  const wins = closed.filter((c) => (c.t.r ?? 0) > 0).length;
  const losses = closed.length - wins;
  const totalR = closed.reduce((s, c) => s + (c.t.r ?? 0), 0);
  const best = [...closed].sort((a, b) => (b.t.r ?? 0) - (a.t.r ?? 0))[0]!;
  const worstStreak = (() => {
    let cur = 0;
    let max = 0;
    for (const c of [...closed].reverse()) {
      cur = (c.t.r ?? 0) <= 0 ? cur + 1 : 0;
      max = Math.max(max, cur);
    }
    return max;
  })();

  const byMarket = new Map<string, { n: number; r: number }>();
  for (const c of closed) {
    const m = byMarket.get(c.label) ?? { n: 0, r: 0 };
    m.n++;
    m.r += c.t.r ?? 0;
    byMarket.set(c.label, m);
  }
  const marketRows = Array.from(byMarket.entries())
    .sort((a, b) => b[1].r - a[1].r)
    .map(([label, m]): StudioCell[] => [
      { text: label },
      { text: String(m.n) },
      { text: signedR(m.r), tone: m.r > 0 ? "good" : m.r < 0 ? "bad" : "muted" },
    ]);
  const shownMarkets = marketRows.length > 8 ? [...marketRows.slice(0, 4), ...marketRows.slice(-4)] : marketRows;

  const sections: StudioFactSection[] = [
    {
      key: "summary",
      title: "The week in numbers",
      table: {
        columns: ["", "Result"],
        rows: [
          [{ text: "Closed signals" }, { text: String(closed.length) }],
          [{ text: "Winners / losers" }, { text: `${wins} / ${losses}` }],
          [{ text: "Win rate" }, { text: `${Math.round((wins / closed.length) * 100)}%` }],
          [{ text: "Net result" }, { text: signedR(totalR), tone: totalR >= 0 ? "good" : "bad" }],
          [{ text: "Net on $100 risk per trade" }, { text: usd(totalR * 100), tone: totalR >= 0 ? "good" : "bad" }],
          [{ text: "Longest losing run" }, { text: `${worstStreak} in a row`, tone: "muted" }],
          ...(openCount ? [[{ text: "Still open" }, { text: String(openCount), tone: "muted" as const }]] : []),
        ],
        footnote: "Session Sweep rules replayed on 5-minute candles across 16 markets, 1:3 target, spread and fees deducted. Simulated, not live fills.",
      },
      fallbackNote: "Wins and losses, straight from the scanner's log. We show the losers too, because a strategy only makes sense once you see its bad weeks.",
    },
    {
      key: "signals",
      title: "Latest closed signals",
      table: {
        columns: ["Market", "Setup", "Result", "Closed"],
        rows: closed.slice(0, 8).map((c) => [
          { text: c.label },
          { text: setupText(c.t), tone: "muted" as const },
          outcomeCell(c.t),
          { text: shortDate(c.t.exitTs ?? c.t.entryTs), tone: "muted" as const },
        ]),
      },
      fallbackNote: "Each one followed the same three steps: a session high or low got swept, structure flipped, then price broke in the new direction.",
    },
    {
      key: "markets",
      title: "Best and worst markets",
      table: { columns: ["Market", "Signals", "Net"], rows: shownMarkets },
      fallbackNote: "Not every market behaves the same in a given week. Spread the risk and the bad markets matter less.",
    },
  ];

  return {
    angle: "scanner",
    eyebrow: "What our scanner caught",
    sections,
    aiContext: [
      `closed signals: ${closed.length}, wins ${wins}, losses ${losses}, net ${totalR.toFixed(2)}R, longest losing run ${worstStreak}`,
      `best trade: ${best.label} ${setupText(best.t)} ${signedR(best.t.r ?? 0)}`,
      `net is ${totalR >= 0 ? "positive" : "negative"} this week`,
    ].join("\n"),
    lessonTopic: "why a 1:3 reward-to-risk strategy can lose most trades and still come out ahead, and why judging a strategy on one week is a mistake",
    fallback: {
      subjects: ["Our scanner's week, losses included", "Every signal from the last 7 days", "The honest scorecard: wins and losses"],
      preheader: "Every Session Sweep signal from the past week across gold, FX and crypto perps, the losers included.",
      headline: totalR >= 0 ? "A week of sweeps: here's the full scorecard" : "A rough week for sweeps, and why we're showing you",
      hook: "Most trading accounts only post the winners. Here is everything the Session Sweep scanner called across gold, silver, FX and crypto perps in the last seven days, stopped trades included.",
      lesson: {
        title: "Why losers are part of the plan",
        body: "With a target three times the risk, one winner pays for three losers. That is why a strategy can be right less than half the time and still grow, and why one week tells you very little.",
      },
    },
    cta: { label: "See this week's signals", url: `${APP_ORIGIN}/?tab=session-sweep` },
  };
}

/* ---------- Meme runner of the week ---------- */

const CHAIN_LABEL: Record<string, string> = { solana: "Solana", bsc: "BSC", robinhood: "Robinhood", hyperevm: "HyperEVM" };

async function memesFacts(): Promise<StudioFacts> {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const raw = await studioDb().strongRunnerPick.findMany({
    where: { flaggedAt: { gte: since } },
    orderBy: { flaggedAt: "asc" },
    take: 1000,
  });
  const seen = new Set<string>();
  const picks = raw.filter((p) => {
    const k = `${p.chain}:${p.tokenAddress.toLowerCase()}`;
    if (seen.has(k) || !(p.mcapAtFlag > 0)) return false;
    seen.add(k);
    return true;
  });
  if (picks.length < 3) throw new Error("Not enough Strong Runners picks in the last 7 days for a meme email yet.");

  const withPeak = picks.map((p) => ({
    ...p,
    peakX: p.peakMcap && p.peakMcap > 0 ? p.peakMcap / p.mcapAtFlag : 1,
    nowX: p.lastMcap && p.lastMcap > 0 ? p.lastMcap / p.mcapAtFlag : null,
  }));
  const runners = [...withPeak].sort((a, b) => b.peakX - a.peakX).slice(0, 5);
  const top = runners[0]!;
  const faded = withPeak
    .filter((p) => p.nowX != null && p.peakX >= 1.5)
    .map((p) => ({ ...p, giveBack: 1 - (p.nowX ?? 1) / p.peakX }))
    .sort((a, b) => b.giveBack - a.giveBack)[0];
  const doubled = withPeak.filter((p) => p.peakX >= 2).length;
  const belowFlag = withPeak.filter((p) => p.nowX != null && p.nowX < 1).length;
  const tracked = withPeak.filter((p) => p.nowX != null).length;
  const record = await getStrongRunnerTrackRecord().catch(() => null);

  const fmtX = (x: number) => `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}x`;
  const sections: StudioFactSection[] = [
    {
      key: "runners",
      title: "Top runners flagged this week",
      table: {
        columns: ["Token", "Chain", "Flagged at", "Peak", "Peak move"],
        rows: runners.map((p) => [
          { text: `$${p.symbol}` },
          { text: CHAIN_LABEL[p.chain] ?? p.chain, tone: "muted" as const },
          { text: compactUsd(p.mcapAtFlag) },
          { text: compactUsd(p.peakMcap) },
          { text: fmtX(p.peakX), tone: p.peakX >= 2 ? ("good" as const) : ("muted" as const) },
        ]),
        footnote: "Market cap when Strong Runners flagged the token versus the highest market cap seen since. Peaks are rarely sellable in full.",
      },
      fallbackNote: "These were flagged on volume, holder growth and momentum, before most people had heard of them.",
    },
  ];
  if (faded) {
    sections.push({
      key: "fade",
      title: "The one that gave it back",
      table: {
        columns: ["Token", "Peak move", "Now vs flag", "Given back"],
        rows: [
          [
            { text: `$${faded.symbol}` },
            { text: fmtX(faded.peakX), tone: "good" },
            { text: fmtX(faded.nowX ?? 1), tone: (faded.nowX ?? 1) < 1 ? "bad" : "muted" },
            { text: `${Math.round(faded.giveBack * 100)}% of peak`, tone: "bad" },
          ],
        ],
      },
      fallbackNote: "Meme runs rarely hold. Without a plan to take profit, a great entry can still end as a loss.",
    });
  }
  sections.push({
    key: "record",
    title: "The honest scorecard",
    table: {
      columns: ["", "Result"],
      rows: [
        [{ text: "Tokens flagged this week" }, { text: String(picks.length) }],
        [{ text: "Doubled at some point" }, { text: `${doubled} of ${picks.length}`, tone: doubled ? "good" : "muted" }],
        ...(tracked ? [[{ text: "Now below flag price" }, { text: `${belowFlag} of ${tracked}`, tone: "bad" as const }]] : []),
        ...(record && record.after7d.winRatePct != null
          ? [[{ text: `Up after 7 days (last ${record.windowDays} days)` }, { text: `${record.after7d.winRatePct}%` }]]
          : []),
      ],
      footnote: "Most memes go to zero. Strong Runners finds momentum early; it does not make memes safe.",
    },
    fallbackNote: "Plenty of flags faded too. That's the deal with memes: a few big winners and a lot of quiet losers.",
  });

  return {
    angle: "memes",
    eyebrow: "Meme runner of the week",
    sections,
    aiContext: [
      `top runner: $${top.symbol} on ${CHAIN_LABEL[top.chain] ?? top.chain}, peak ${fmtX(top.peakX)} from flag${top.narrative ? `, narrative: ${top.narrative.slice(0, 160)}` : ""}`,
      faded ? `biggest fade: $${faded.symbol} peaked ${fmtX(faded.peakX)} then gave back ${Math.round(faded.giveBack * 100)}%` : "",
      `flagged ${picks.length}, doubled ${doubled}, below flag now ${belowFlag} of ${tracked}`,
    ]
      .filter(Boolean)
      .join("\n"),
    lessonTopic: "taking profit in stages on meme coins (e.g. recovering the initial stake on a double) because most runners retrace hard",
    fallback: {
      subjects: [`$${top.symbol} ran. Here's what we flagged`, "This week's meme runners (and fades)", "The memes our scanner caught early"],
      preheader: "The biggest Strong Runners flags of the week, the one that faded, and the honest hit rate.",
      headline: `$${top.symbol} led this week's runners`,
      hook: "Strong Runners watches new meme tokens on Solana, BSC and Robinhood for real momentum. Here is what it flagged this week, the ones that ran and the ones that didn't.",
      lesson: {
        title: "Have an exit before you enter",
        body: "When a meme doubles, taking your starting stake off the table turns the rest into a free ride. Runs this sharp usually give a lot back.",
      },
    },
    cta: { label: "Open Strong Runners", url: `${APP_ORIGIN}/?tab=narratives&narratives=strong-runners` },
  };
}

export async function buildStudioFacts(angle: StudioAngle): Promise<StudioFacts> {
  if (angle === "levels") return levelsFacts();
  if (angle === "scanner") return scannerFacts();
  return memesFacts();
}
