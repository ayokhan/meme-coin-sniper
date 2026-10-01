/**
 * Strong Runners: established mid-cap memes with strong narrative, deep liquidity,
 * sustained flow and clean holder structure — candidates for multi-hour to multi-day holds.
 *
 * Data: DexScreener (discovery + metrics), GoPlus (Solana/BSC safety + holders),
 * Google News headlines + Claude (narrative strength / leader detection).
 */

import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";
import type { DexPair } from "@/lib/api-clients/dexscreener";
import { getEvmTokenSecurity, getSolanaTokenSecurity, type GoPlusHolder } from "@/lib/api-clients/goplus";
import { fetchGoogleNewsHeadlines } from "@/lib/nova-crypto-narratives";

export type StrongRunnerChain = "solana" | "robinhood" | "bsc";
export const STRONG_RUNNER_CHAINS: StrongRunnerChain[] = ["solana", "robinhood", "bsc"];

export function isStrongRunnerChain(v: unknown): v is StrongRunnerChain {
  return typeof v === "string" && (STRONG_RUNNER_CHAINS as string[]).includes(v);
}

export type StrongRunnerThresholds = {
  minMarketCapUsd: number;
  maxMarketCapUsd: number;
  minLiquidityUsd: number;
  minLiquidityRatio: number;
  minVolume24hUsd: number;
  minAgeHours: number;
  minConvictionScore: number;
};

export type StrongRunnerStatus = "building" | "running" | "cooling";

export type StrongRunnerCoin = {
  name: string;
  symbol: string;
  address: string;
  pairAddress: string;
  chain: StrongRunnerChain;
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  buyRatio24h: number;
  ageDays: number;
  holderCount: number | null;
  top10Pct: number | null;
  conviction: number;
  scores: { narrative: number; liquidity: number; momentum: number; holders: number };
  safetyChecked: boolean;
  status: StrongRunnerStatus;
  narrative: string;
  isLeader: boolean;
  thesis: string;
  risk: string;
  invalidation: string;
  flags: string[];
  pairUrl: string;
  socials: { twitter?: string; telegram?: string; website?: string };
};

export type StrongRunnerResult = {
  chain: StrongRunnerChain;
  scannedAt: string;
  thresholds: StrongRunnerThresholds;
  pairsScanned: number;
  candidates: number;
  aiUsed: boolean;
  coins: StrongRunnerCoin[];
};

const DEX = "https://api.dexscreener.com";
/** A weak story contradicts the premise of the tab, whatever the liquidity. */
const MIN_NARRATIVE_SCORE = 45;
const REQUEST_TIMEOUT_MS = 9000;

/** Robinhood Chain is young: fewer coins reach Solana-sized caps, so the size bars scale down. */
const CHAIN_SIZE_SCALE: Record<StrongRunnerChain, number> = { solana: 1, bsc: 1, robinhood: 0.35 };
const CHAIN_MIN_AGE_HOURS: Partial<Record<StrongRunnerChain, number>> = { robinhood: 24 };

const DEX_CHAIN_ID: Record<StrongRunnerChain, string[]> = {
  solana: ["solana"],
  robinhood: ["robinhood"],
  bsc: ["bsc", "bnb"],
};

const SEARCH_QUERIES: Record<StrongRunnerChain, string[]> = {
  solana: [
    "SOL", "solana meme", "pump.fun", "pumpswap", "raydium", "meteora", "meme", "cat", "dog", "frog",
    "pepe", "trump", "elon", "ai agent", "ai", "anime", "cult", "penguin", "monkey", "wojak", "based",
    "chill", "moo", "bonk", "inu", "baby", "cto", "sol meme",
  ],
  bsc: [
    "WBNB", "BNB", "bsc meme", "four.meme", "fourmeme", "pancakeswap", "binance", "cz", "meme", "pepe", "dog",
    "cat", "ai", "trump", "frog", "chinese meme", "币安", "人生", "bnb chain", "bsc", "cto", "inu", "baby", "doge",
    "moon", "giggle",
  ],
  robinhood: [
    "robinhood", "robinhood chain", "hood", "WETH", "ETH", "uniswap", "meme", "pepe", "dog", "cat", "ai",
    "frog", "trump",
  ],
};

