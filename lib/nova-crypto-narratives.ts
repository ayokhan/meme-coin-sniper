/**
 * Nova Crypto Narratives: news headlines (Google News RSS) + CFTC TFF positioning.
 * Tradingster mirrors the same CFTC breakdown (e.g. fin/133741 for CME Bitcoin).
 */

import Anthropic from "@anthropic-ai/sdk";

const CFTC_TFF_BASE = "https://publicreporting.cftc.gov/resource/gpe5-46if.json";
const TRADINGSTER_FIN_BASE = "https://www.tradingster.com/cot/futures/fin";

export type NewsHeadline = { title: string; link: string; pubDate?: string };

export type CotSnapshot = {
  marketName: string;
  contractMarketCode: string;
  reportDate: string;
  openInterest: number;
  assetManagersNet: number;
  leveragedFundsNet: number;
  dealersNet: number;
  otherReportablesNet: number;
  weekOverWeekChangeLevNet: number | null;
  cftcDatasetUrl: string;
  tradingsterUrl: string;
};

export type NovaCryptoNarrativesResult = {
  symbol: string;
  newsHeadlines: NewsHeadline[];
  cot: CotSnapshot | null;
  noiseSummary: string;
  narrativeDirection: "bullish" | "bearish" | "mixed";
  directionConfidence: "low" | "medium" | "high";
  institutionalNarrative: string;
  aiGenerated: boolean;
  disclaimer: string;
};

type CotSpec = {
  where: string;
  tradingsterCode: string;
  displayLabel: string;
};

function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return upper.replace(/\/USDT$/i, "").replace(/-USDT$/i, "").replace(/\/USD$/i, "").trim() || "BTC";
}

function cotSpecForSymbol(symbol: string): CotSpec | null {
  const s = normalizeSymbol(symbol);
  const map: Record<string, CotSpec> = {
    BTC: {
      where: `upper(contract_market_name) = 'BITCOIN' and contains(upper(market_and_exchange_names),'CHICAGO MERCANTILE')`,
      tradingsterCode: "133741",
      displayLabel: "CME Bitcoin futures (TFF, futures only)",
    },
    XBT: {
      where: `upper(contract_market_name) = 'BITCOIN' and contains(upper(market_and_exchange_names),'CHICAGO MERCANTILE')`,
      tradingsterCode: "133741",
      displayLabel: "CME Bitcoin futures (TFF, futures only)",
    },
    ETH: {
      where: `cftc_contract_market_code = '146021'`,
      tradingsterCode: "146021",
      displayLabel: "CME Ether cash-settled futures (TFF, futures only)",
    },
    SOL: {
      where: `contains(upper(contract_market_name),'SOLANA') and contains(upper(market_and_exchange_names),'NANO SOLANA')`,
      tradingsterCode: "177LM3",
      displayLabel: "Coinbase nano Solana-style futures (TFF, futures only)",
    },
  };
  return map[s] ?? null;
}

function num(s: string | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type CotRow = Record<string, string>;

function rowToSnapshot(row: CotRow, spec: CotSpec, prior: CotRow | null): CotSnapshot {
  const assetLong = num(row.asset_mgr_positions_long);
  const assetShort = num(row.asset_mgr_positions_short);
  const levLong = num(row.lev_money_positions_long);
  const levShort = num(row.lev_money_positions_short);
  const dealLong = num(row.dealer_positions_long_all);
  const dealShort = num(row.dealer_positions_short_all);
  const otherLong = num(row.other_rept_positions_long);
  const otherShort = num(row.other_rept_positions_short);
  const oi = num(row.open_interest_all);
  const reportRaw = row.report_date_as_yyyy_mm_dd ?? "";
  const reportDate = reportRaw ? String(reportRaw).slice(0, 10) : "—";

  let weekOverWeekChangeLevNet: number | null = null;
  if (prior) {
    const pl = num(prior.lev_money_positions_long);
    const ps = num(prior.lev_money_positions_short);
    weekOverWeekChangeLevNet = levLong - levShort - (pl - ps);
  }

  const q = encodeURIComponent(spec.where);
  const cftcDatasetUrl = `${CFTC_TFF_BASE}?$where=${q}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=2`;

  return {
    marketName: String(row.market_and_exchange_names ?? spec.displayLabel),
    contractMarketCode: String(row.cftc_contract_market_code ?? spec.tradingsterCode),
    reportDate,
    openInterest: oi,
    assetManagersNet: assetLong - assetShort,
    leveragedFundsNet: levLong - levShort,
    dealersNet: dealLong - dealShort,
    otherReportablesNet: otherLong - otherShort,
    weekOverWeekChangeLevNet,
    cftcDatasetUrl,
    tradingsterUrl: `${TRADINGSTER_FIN_BASE}/${spec.tradingsterCode}`,
  };
}

export async function fetchCotSnapshot(symbol: string): Promise<CotSnapshot | null> {
  const spec = cotSpecForSymbol(symbol);
  if (!spec) return null;
  const url = `${CFTC_TFF_BASE}?$where=${encodeURIComponent(spec.where)}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=2`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const rows = (await res.json()) as CotRow[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rowToSnapshot(rows[0]!, spec, rows[1] ?? null);
}

export async function fetchGoogleNewsHeadlines(query: string, limit = 14): Promise<NewsHeadline[]> {
  const q = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "NovaStarisBot/1.0" } });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRssItems(xml, limit);
}

