/**
 * Daily Futures Market Wrap — rules-based, built once per UTC day from Hyperliquid
 * perp data. No per-request AI. Stored in DB and served cheaply to the app + email.
 */
import { futuresWrapDb as prisma } from "@/lib/futures-daily-wrap-db";
import { getTrendingPerps, getPerpsByCoins, type TrendingPerp } from "@/lib/api-clients/hyperliquid";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
/** Public top-level tab — no login required. */
export const FUTURES_WRAP_APP_URL = `${APP_ORIGIN}/?tab=futures&futures=daily-wrap`;
export const FUTURES_HOT_PERPS_URL = `${APP_ORIGIN}/?tab=futures&futures=hot-perps`;
export const FUTURES_WORKFLOW_URL = `${APP_ORIGIN}/?tab=futures&futures=workflow`;
export const FUTURES_LIQ_URL = `${APP_ORIGIN}/?tab=futures&futures=liquidation-map`;

const NEW_DAYS = 7;
const TOP_MOMENTUM = 10;

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
  // Hyperliquid funding is per 8h typically; show as %
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(4)}%`;
}

function pickMajors(all: TrendingPerp[]): TrendingPerp[] {
  const want = ["BTC", "ETH", "SOL"];
  const byCoin = new Map(all.map((p) => [p.coin.toUpperCase(), p]));
  return want.map((c) => byCoin.get(c)).filter((p): p is TrendingPerp => !!p);
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
      parts.push(`Bitcoin ${fmtPct(btc.dayPct)} (mark $${Number(btc.markPx).toLocaleString("en-US", { maximumFractionDigits: 0 })})`);
      highlights.push("Bitcoin");
    }
    if (eth) {
      parts.push(`ETH ${fmtPct(eth.dayPct)} ($${Number(eth.markPx).toLocaleString("en-US", { maximumFractionDigits: 0 })})`);
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
  trending: TrendingPerp[]
): FuturesWrapItem[] {
  const items: FuturesWrapItem[] = [];

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

  const volumeLeaders = [...trending]
    .filter((p) => Number(p.dayNtlVlm) > 0)
    .sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm))
    .slice(0, 3);
  if (volumeLeaders.length > 0) {
    const line = volumeLeaders
      .map((p) => {
        const v = Number(p.dayNtlVlm);
        const label = v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${Math.round(v).toLocaleString()}`;
        return `${p.coin} ${label}`;
      })
      .join(" · ");
    items.push({
      id: "volume",
      text: `Highest 24h notional volume: ${line}.`,
      highlights: volumeLeaders.map((p) => p.coin),
      href: FUTURES_WORKFLOW_URL,
    });
  }

  items.push({
    id: "desk-cta",
    text: "Open Institutional Workflow or Liquidation Map on NovaStaris to turn today’s movers into a plan.",
    highlights: ["Institutional Workflow", "Liquidation Map", "NovaStaris"],
    href: FUTURES_WRAP_APP_URL,
  });

  return items;
}

function buildTelegramHtml(
  title: string,
  hotTopics: FuturesWrapItem[],
  marketUpdates: FuturesWrapItem[]
): string {
  const hot = hotTopics.map((t) => `• ${t.text}`).join("\n");
  const mkt = marketUpdates.map((t) => `• ${t.text}`).join("\n");
  return [
    `📊 <b>${title}</b>`,
    "",
    "🔥 <b>Hot Topics</b>",
    hot,
    "",
    "📰 <b>Market Updates</b>",
    mkt,
    "",
    `🔗 <a href="${FUTURES_WRAP_APP_URL}">Open Daily Wrap in NovaStaris</a>`,
  ].join("\n");
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

  const [trending, newRows] = await Promise.all([
    getTrendingPerps(TOP_MOMENTUM + 20),
    prisma.knownPerpSymbol.findMany({
      where: { firstSeenAt: { gte: newCutoff } },
      select: { symbol: true },
      orderBy: { firstSeenAt: "desc" },
      take: 8,
    }),
  ]);

  const newSymbols = newRows.map((r) => r.symbol);
  let newPerps: TrendingPerp[] = [];
  if (newSymbols.length > 0) {
    newPerps = await getPerpsByCoins(newSymbols);
  }

  // Prefer majors from a dedicated fetch if missing from trending slice
  let majors = pickMajors(trending);
  if (majors.length < 3) {
    const extra = await getPerpsByCoins(["BTC", "ETH", "SOL"]);
    const map = new Map(majors.map((p) => [p.coin.toUpperCase(), p]));
    for (const p of extra) map.set(p.coin.toUpperCase(), p);
    majors = ["BTC", "ETH", "SOL"].map((c) => map.get(c)).filter((p): p is TrendingPerp => !!p);
  }

  const hotTopics = buildHotTopics(trending, majors);
  const marketUpdates = buildMarketUpdates(newPerps, trending);
  const emailTeaser = [...hotTopics, ...marketUpdates].slice(0, 3);
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