/** Non-meme bases that should never surface (stables, majors, wrapped assets, tokenized stocks). */
const NON_MEME_SYMBOLS = new Set([
  "SOL", "WSOL", "USDC", "USDT", "USDS", "PYUSD", "DAI", "BNB", "WBNB", "ETH", "WETH", "BTC", "WBTC",
  "BTCB", "CAKE", "JUP", "RAY", "ORCA", "JTO", "PYTH", "MSOL", "JITOSOL", "BSOL", "FDUSD", "USD1", "HOOD",
]);
const NON_MEME_NAME = /\b(tokenized|xstock|stock|etf|wrapped|bridged|usd coin|tether|staked)\b/i;

const THEME_WORDS = [
  "trump", "elon", "musk", "pepe", "doge", "dog", "cat", "frog", "ai", "agent", "anime", "cult", "penguin",
  "monkey", "ape", "wojak", "chad", "based", "maga", "moon", "bonk", "cz", "binance", "hood", "robin",
];

type TokenAgg = {
  main: DexPair;
  address: string;
  liquidityUsd: number;
  volume24h: number;
  volume6h: number;
  buys24h: number;
  sells24h: number;
  description?: string;
};

function toMs(createdAt: number): number {
  return createdAt < 1e12 ? createdAt * 1000 : createdAt;
}

function mcapOf(p: DexPair): number {
  const raw = (p as DexPair & { marketCap?: number }).marketCap ?? p.fdv ?? 0;
  return Number(raw) || 0;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function fmtUsdShort(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function getJson<T>(url: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const res = await axios.get<T>(url, { params, timeout: REQUEST_TIMEOUT_MS });
    return res.data;
  } catch {
    return null;
  }
}

/** Fetch pairs for up to 30 token addresses per request. */
export async function fetchPairsForTokens(dexChainId: string, addresses: string[]): Promise<DexPair[]> {
  const batches: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) batches.push(addresses.slice(i, i + 30));
  const results = await mapLimit(batches, 4, (batch) =>
    getJson<DexPair[] | { pairs?: DexPair[] }>(`${DEX}/tokens/v1/${dexChainId}/${batch.join(",")}`)
  );
  const out: DexPair[] = [];
  for (const r of results) {
    if (!r) continue;
    out.push(...(Array.isArray(r) ? r : r.pairs ?? []));
  }
  return out;
}

type ListedToken = { chainId?: string; tokenAddress?: string; description?: string };