function parseRssItems(xml: string, limit: number): NewsHeadline[] {
  const items: NewsHeadline[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))<\/title>/i);
    const linkMatch = block.match(/<link>([^<]+)<\/link>/i);
    const pubMatch = block.match(/<pubDate>([^<]+)<\/pubDate>/i);
    let title = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").trim();
    title = title.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");
    const link = (linkMatch?.[1] ?? "").trim();
    const pubDate = pubMatch?.[1]?.trim();
    if (title && link && !title.toLowerCase().includes("google news")) items.push({ title, link, pubDate });
  }
  return items;
}

const BULL = /\b(surge|rally|rip|soar|accumulation|inflow|etf\s+buy|bullish|breakout|adoption|upgrade|record high|ath|gain|short squeeze|risk.?on)\b/i;
const BEAR = /\b(crash|selloff|plunge|hack|exploit|sec\s|lawsuit|outflow|bearish|liquidat|ban|fraud|fears|risk.?off|collapse)\b/i;

function heuristicFromHeadlines(headlines: NewsHeadline[]): { narrativeDirection: "bullish" | "bearish" | "mixed"; confidence: "low" | "medium" | "high"; summary: string } {
  let bull = 0;
  let bear = 0;
  for (const h of headlines) {
    const t = h.title.toLowerCase();
    if (BULL.test(t)) bull++;
    if (BEAR.test(t)) bear++;
  }
  const n = Math.max(1, headlines.length);
  const bias = bull - bear;
  let narrativeDirection: "bullish" | "bearish" | "mixed" = "mixed";
  if (bias >= 2) narrativeDirection = "bullish";
  else if (bias <= -2) narrativeDirection = "bearish";
  const strength = Math.abs(bias) / n;
  const confidence: "low" | "medium" | "high" =
    headlines.length < 4 ? "low" : strength > 0.35 ? "high" : strength > 0.15 ? "medium" : "low";
  const summary = `Headline scan (${headlines.length} items): roughly ${bull} bullish-leaning vs ${bear} bearish-leaning keyword hits. This is a crude read of media tone—not a trade signal.`;
  return { narrativeDirection, confidence, summary };
}

