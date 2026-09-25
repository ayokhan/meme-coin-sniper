/**
 * Daily Market Wrap — rules-based, built once per UTC day from Hyperliquid
 * perps + Solana/Robinhood meme movers. Stored in DB for app + email.
 */
import { futuresWrapDb as prisma } from "@/lib/futures-daily-wrap-db";
import { getTrendingPerps, getPerpsByCoins, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import {
  getTrendingSolanaPairs,
  getTrendingRobinhoodPairs,
  type DexPair,
} from "@/lib/api-clients/dexscreener";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
/** Public top-level tab — no login required. */
export const FUTURES_WRAP_APP_URL = `${APP_ORIGIN}/?tab=futures&futures=daily-wrap`;
export const FUTURES_HOT_PERPS_URL = `${APP_ORIGIN}/?tab=futures&futures=hot-perps`;
export const FUTURES_WORKFLOW_URL = `${APP_ORIGIN}/?tab=futures&futures=workflow`;
export const FUTURES_LIQ_URL = `${APP_ORIGIN}/?tab=futures&futures=liquidation-map`;
export const MEME_TRENDING_URL = `${APP_ORIGIN}/?tab=trending`;
export const ROBINHOOD_HUNT_URL = `${APP_ORIGIN}/?tab=robinhood`;

const NEW_DAYS = 7;
/** Wide enough universe so “most traded” is not just top |%| movers. */
const PERP_UNIVERSE_LIMIT = 120;
const MEME_DIGEST_LIMIT = 4;

export type FuturesWrapItem = {
  id: string;
  text: string;
  highlights: string[];
  href?: string;
};

export type FuturesDailyWrapPayload = {
  id: string;
  dateKey: string;
  title: string;
  publishedAt: string;
  hotTopics: FuturesWrapItem[];
  marketUpdates: FuturesWrapItem[];
  emailTeaser: FuturesWrapItem[];
};

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateKey: string): string {
  const [y, m, day] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtFunding(raw?: string): string | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(4)}%`;
}

function fmtNotional(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}

function pickMajors(all: TrendingPerp[]): TrendingPerp[] {
  const want = ["BTC", "ETH", "SOL"];
  const byCoin = new Map(all.map((p) => [p.coin.toUpperCase(), p]));
  return want.map((c) => byCoin.get(c)).filter((p): p is TrendingPerp => !!p);
}

function memeSymbol(pair: DexPair): string {
  return (pair.baseToken?.symbol || "?").trim().toUpperCase() || "?";
}

function memePct(pair: DexPair): number {
  return pair.priceChange?.h24 ?? pair.priceChange?.h6 ?? 0;
}

function buildMemeHighlight(
  id: string,
  label: string,
  pairs: DexPair[],
  href: string
): FuturesWrapItem | null {
  if (!pairs.length) return null;
  const top = pairs.slice(0, MEME_DIGEST_LIMIT);
  const line = top.map((p) => `${memeSymbol(p)} ${fmtPct(memePct(p))}`).join(" · ");
  return {
    id,
    text: `${label}: ${line}.`,
    highlights: [...label.split(/\s+/).filter(Boolean), ...top.map(memeSymbol)],
    href,
  };
}

function buildHotTopics(
  trending: TrendingPerp[],
  majors: TrendingPerp[]
): FuturesWrapItem[] {
  const items: FuturesWrapItem[] = [];
  const btc = majors.find((p) => p.coin.toUpperCase() === "BTC");
  const eth = majors.find((p) => p.coin.toUpperCase() === "ETH");

  if (btc || eth) {
    const parts: string[] = [];
    const highlights: string[] = [];
    if (btc) {
      parts.push(
        `Bitcoin ${fmtPct(btc.dayPct)} (mark $${Number(btc.markPx).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
      );
      highlights.push("Bitcoin");
    }
    if (eth) {
      parts.push(
        `ETH ${fmtPct(eth.dayPct)} ($${Number(eth.markPx).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
      );
      highlights.push("ETH");
    }
    items.push({
      id: "majors",
      text: `${parts.join(" · ")} over the last 24h on Hyperliquid perps.`,
      highlights,
      href: FUTURES_WORKFLOW_URL,
    });
  }

  const movers = trending
    .filter((p) => !["BTC", "ETH"].includes(p.coin.toUpperCase()))
    .slice(0, 4);
  if (movers.length > 0) {
    const line = movers.map((p) => `${p.coin} ${fmtPct(p.dayPct)}`).join(" · ");
    items.push({
      id: "momentum",
      text: `Top perp momentum (24h): ${line}.`,
      highlights: movers.map((p) => p.coin),
      href: FUTURES_HOT_PERPS_URL,
    });
  }

  const fundingExtreme = [...trending]
    .filter((p) => p.funding != null && Number.isFinite(Number(p.funding)))
    .sort((a, b) => Math.abs(Number(b.funding)) - Math.abs(Number(a.funding)))
    .slice(0, 3);
  if (fundingExtreme.length > 0) {
    const line = fundingExtreme
      .map((p) => {
        const f = fmtFunding(p.funding);
        const bias = Number(p.funding) > 0 ? "long-heavy" : "short-heavy";
        return `${p.coin} ${f} (${bias})`;
      })
      .join(" · ");
    items.push({
      id: "funding",
      text: `Funding extremes: ${line}. Use this when sizing longs vs shorts.`,
      highlights: ["Funding", ...fundingExtreme.map((p) => p.coin)],
      href: FUTURES_LIQ_URL,
    });
  }

  return items;
}

function buildMarketUpdates(
  newPerps: TrendingPerp[],
  allPerps: TrendingPerp[],
  memeItems: FuturesWrapItem[]
): FuturesWrapItem[] {
  const items: FuturesWrapItem[] = [];

  const volumeLeaders = [...allPerps]
    .filter((p) => Number(p.dayNtlVlm) > 0)
    .sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm))
    .slice(0, 5);
  if (volumeLeaders.length > 0) {
    const line = volumeLeaders
      .map((p) => `${p.coin} ${fmtNotional(Number(p.dayNtlVlm))} (${fmtPct(p.dayPct)})`)
      .join(" · ");
    items.push({
      id: "most-traded",
      text: `Most traded perps (24h notional): ${line}.`,
      highlights: ["Most traded", ...volumeLeaders.map((p) => p.coin)],
      href: FUTURES_HOT_PERPS_URL,
    });
  }

  if (newPerps.length > 0) {
    const line = newPerps
      .slice(0, 5)
      .map((p) => `${p.coin} ${fmtPct(p.dayPct)}`)
      .join(" · ");
    items.push({
      id: "new-listings",
      text: `Hot new perps (first seen in 7d): ${line}.`,
      highlights: ["Hot new", ...newPerps.slice(0, 5).map((p) => p.coin)],
      href: FUTURES_HOT_PERPS_URL,
    });
  } else {
    items.push({
      id: "new-listings-empty",
      text: "No brand-new Hyperliquid perp listings in the last 7 days — watch Hot New Perps for the next wave.",
      highlights: ["Hot New Perps"],
      href: FUTURES_HOT_PERPS_URL,
    });
  }

  for (const m of memeItems) items.push(m);

  items.push({
    id: "desk-cta",
    text: "Open Institutional Workflow, Go Hunting, or Liquidation Map on NovaStaris to turn today’s movers into a plan.",
    highlights: ["Institutional Workflow", "Go Hunting", "Liquidation Map", "NovaStaris"],
    href: FUTURES_WRAP_APP_URL,
  });

  return items;
}

/** Newsletter teaser: majors + most traded + memes (+ momentum if room). */
function buildEmailTeaser(
  hotTopics: FuturesWrapItem[],
  marketUpdates: FuturesWrapItem[]
): FuturesWrapItem[] {
  const byId = (id: string) =>
    hotTopics.find((t) => t.id === id) ?? marketUpdates.find((t) => t.id === id);

  const ordered = [
    byId("majors"),
    byId("most-traded"),
    byId("meme-solana"),
    byId("meme-robinhood"),
    byId("momentum"),
    byId("funding"),
  ].filter((t): t is FuturesWrapItem => !!t);

  return ordered.slice(0, 5);
}

function buildTelegramHtml(
  title: string,
  hotTopics: FuturesWrapItem[],
  marketUpdates: FuturesWrapItem[]
): string {
  const hot = hotTopics.map((t) => `• ${t.text}`).join("\n");
  const traded = marketUpdates.filter((t) => t.id === "most-traded");
  const memes = marketUpdates.filter((t) => t.id.startsWith("meme-"));
  const other = marketUpdates.filter((t) => t.id !== "most-traded" && !t.id.startsWith("meme-"));
  const sections = [
    `📊 <b>${title}</b>`,
    "",
    "🔥 <b>Hot Topics</b>",
    hot,
  ];
  if (traded.length) {
    sections.push("", "📈 <b>Most traded perps</b>", traded.map((t) => `• ${t.text}`).join("\n"));
  }
  if (memes.length) {
    sections.push("", "🐸 <b>Meme watch</b>", memes.map((t) => `• ${t.text}`).join("\n"));
  }
  if (other.length) {
    sections.push("", "📰 <b>Market Updates</b>", other.map((t) => `• ${t.text}`).join("\n"));
  }
  sections.push("", `🔗 <a href="${FUTURES_WRAP_APP_URL}">Open Daily Wrap in NovaStaris</a>`);
  return sections.join("\n");
}

/** Build wrap payload from live market data (no DB write). */
export async function buildFuturesDailyWrapContent(now = new Date()): Promise<{
  dateKey: string;
  title: string;
  publishedAt: Date;
  hotTopics: FuturesWrapItem[];
  marketUpdates: FuturesWrapItem[];
  emailTeaser: FuturesWrapItem[];
  telegramHtml: string;
}> {
  const dateKey = utcDateKey(now);
  const newCutoff = new Date(now.getTime() - NEW_DAYS * 24 * 60 * 60 * 1000);

  const [allPerps, newRows, solanaPairs, robinhoodPairs] = await Promise.all([
    getTrendingPerps(PERP_UNIVERSE_LIMIT),
    prisma.knownPerpSymbol.findMany({
      where: { firstSeenAt: { gte: newCutoff } },
      select: { symbol: true },
      orderBy: { firstSeenAt: "desc" },
      take: 8,
    }),
    getTrendingSolanaPairs(MEME_DIGEST_LIMIT + 2).catch(() => [] as DexPair[]),
    getTrendingRobinhoodPairs(MEME_DIGEST_LIMIT + 2).catch(() => [] as DexPair[]),
  ]);

  const newSymbols = newRows.map((r) => r.symbol);
  let newPerps: TrendingPerp[] = [];
  if (newSymbols.length > 0) {
    newPerps = await getPerpsByCoins(newSymbols);
  }

  let majors = pickMajors(allPerps);
  if (majors.length < 3) {
    const extra = await getPerpsByCoins(["BTC", "ETH", "SOL"]);
    const map = new Map(majors.map((p) => [p.coin.toUpperCase(), p]));
    for (const p of extra) map.set(p.coin.toUpperCase(), p);
    majors = ["BTC", "ETH", "SOL"].map((c) => map.get(c)).filter((p): p is TrendingPerp => !!p);
  }

  const memeItems = [
    buildMemeHighlight("meme-solana", "Solana memes", solanaPairs, MEME_TRENDING_URL),
    buildMemeHighlight("meme-robinhood", "Robinhood memes", robinhoodPairs, ROBINHOOD_HUNT_URL),
  ].filter((t): t is FuturesWrapItem => !!t);

  const hotTopics = buildHotTopics(allPerps, majors);
  const marketUpdates = buildMarketUpdates(newPerps, allPerps, memeItems);
  const emailTeaser = buildEmailTeaser(hotTopics, marketUpdates);
  const title = `Daily Market Wrap | ${formatDisplayDate(dateKey)}`;
  const telegramHtml = buildTelegramHtml(title, hotTopics, marketUpdates);

  return {
    dateKey,
    title,
    publishedAt: now,
    hotTopics,
    marketUpdates,
    emailTeaser,
    telegramHtml,
  };
}

/** Build (or refresh) today’s wrap and upsert into DB. */
export async function upsertTodaysFuturesDailyWrap(now = new Date()): Promise<FuturesDailyWrapPayload> {
  const content = await buildFuturesDailyWrapContent(now);
  const row = await prisma.futuresDailyWrap.upsert({
    where: { dateKey: content.dateKey },
    create: {
      dateKey: content.dateKey,
      title: content.title,
      publishedAt: content.publishedAt,
      hotTopics: content.hotTopics,
      marketUpdates: content.marketUpdates,
      emailTeaser: content.emailTeaser,
      telegramHtml: content.telegramHtml,
    },
    update: {
      title: content.title,
      publishedAt: content.publishedAt,
      hotTopics: content.hotTopics,
      marketUpdates: content.marketUpdates,
      emailTeaser: content.emailTeaser,
      telegramHtml: content.telegramHtml,
    },
  });
  return serializeWrap(row);
}

function serializeWrap(row: {
  id: string;
  dateKey: string;
  title: string;
  publishedAt: Date;
  hotTopics: unknown;
  marketUpdates: unknown;
  emailTeaser: unknown;
}): FuturesDailyWrapPayload {
  return {
    id: row.id,
    dateKey: row.dateKey,
    title: row.title,
    publishedAt: row.publishedAt.toISOString(),
    hotTopics: (row.hotTopics as FuturesWrapItem[]) ?? [],
    marketUpdates: (row.marketUpdates as FuturesWrapItem[]) ?? [],
    emailTeaser: (row.emailTeaser as FuturesWrapItem[]) ?? [],
  };
}

export async function getLatestFuturesDailyWrap(): Promise<FuturesDailyWrapPayload | null> {
  const row = await prisma.futuresDailyWrap.findFirst({
    orderBy: { publishedAt: "desc" },
  });
  return row ? serializeWrap(row) : null;
}

export async function getFuturesDailyWrapByDateKey(dateKey: string): Promise<FuturesDailyWrapPayload | null> {
  const row = await prisma.futuresDailyWrap.findUnique({ where: { dateKey } });
  return row ? serializeWrap(row) : null;
}

export async function listFuturesDailyWrapArchive(limit = 14): Promise<
  { dateKey: string; title: string; publishedAt: string }[]
> {
  const rows = await prisma.futuresDailyWrap.findMany({
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { dateKey: true, title: true, publishedAt: true },
  });
  return rows.map((r) => ({
    dateKey: r.dateKey,
    title: r.title,
    publishedAt: r.publishedAt.toISOString(),
  }));
}