async function discoverPairs(chain: StrongRunnerChain): Promise<{ pairs: DexPair[]; descriptions: Map<string, string> }> {
  const chainIds = DEX_CHAIN_ID[chain];
  const descriptions = new Map<string, string>();

  const searchPromise = mapLimit(SEARCH_QUERIES[chain], 6, (q) =>
    getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/search`, { q })
  );
  const listPromise = Promise.all([
    getJson<ListedToken[]>(`${DEX}/token-boosts/top/v1`),
    getJson<ListedToken[]>(`${DEX}/token-boosts/latest/v1`),
    getJson<ListedToken[]>(`${DEX}/token-profiles/latest/v1`),
    getJson<ListedToken[]>(`${DEX}/community-takeovers/latest/v1`),
  ]);

  const [searchResults, lists] = await Promise.all([searchPromise, listPromise]);

  const listed = new Set<string>();
  for (const list of lists) {
    for (const t of list ?? []) {
      if (!t.tokenAddress || !chainIds.includes((t.chainId ?? "").toLowerCase())) continue;
      listed.add(t.tokenAddress);
      if (t.description && !descriptions.has(t.tokenAddress)) descriptions.set(t.tokenAddress, t.description.slice(0, 200));
    }
  }

  const pairs: DexPair[] = [];
  for (const r of searchResults) pairs.push(...(r?.pairs ?? []));
  if (listed.size) pairs.push(...(await fetchPairsForTokens(chainIds[0], [...listed].slice(0, 120))));

  return {
    pairs: pairs.filter((p) => chainIds.includes((p.chainId ?? "").toLowerCase())),
    descriptions,
  };
}

function aggregateByToken(pairs: DexPair[], descriptions: Map<string, string>): TokenAgg[] {
  const seenPair = new Set<string>();
  const byToken = new Map<string, TokenAgg>();
  for (const p of pairs) {
    const addr = p.baseToken?.address;
    if (!addr || !p.pairAddress || seenPair.has(p.pairAddress)) continue;
    seenPair.add(p.pairAddress);
    const liq = p.liquidity?.usd ?? 0;
    const cur = byToken.get(addr);
    if (!cur) {
      byToken.set(addr, {
        main: p,
        address: addr,
        liquidityUsd: liq,
        volume24h: p.volume?.h24 ?? 0,
        volume6h: p.volume?.h6 ?? 0,
        buys24h: p.txns?.h24?.buys ?? 0,
        sells24h: p.txns?.h24?.sells ?? 0,
        description: descriptions.get(addr),
      });
      continue;
    }
    cur.liquidityUsd += liq;
    cur.volume24h += p.volume?.h24 ?? 0;
    cur.volume6h += p.volume?.h6 ?? 0;
    cur.buys24h += p.txns?.h24?.buys ?? 0;
    cur.sells24h += p.txns?.h24?.sells ?? 0;
    if (liq > (cur.main.liquidity?.usd ?? 0)) cur.main = p;
  }
  return [...byToken.values()];
}

function isNonMeme(p: DexPair): boolean {
  const sym = (p.baseToken?.symbol ?? "").toUpperCase();
  const name = p.baseToken?.name ?? "";
  return NON_MEME_SYMBOLS.has(sym) || NON_MEME_NAME.test(name);
}

function liquidityScore(liq: number, mcap: number): number {
  const lo = Math.log10(150_000);
  const hi = Math.log10(5_000_000);
  const base = ((Math.log10(Math.max(liq, 1)) - lo) / (hi - lo)) * 80;
  const ratio = mcap > 0 ? liq / mcap : 0;
  const bonus = ratio >= 0.1 ? 20 : ratio >= 0.07 ? 12 : ratio >= 0.05 ? 6 : 0;
  return Math.round(clamp(base + bonus));
}

function momentumParts(t: TokenAgg, mcap: number) {
  const c1 = t.main.priceChange?.h1 ?? 0;
  const c6 = t.main.priceChange?.h6 ?? 0;
  const c24 = t.main.priceChange?.h24 ?? 0;
  const txns = t.buys24h + t.sells24h;
  const buyRatio = txns > 0 ? t.buys24h / txns : 0.5;
  const sustain = t.volume24h > 0 ? (t.volume6h * 4) / t.volume24h : 0;
  const turnover = mcap > 0 ? t.volume24h / mcap : 0;
  return { c1, c6, c24, buyRatio, sustain, turnover };
}

function momentumScore(m: ReturnType<typeof momentumParts>): number {
  let s = clamp((m.turnover / 0.8) * 35, 0, 35);
  s += m.sustain >= 1 ? 20 : m.sustain >= 0.7 ? 14 : m.sustain >= 0.5 ? 7 : 0;
  s += clamp(((m.buyRatio - 0.45) / 0.15) * 20, 0, 20);
  if (m.c24 >= 5 && m.c24 <= 150) s += 15;
  else if (m.c24 > 150) s += 8;
  else if (m.c24 >= -10) s += 8;
  if (m.c6 > 0) s += 10;
  else if (m.c6 > -8) s += 5;
  return Math.round(clamp(s));
}

function statusOf(m: ReturnType<typeof momentumParts>): StrongRunnerStatus {
  if (m.c24 <= -15 || m.c6 < -12 || m.c1 < -8 || m.sustain < 0.45) return "cooling";
  if (m.c24 >= 15 && m.c6 >= 0) return "running";
  return "building";
}

/** Top-10 share of supply excluding pools, locks and contracts. */
function top10ExPools(holders: GoPlusHolder[], lpAddresses: Set<string>): number | null {
  if (!holders.length) return null;
  const wallets = holders
    .filter((h) => !h.isContract && !h.isLocked && !h.tag && !lpAddresses.has(h.address))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 10);
  return Math.round(wallets.reduce((s, h) => s + h.percent, 0) * 10) / 10;
}

type SafetyResult = {
  checked: boolean;
  exclude: boolean;
  score: number;
  holderCount: number | null;
  top10Pct: number | null;
  flags: string[];
};

async function checkSafety(chain: StrongRunnerChain, address: string): Promise<SafetyResult> {
  const neutral: SafetyResult = { checked: false, exclude: false, score: 50, holderCount: null, top10Pct: null, flags: [] };
  if (chain === "robinhood") return neutral;

  const flags: string[] = [];
  let score = 50;
  let holderCount: number | null = null;
  let top10Pct: number | null = null;

  if (chain === "solana") {
    const sec = await getSolanaTokenSecurity(address);
    if (!sec) return neutral;
    if (!sec.mintAuthorityRevoked) return { ...neutral, checked: true, exclude: true, flags: ["Mint authority active"] };
    if (!sec.freezeAuthorityRevoked) {
      score -= 30;
      flags.push("Freeze authority active");
    }
    holderCount = sec.holderCount;
    top10Pct = top10ExPools(sec.holders, new Set(sec.lpHolders.map((h) => h.address)));
  } else {
    const sec = await getEvmTokenSecurity(address, "bsc");
    if (!sec) return neutral;
    if (sec.isHoneypot) return { ...neutral, checked: true, exclude: true, flags: ["Honeypot"] };
    if ((sec.sellTaxPct ?? 0) > 10 || (sec.buyTaxPct ?? 0) > 10) {
      score -= 30;
      flags.push(`High tax (buy ${Math.round(sec.buyTaxPct ?? 0)}% / sell ${Math.round(sec.sellTaxPct ?? 0)}%)`);
    }
    if (sec.isMintable) {
      score -= 20;
      flags.push("Mintable");
    }
    if (sec.hiddenOwner || sec.canTakeBackOwnership) {
      score -= 30;
      flags.push("Owner can regain control");
    }
    holderCount = sec.holderCount;
    top10Pct = top10ExPools(sec.holders, new Set(sec.lpHolders.map((h) => h.address)));
  }

  if (holderCount != null) {
    if (holderCount >= 20_000) score += 25;
    else if (holderCount >= 8_000) score += 18;
    else if (holderCount >= 3_000) score += 10;
    else if (holderCount < 1_000) {
      score -= 15;
      flags.push("Few holders");
    }
  }
  if (top10Pct != null) {
    if (top10Pct <= 15) score += 20;
    else if (top10Pct <= 25) score += 10;
    else if (top10Pct > 40) {
      score -= 25;
      flags.push(`Top 10 wallets hold ${top10Pct}%`);
    }
  }

  return { checked: true, exclude: false, score: Math.round(clamp(score)), holderCount, top10Pct, flags };
}

function socialsOf(p: DexPair): StrongRunnerCoin["socials"] {
  const out: StrongRunnerCoin["socials"] = {};
  for (const s of p.info?.socials ?? []) {
    const kind = (s.type ?? s.platform ?? "").toLowerCase();
    if ((kind === "twitter" || kind === "x") && s.url) out.twitter = s.url;
    if (kind === "telegram" && s.url) out.telegram = s.url;
  }
  const site = p.info?.websites?.[0]?.url;
  if (site) out.website = site;
  return out;
}

type AiVerdict = {
  address: string;
  isMeme: boolean;
  narrative: string;
  narrativeScore: number;
  isLeader: boolean;
  thesis: string;
  risk: string;
};

function heuristicNarrative(t: TokenAgg): AiVerdict {
  const p = t.main;
  const words = `${p.baseToken.name} ${p.baseToken.symbol} ${t.description ?? ""}`.toLowerCase();
  const themes = THEME_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(words));
  const socials = socialsOf(p);
  const socialCount = Object.keys(socials).length;
  return {
    address: t.address,
    isMeme: true,
    narrative: themes[0] ? `${themes[0][0].toUpperCase()}${themes[0].slice(1)} meme` : "Community meme",
    narrativeScore: Math.round(clamp(40 + socialCount * 7 + themes.length * 8, 0, 75)),
    isLeader: false,
    thesis: "Strong liquidity and sustained trading for its size.",
    risk: "Narrative strength not AI-verified this scan.",
  };
}

async function rateNarratives(
  chain: StrongRunnerChain,
  tokens: TokenAgg[],
  headlines: string[]
): Promise<Map<string, AiVerdict> | null> {
  if (!process.env.ANTHROPIC_API_KEY || !tokens.length) return null;
  const now = Date.now();
  const lines = tokens.map((t) => {
    const p = t.main;
    const s = socialsOf(p);
    const age = ((now - toMs(p.pairCreatedAt)) / 86_400_000).toFixed(1);
    return [
      p.baseToken.name,
      p.baseToken.symbol,
      t.address,
      `age ${age}d`,
      `mcap ${fmtUsdShort(mcapOf(p))}`,
      `liq ${fmtUsdShort(t.liquidityUsd)}`,
      `vol24 ${fmtUsdShort(t.volume24h)}`,
      `chg24 ${(p.priceChange?.h24 ?? 0).toFixed(0)}%`,
      `socials ${[s.twitter && "X", s.telegram && "TG", s.website && "web"].filter(Boolean).join("/") || "none"}`,
      t.description ? `desc: ${t.description.replace(/\s+/g, " ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  });

  const prompt = `You are a veteran ${chain === "bsc" ? "BNB Chain" : chain === "robinhood" ? "Robinhood Chain" : "Solana"} meme coin analyst.
These coins already passed liquidity, volume and age filters. Judge NARRATIVE strength for a multi-day hold.

Score narrativeScore 0-100:
- 80+: culturally strong, clear story, broad appeal, likely the LEADER of a live narrative right now
- 60-79: solid recognizable narrative with community
- 40-59: generic or derivative
- <40: copycat, no story, or narrative is dead
isLeader = true only if it is the top coin of its narrative (not a copy of another coin).
isMeme = false for stablecoins, wrapped/bridged assets, tokenized stocks, utility/DeFi governance tokens.

COINS:
${lines.join("\n")}

${headlines.length ? `CURRENT HEADLINES:\n${headlines.map((h) => `- ${h}`).join("\n")}` : ""}

Return ONLY a JSON array, one object per coin:
{"address":"string","isMeme":boolean,"narrative":"2-4 word label","narrativeScore":number,"isLeader":boolean,"thesis":"one short sentence why it could keep running","risk":"one short sentence main risk"}
No markdown.`;

  try {
    const client = new Anthropic({ timeout: 40_000, maxRetries: 0 });
    const msg = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as Record<string, unknown>[];
    const out = new Map<string, AiVerdict>();
    for (const item of parsed) {
      const address = String(item.address ?? "");
      if (!address) continue;
      out.set(address, {
        address,
        isMeme: item.isMeme !== false,
        narrative: String(item.narrative ?? "Meme").slice(0, 40),
        narrativeScore: Math.round(clamp(Number(item.narrativeScore) || 0)),
        isLeader: item.isLeader === true,
        thesis: String(item.thesis ?? "").slice(0, 200),
        risk: String(item.risk ?? "").slice(0, 200),
      });
    }
    return out.size ? out : null;
  } catch (e) {
    console.error("strong-runners AI:", e);
    return null;
  }
}

export function effectiveThresholds(chain: StrongRunnerChain, base: StrongRunnerThresholds): StrongRunnerThresholds {
  const scale = CHAIN_SIZE_SCALE[chain];
  return {
    ...base,
    minMarketCapUsd: base.minMarketCapUsd * scale,
    minLiquidityUsd: base.minLiquidityUsd * scale,
    minVolume24hUsd: base.minVolume24hUsd * scale,
    minAgeHours: Math.min(base.minAgeHours, CHAIN_MIN_AGE_HOURS[chain] ?? base.minAgeHours),
  };
}

export async function runStrongRunnersScan(
  chain: StrongRunnerChain,
  baseThresholds: StrongRunnerThresholds,
  limit = 15
): Promise<StrongRunnerResult> {
  const th = effectiveThresholds(chain, baseThresholds);
  const now = Date.now();

  const [{ pairs, descriptions }, headlineItems] = await Promise.all([
    discoverPairs(chain),
    fetchGoogleNewsHeadlines(
      chain === "bsc" ? "binance OR BNB OR meme coin OR crypto" : chain === "robinhood" ? "robinhood OR meme coin OR crypto" : "solana OR meme coin OR crypto",
      12
    ).catch(() => [] as { title: string }[]),
  ]);
  const headlines = headlineItems.map((h) => h.title).filter(Boolean).slice(0, 12);

  const tokens = aggregateByToken(pairs, descriptions);

  const passing = tokens.filter((t) => {
    const p = t.main;
    if (isNonMeme(p)) return false;
    const mcap = mcapOf(p);
    if (mcap < th.minMarketCapUsd || mcap > th.maxMarketCapUsd) return false;
    if (t.liquidityUsd < th.minLiquidityUsd || t.liquidityUsd / mcap < th.minLiquidityRatio) return false;
    if (t.liquidityUsd > mcap) return false;
    if (t.volume24h < th.minVolume24hUsd) return false;
    const created = toMs(p.pairCreatedAt ?? 0);
    if (!created || (now - created) / 3_600_000 < th.minAgeHours) return false;
    if ((p.priceChange?.h24 ?? 0) <= -25 || (p.priceChange?.h1 ?? 0) <= -15) return false;
    return true;
  });

  const preRanked = passing
    .map((t) => {
      const mcap = mcapOf(t.main);
      const m = momentumParts(t, mcap);
      return { t, mcap, m, liq: liquidityScore(t.liquidityUsd, mcap), mom: momentumScore(m) };
    })
    .sort((a, b) => b.liq + b.mom - (a.liq + a.mom))
    .slice(0, 22);

  const safety = await mapLimit(preRanked, 6, (r) => checkSafety(chain, r.t.address));
  const safe = preRanked
    .map((r, i) => ({ ...r, safety: safety[i] }))
    .filter((r) => !r.safety.exclude);

  const ai = await rateNarratives(chain, safe.map((r) => r.t), headlines);

  const coins: StrongRunnerCoin[] = [];
  for (const r of safe) {
    const verdict = ai?.get(r.t.address) ?? heuristicNarrative(r.t);
    if (!verdict.isMeme || verdict.narrativeScore < MIN_NARRATIVE_SCORE) continue;
    const p = r.t.main;
    const holders = r.safety.score;
    let conviction = 0.3 * verdict.narrativeScore + 0.2 * r.liq + 0.25 * r.mom + 0.25 * holders;
    if (verdict.isLeader) conviction += 5;
    conviction = Math.round(clamp(conviction));
    if (conviction < th.minConvictionScore) continue;

    const flags = [...r.safety.flags];
    if (!r.safety.checked) flags.push(chain === "robinhood" ? "Holder & contract checks not available on Robinhood Chain yet" : "Safety check unavailable this scan");
    if (r.m.c24 > 150) flags.push("Overextended after a big 24h move");

    coins.push({
      name: p.baseToken.name,
      symbol: p.baseToken.symbol,
      address: r.t.address,
      pairAddress: p.pairAddress,
      chain,
      priceUsd: Number(p.priceUsd) || 0,
      marketCapUsd: r.mcap,
      liquidityUsd: r.t.liquidityUsd,
      volume24hUsd: r.t.volume24h,
      priceChange1h: r.m.c1,
      priceChange6h: r.m.c6,
      priceChange24h: r.m.c24,
      buyRatio24h: Math.round(r.m.buyRatio * 100) / 100,
      ageDays: Math.round(((now - toMs(p.pairCreatedAt)) / 86_400_000) * 10) / 10,
      holderCount: r.safety.holderCount,
      top10Pct: r.safety.top10Pct,
      conviction,
      scores: { narrative: verdict.narrativeScore, liquidity: r.liq, momentum: r.mom, holders },
      safetyChecked: r.safety.checked,
      status: statusOf(r.m),
      narrative: verdict.narrative,
      isLeader: verdict.isLeader,
      thesis: verdict.thesis,
      risk: verdict.risk,
      invalidation: `Weakens if liquidity drops below ${fmtUsdShort(r.t.liquidityUsd * 0.7)} or market cap falls under ${fmtUsdShort(r.mcap * 0.65)}.`,
      flags,
      pairUrl: `https://dexscreener.com/${(p.chainId || DEX_CHAIN_ID[chain][0]).toLowerCase()}/${p.pairAddress}`,
      socials: socialsOf(p),
    });
  }

  coins.sort((a, b) => b.conviction - a.conviction);

  return {
    chain,
    scannedAt: new Date().toISOString(),
    thresholds: th,
    pairsScanned: tokens.length,
    candidates: passing.length,
    aiUsed: !!ai,
    coins: coins.slice(0, limit),
  };
}