function templateInstitutional(cot: CotSnapshot | null, symbol: string): string {
  if (!cot) {
    return `No direct CME/CFTC Traders-in-Financial-Futures (TFF) mapping is configured for ${symbol}. For major contracts, compare spot/perp flow to macro; institutional positioning for BTC and ETH is published weekly on CFTC and mirrored on Tradingster.`;
  }
  const levCh =
    cot.weekOverWeekChangeLevNet == null
      ? "N/A"
      : `${cot.weekOverWeekChangeLevNet >= 0 ? "+" : ""}${cot.weekOverWeekChangeLevNet} contracts vs prior week (leveraged funds net)`;
  const assetSkew =
    cot.assetManagersNet > 0 ? "net long" : cot.assetManagersNet < 0 ? "net short" : "roughly flat";
  const levSkew =
    cot.leveragedFundsNet > 0 ? "net long" : cot.leveragedFundsNet < 0 ? "net short" : "roughly flat";
  return (
    `Latest CFTC TFF (futures only) as of ${cot.reportDate} for ${cot.marketName}. Open interest ${cot.openInterest.toLocaleString()} contracts. ` +
    `Asset manager / institutional positioning is ${assetSkew} (${cot.assetManagersNet >= 0 ? "+" : ""}${cot.assetManagersNet} contracts net). ` +
    `Leveraged funds are ${levSkew} (${cot.leveragedFundsNet >= 0 ? "+" : ""}${cot.leveragedFundsNet} net). Week-over-week change in leveraged net: ${levCh}. ` +
    `Dealers / PRC net ${cot.dealersNet >= 0 ? "+" : ""}${cot.dealersNet}. CFTC releases are weekly (Tuesday snapshot); use Tradingster for the same breakdown visually.`
  );
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function synthesizeWithClaude(
  symbol: string,
  headlines: NewsHeadline[],
  cot: CotSnapshot | null
): Promise<{ noiseSummary: string; narrativeDirection: "bullish" | "bearish" | "mixed"; directionConfidence: "low" | "medium" | "high"; institutionalNarrative: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const lines = headlines.slice(0, 14).map((h, i) => `${i + 1}. ${h.title}`);
  const cotBlock = cot
    ? `CFTC TFF snapshot (${cot.reportDate}): ${cot.marketName}. OI ${cot.openInterest}. Asset mgr net ${cot.assetManagersNet}. Leveraged funds net ${cot.leveragedFundsNet}. WoW Δ leveraged net ${cot.weekOverWeekChangeLevNet ?? "n/a"}. Dealers net ${cot.dealersNet}.`
    : "No matched CFTC row for this symbol.";

  const prompt = `You analyze crypto futures narratives for professional traders.

Contract focus: ${symbol} (perpetuals / futures narrative context).

Recent headlines (Google News — may include noise and duplicates):
${lines.join("\n")}

${cotBlock}

Respond with ONLY a JSON object (no markdown fences):
{"noiseSummary":"2-4 sentences separating substance from noise in headlines","narrativeDirection":"bullish"|"bearish"|"mixed","directionConfidence":"low"|"medium"|"high","institutionalNarrative":"2-5 sentences on how REPORTED institutional categories (asset managers vs leveraged funds) relate to direction; state CFTC data is weekly and can lag violent spot moves; mention that public breakdowns like Tradingster mirror CFTC TFF"}

Rules: "mixed" if headlines conflict. Do not promise profit. Be skeptical of single-source hype.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });
  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";
  const obj = extractJsonObject(text);
  if (!obj) return null;
  const noiseSummary = typeof obj.noiseSummary === "string" ? obj.noiseSummary : "";
  const institutionalNarrative = typeof obj.institutionalNarrative === "string" ? obj.institutionalNarrative : "";
  const nd = String(obj.narrativeDirection ?? "").toLowerCase();
  const narrativeDirection: "bullish" | "bearish" | "mixed" =
    nd === "bullish" || nd === "bearish" ? nd : "mixed";
  const dc = String(obj.directionConfidence ?? "").toLowerCase();
  const directionConfidence: "low" | "medium" | "high" =
    dc === "high" ? "high" : dc === "low" ? "low" : "medium";
  if (!noiseSummary) return null;
  return { noiseSummary, narrativeDirection, directionConfidence, institutionalNarrative: institutionalNarrative || templateInstitutional(cot, symbol) };
}

function newsQueryForSymbol(symbol: string): string {
  if (symbol === "BTC" || symbol === "XBT") return "(BTC OR Bitcoin) (crypto OR futures OR ETF)";
  if (symbol === "ETH") return "(ETH OR Ethereum) (crypto OR futures)";
  if (symbol === "SOL") return "(Solana OR SOL) (crypto OR futures)";
  return `${symbol} cryptocurrency crypto futures`;
}

export async function buildNovaCryptoNarratives(symbolRaw: string): Promise<NovaCryptoNarrativesResult> {
  const symbol = normalizeSymbol(symbolRaw);
  const query = newsQueryForSymbol(symbol);

  const [newsHeadlines, cot] = await Promise.all([fetchGoogleNewsHeadlines(query, 14), fetchCotSnapshot(symbol)]);

  const heuristic = heuristicFromHeadlines(newsHeadlines);
  let aiGenerated = false;
  let noiseSummary = heuristic.summary;
  let narrativeDirection = heuristic.narrativeDirection;
  let directionConfidence = heuristic.confidence;
  let institutionalNarrative = templateInstitutional(cot, symbol);

  const ai = await synthesizeWithClaude(symbol, newsHeadlines, cot);
  if (ai) {
    aiGenerated = true;
    noiseSummary = ai.noiseSummary;
    narrativeDirection = ai.narrativeDirection;
    directionConfidence = ai.directionConfidence;
    institutionalNarrative = ai.institutionalNarrative;
  } else if (newsHeadlines.length === 0) {
    noiseSummary =
      "No recent headlines returned from the public news feed. Try again later or adjust the contract symbol (e.g. BTC, ETH).";
    narrativeDirection = "mixed";
    directionConfidence = "low";
  }

  const disclaimer =
    "Nova Crypto Narratives aggregates third-party headlines and delayed CFTC positioning. It is not investment advice. Always verify sources and report dates.";

  return {
    symbol,
    newsHeadlines,
    cot,
    noiseSummary,
    narrativeDirection,
    directionConfidence,
    institutionalNarrative,
    aiGenerated,
    disclaimer,
  };
}
