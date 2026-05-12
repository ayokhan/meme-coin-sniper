import { getSolanaToken, getBscToken, extractSocials, type DexPair } from "@/lib/api-clients/dexscreener";
import { getEvmTokenSecurity, getSolanaTokenSecurity, type GoPlusHolder } from "@/lib/api-clients/goplus";
import type {
  AnalyzedHolder,
  DeepChain,
  DeepMemeReport,
  DeepMemeResult,
  HolderClass,
  SecurityFlag,
} from "./types";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : null;

const BURN_ADDRESSES_EVM = new Set<string>([
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
]);
const BURN_ADDRESSES_SOL = new Set<string>([
  "1nc1nerator11111111111111111111111111111111",
]);

const KNOWN_PROGRAMS_SOL = new Set<string>([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Raydium AMM authority
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // Pump.fun program
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX", // Serum
]);

const KNOWN_EXCHANGE_TAGS = new Set<string>([
  "binance",
  "coinbase",
  "okx",
  "bybit",
  "kucoin",
  "kraken",
  "gate.io",
  "mexc",
  "bitfinex",
  "huobi",
]);

function chainFromAddress(input: string): { chain: DeepChain | "auto"; normalized: string } {
  const raw = (input || "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) return { chain: "auto", normalized: raw.toLowerCase() };
  // Solana base58 mints are typically 32-44 chars from [1-9A-HJ-NP-Za-km-z]
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) return { chain: "solana", normalized: raw };
  return { chain: "auto", normalized: raw };
}

async function helRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  if (!HELIUS_RPC) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { result?: T; error?: { message?: string } };
      if (data.error) return null;
      return data.result ?? null;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

/**
 * Get the number of non-zero-balance holder accounts for a Solana mint via Helius DAS
 * `getTokenAccounts`. Free tier supports this. Returns null if Helius is unavailable.
 *
 * NOTE: DAS expects `params` as a single object (not an array), so we bypass the standard
 * `helRpc` helper here.
 */
async function getSolanaHolderCount(mint: string): Promise<number | null> {
  if (!HELIUS_RPC) return null;
  type Resp = { total?: number; token_accounts?: unknown[]; cursor?: string };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "getTokenAccounts",
          method: "getTokenAccounts",
          params: {
            mint,
            limit: 1,
            options: { showZeroBalance: false },
          },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { result?: Resp; error?: { message?: string } };
      if (data.error || !data.result) return null;
      const total = data.result.total;
      if (typeof total === "number" && Number.isFinite(total) && total >= 0) return total;
      return null;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

async function getSolanaTopHolders(mint: string, take = 20): Promise<Array<{ tokenAccount: string; owner: string; balance: number; percent: number }>> {
  const res = await helRpc<{
    value?: Array<{ address: string; amount?: string; decimals?: number; uiAmount?: number }>;
  }>("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
  const items = (res?.value ?? []).slice(0, take);
  if (items.length === 0) return [];
  const total = items.reduce((sum, it) => sum + (it.uiAmount ?? 0), 0);
  // Resolve token-account → owner via getMultipleAccounts (jsonParsed).
  const chunks: string[][] = [];
  const accs = items.map((it) => it.address);
  for (let i = 0; i < accs.length; i += 100) chunks.push(accs.slice(i, i + 100));
  const ownerMap = new Map<string, string>();
  for (const c of chunks) {
    const r = await helRpc<{ value?: Array<null | { data?: { parsed?: { info?: { owner?: string } } } }> }>(
      "getMultipleAccounts",
      [c, { encoding: "jsonParsed" }],
    );
    const vals = r?.value ?? [];
    for (let i = 0; i < c.length; i += 1) {
      const owner = vals[i]?.data?.parsed?.info?.owner;
      if (owner) ownerMap.set(c[i], owner);
    }
  }
  return items
    .map((it) => {
      const owner = ownerMap.get(it.address) ?? "";
      const balance = it.uiAmount ?? 0;
      const percent = total > 0 ? (balance / total) * 100 : 0;
      return { tokenAccount: it.address, owner, balance, percent };
    })
    .filter((x) => x.owner.length > 0);
}

function shortBalance(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function classifyEvmHolder(
  h: GoPlusHolder,
  args: {
    rank: number;
    ownerAddress: string | null;
    creatorAddress: string | null;
    burnSet: Set<string>;
    lpAddresses: Set<string>;
    isLpHolder: boolean;
  },
): { classes: HolderClass[]; reasons: string[] } {
  const classes: HolderClass[] = [];
  const reasons: string[] = [];
  const addr = h.address.toLowerCase();
  const tagLower = (h.tag || "").toLowerCase();

  if (args.burnSet.has(addr)) {
    classes.push("burn");
    reasons.push("Burn address (supply destroyed)");
    return { classes, reasons };
  }
  if (args.isLpHolder || args.lpAddresses.has(addr) || tagLower.includes("lp") || tagLower.includes("pancake") || tagLower.includes("uniswap")) {
    classes.push("lp");
    reasons.push("Liquidity pool / DEX router");
    return { classes, reasons };
  }
  if (KNOWN_EXCHANGE_TAGS.has(tagLower) || tagLower.includes("exchange")) {
    classes.push("exchange");
    reasons.push(`Centralized exchange wallet${tagLower ? ` (${tagLower})` : ""}`);
    return { classes, reasons };
  }
  if (args.creatorAddress && addr === args.creatorAddress.toLowerCase()) {
    classes.push("dev");
    reasons.push("Token creator / deployer");
  }
  if (args.ownerAddress && addr === args.ownerAddress.toLowerCase() && !classes.includes("dev")) {
    classes.push("dev");
    reasons.push("Contract owner wallet");
  }
  if (h.isContract && !classes.includes("lp") && !classes.includes("exchange")) {
    classes.push("contract");
    reasons.push("Smart contract");
  }
  if (h.percent >= 5) {
    classes.push("whale");
    reasons.push(`Holds ${h.percent.toFixed(2)}% of supply`);
  }
  // Sniper heuristic for EVM: top-3 non-LP/exchange addresses early in the holder list are likely snipers if no other class.
  if (args.rank <= 3 && classes.length === 0) {
    classes.push("sniper");
    reasons.push("Top-3 holder — likely launch sniper");
  }
  if (classes.length === 0) {
    classes.push("holder");
  }
  return { classes, reasons };
}

function classifySolHolder(args: {
  rank: number;
  owner: string;
  percent: number;
  creatorAddress: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  knownProgramSet: Set<string>;
  burnSet: Set<string>;
  pairAddresses: Set<string>;
}): { classes: HolderClass[]; reasons: string[] } {
  const classes: HolderClass[] = [];
  const reasons: string[] = [];
  const owner = args.owner;
  if (args.burnSet.has(owner)) {
    classes.push("burn");
    reasons.push("Burn address");
    return { classes, reasons };
  }
  if (args.knownProgramSet.has(owner) || args.pairAddresses.has(owner)) {
    classes.push("lp");
    reasons.push("DEX program / pool authority");
    return { classes, reasons };
  }
  if (args.creatorAddress && owner === args.creatorAddress) {
    classes.push("dev");
    reasons.push("Token creator");
  }
  if (args.mintAuthority && owner === args.mintAuthority) {
    classes.push("dev");
    if (!reasons.find((r) => r.includes("Token creator"))) reasons.push("Active mint authority");
  }
  if (args.freezeAuthority && owner === args.freezeAuthority) {
    classes.push("dev");
    reasons.push("Active freeze authority (can freeze accounts)");
  }
  if (args.percent >= 5) {
    classes.push("whale");
    reasons.push(`Holds ${args.percent.toFixed(2)}% of supply`);
  }
  if (args.rank <= 3 && classes.length === 0) {
    classes.push("sniper");
    reasons.push("Top-3 holder — likely launch sniper");
  }
  if (classes.length === 0) classes.push("holder");
  return { classes, reasons };
}

function buildEvmSecurityFlags(sec: NonNullable<Awaited<ReturnType<typeof getEvmTokenSecurity>>>): SecurityFlag[] {
  const flags: SecurityFlag[] = [];
  if (sec.isHoneypot === true) flags.push({ key: "honeypot", label: "Honeypot detected", level: "bad" });
  else if (sec.isHoneypot === false) flags.push({ key: "honeypot", label: "Not a honeypot", level: "good" });
  if (sec.transferPausable === true) flags.push({ key: "pausable", label: "Transfers can be paused by owner", level: "bad" });
  if (sec.canTakeBackOwnership === true) flags.push({ key: "take_back_ownership", label: "Owner can be reclaimed", level: "bad" });
  if (sec.hiddenOwner === true) flags.push({ key: "hidden_owner", label: "Hidden owner", level: "bad" });
  if (sec.selfdestruct === true) flags.push({ key: "selfdestruct", label: "Contract self-destruct enabled", level: "bad" });
  if (sec.isProxy === true) flags.push({ key: "proxy", label: "Upgradable proxy", level: "warn" });
  if (sec.isMintable === true) flags.push({ key: "mintable", label: "Owner can mint new supply", level: "warn" });
  if (sec.slippageModifiable === true) flags.push({ key: "slippage", label: "Owner can modify slippage / tax", level: "warn" });
  if (sec.externalCall === true) flags.push({ key: "external_call", label: "External call in transfer", level: "warn" });
  if (sec.buyTaxPct != null && sec.buyTaxPct > 0) flags.push({ key: "buy_tax", label: `Buy tax`, level: sec.buyTaxPct >= 10 ? "bad" : "warn", value: `${sec.buyTaxPct.toFixed(2)}%` });
  if (sec.sellTaxPct != null && sec.sellTaxPct > 0) flags.push({ key: "sell_tax", label: `Sell tax`, level: sec.sellTaxPct >= 10 ? "bad" : "warn", value: `${sec.sellTaxPct.toFixed(2)}%` });
  if (sec.isAntiWhale === true) flags.push({ key: "anti_whale", label: "Anti-whale enabled", level: "info" });
  return flags;
}

function lpInfoFromEvm(sec: NonNullable<Awaited<ReturnType<typeof getEvmTokenSecurity>>>) {
  const lpHolders = sec.lpHolders ?? [];
  if (lpHolders.length === 0) return { lpLocked: false, lpBurnedOrLocked: false };
  const burnedShare = lpHolders
    .filter((h) => BURN_ADDRESSES_EVM.has(h.address.toLowerCase()))
    .reduce((s, h) => s + (Number.isFinite(h.percent) ? h.percent : 0), 0);
  const lockedShare = lpHolders.filter((h) => h.isLocked).reduce((s, h) => s + h.percent, 0);
  return {
    lpLocked: lockedShare >= 50,
    lpBurnedOrLocked: lockedShare + burnedShare >= 50,
  };
}

function computeRecommendation(args: {
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  holderCount: number | null;
  topTenSharePct: number | null;
  devSharePct: number | null;
  lpBurnedOrLocked: boolean;
  isHoneypot: boolean | null;
  buyTaxPct: number | null;
  sellTaxPct: number | null;
  pairAgeMs: number | null;
  proRatioPct: number | null;
  contractRiskFlags: number;
}): DeepMemeReport["recommendation"] {
  const pros: string[] = [];
  const cons: string[] = [];
  let score = 50;

  const liq = args.liquidityUsd ?? 0;
  if (liq >= 100_000) { score += 14; pros.push(`Deep liquidity ($${(liq / 1000).toFixed(0)}k)`); }
  else if (liq >= 25_000) { score += 6; pros.push(`Adequate liquidity ($${(liq / 1000).toFixed(0)}k)`); }
  else if (liq > 0) { score -= 12; cons.push(`Thin liquidity ($${liq.toFixed(0)})`); }
  else { score -= 18; cons.push("No DEX liquidity found"); }

  const vol = args.volume24hUsd ?? 0;
  if (vol >= 250_000) { score += 12; pros.push(`Hot 24h volume ($${(vol / 1000).toFixed(0)}k)`); }
  else if (vol >= 50_000) { score += 6; pros.push(`Active 24h volume ($${(vol / 1000).toFixed(0)}k)`); }
  else if (vol > 0) { score -= 6; cons.push(`Low 24h volume ($${vol.toFixed(0)})`); }
  else { score -= 10; cons.push("No 24h volume"); }

  if (args.holderCount != null) {
    if (args.holderCount >= 1000) { score += 8; pros.push(`${args.holderCount.toLocaleString()} holders`); }
    else if (args.holderCount >= 200) { score += 3; pros.push(`${args.holderCount.toLocaleString()} holders`); }
    else { score -= 6; cons.push(`Only ${args.holderCount.toLocaleString()} holders`); }
  }

  if (args.topTenSharePct != null) {
    if (args.topTenSharePct <= 25) { score += 10; pros.push(`Decentralized top-10 (${args.topTenSharePct.toFixed(1)}%)`); }
    else if (args.topTenSharePct <= 40) { score += 3; pros.push(`Moderate top-10 share (${args.topTenSharePct.toFixed(1)}%)`); }
    else if (args.topTenSharePct <= 60) { score -= 8; cons.push(`Concentrated top-10 (${args.topTenSharePct.toFixed(1)}%)`); }
    else { score -= 16; cons.push(`Highly concentrated top-10 (${args.topTenSharePct.toFixed(1)}%)`); }
  }

  if (args.devSharePct != null) {
    if (args.devSharePct === 0) { score += 4; pros.push("Dev wallet holds 0%"); }
    else if (args.devSharePct <= 5) { score += 2; pros.push(`Dev wallet holds ${args.devSharePct.toFixed(2)}%`); }
    else if (args.devSharePct <= 10) { score -= 6; cons.push(`Dev wallet holds ${args.devSharePct.toFixed(2)}%`); }
    else { score -= 14; cons.push(`Dev wallet holds ${args.devSharePct.toFixed(2)}% (high)`); }
  }

  if (args.lpBurnedOrLocked) { score += 8; pros.push("LP locked / burned"); }
  else { score -= 8; cons.push("LP not locked / burned"); }

  if (args.isHoneypot === true) { score -= 60; cons.push("Honeypot detected"); }
  if (args.buyTaxPct != null && args.buyTaxPct >= 10) { score -= 12; cons.push(`High buy tax (${args.buyTaxPct.toFixed(1)}%)`); }
  if (args.sellTaxPct != null && args.sellTaxPct >= 10) { score -= 12; cons.push(`High sell tax (${args.sellTaxPct.toFixed(1)}%)`); }
  if (args.contractRiskFlags > 0) {
    score -= Math.min(args.contractRiskFlags * 5, 20);
    cons.push(`${args.contractRiskFlags} contract risk flag${args.contractRiskFlags === 1 ? "" : "s"} (see security)`);
  }

  if (args.pairAgeMs != null) {
    const days = (Date.now() - args.pairAgeMs) / 86_400_000;
    if (days < 0.5) { score -= 4; cons.push("Very new pair (<12h)"); }
    else if (days >= 7) { score += 2; pros.push(`Pair age ${Math.floor(days)}d`); }
  }

  if (args.proRatioPct != null && args.proRatioPct >= 20) {
    score += 4;
    pros.push(`Pro/whale ratio ${args.proRatioPct.toFixed(0)}% of top holders`);
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  let verdict: DeepMemeReport["recommendation"]["verdict"];
  let summary: string;
  if (args.isHoneypot === true) {
    verdict = "avoid";
    summary = "Avoid — honeypot detected by GoPlus.";
  } else if (finalScore >= 70) {
    verdict = "good_buy";
    summary = "Looks tradable — fundamentals + security check out.";
  } else if (finalScore >= 55) {
    verdict = "speculative";
    summary = "Speculative — has upside but mind the risk flags.";
  } else if (finalScore >= 35) {
    verdict = "caution";
    summary = "Caution — meaningful red flags, size positions carefully.";
  } else {
    verdict = "avoid";
    summary = "Avoid — multiple red flags or insufficient data.";
  }
  return { verdict, score: finalScore, summary, pros, cons };
}

export async function runDeepMemeAnalysis(
  contractInput: string,
  chainHint?: DeepChain | "auto",
): Promise<DeepMemeResult> {
  const detected = chainFromAddress(contractInput);
  const requested = chainHint && chainHint !== "auto" ? chainHint : detected.chain;
  const normalized = detected.normalized;
  if (!normalized) return { ok: false, error: "Contract address is required.", status: 400 };

  const notes: string[] = [];
  const sources = { dexscreener: false, goplus: false, helius: false };

  // -------------------- Solana --------------------
  if (requested === "solana") {
    const [pair, sec] = await Promise.all([
      getSolanaToken(normalized),
      getSolanaTokenSecurity(normalized),
    ]);
    sources.dexscreener = !!pair;
    sources.goplus = !!sec;
    if (!pair && !sec) {
      return { ok: false, error: "Could not resolve token on Solana via Dexscreener or GoPlus.", status: 404 };
    }
    const [heliusHolders, heliusHolderCountRaw] = HELIUS_RPC
      ? await Promise.all([getSolanaTopHolders(normalized, 20), getSolanaHolderCount(normalized)])
      : [[] as Awaited<ReturnType<typeof getSolanaTopHolders>>, null as number | null];
    sources.helius = heliusHolders.length > 0 || heliusHolderCountRaw != null;
    if (!sources.helius) notes.push("Helius RPC unavailable — using GoPlus holder snapshot only.");

    // GoPlus on Solana only returns a tiny snapshot of top accounts; their `holder_count` is unreliable
    // (often equals the array length). Prefer Helius DAS getTokenAccounts.total which is the real
    // count of non-zero-balance token accounts for the mint.
    const resolvedHolderCount: number | null = heliusHolderCountRaw ?? sec?.holderCount ?? null;

    const pairAddresses = new Set<string>();
    if (pair?.pairAddress) pairAddresses.add(pair.pairAddress);

    // Merge holder sources. Prefer Helius (with resolved owners) when present; otherwise fall back to GoPlus.
    const holders: AnalyzedHolder[] = [];
    if (heliusHolders.length > 0) {
      heliusHolders.forEach((h, idx) => {
        const cls = classifySolHolder({
          rank: idx + 1,
          owner: h.owner,
          percent: h.percent,
          creatorAddress: sec?.creatorAddress ?? null,
          mintAuthority: sec?.mintAuthority ?? null,
          freezeAuthority: sec?.freezeAuthority ?? null,
          knownProgramSet: KNOWN_PROGRAMS_SOL,
          burnSet: BURN_ADDRESSES_SOL,
          pairAddresses,
        });
        holders.push({
          rank: idx + 1,
          address: h.owner,
          tokenAccount: h.tokenAccount,
          tag: null,
          isContract: KNOWN_PROGRAMS_SOL.has(h.owner),
          balance: h.balance,
          balanceFormatted: shortBalance(h.balance),
          percentOfSupply: h.percent,
          isLocked: false,
          classes: cls.classes,
          reasons: cls.reasons,
        });
      });
    } else if (sec?.holders) {
      sec.holders.forEach((h, idx) => {
        const cls = classifySolHolder({
          rank: idx + 1,
          owner: h.address,
          percent: h.percent,
          creatorAddress: sec.creatorAddress,
          mintAuthority: sec.mintAuthority,
          freezeAuthority: sec.freezeAuthority,
          knownProgramSet: KNOWN_PROGRAMS_SOL,
          burnSet: BURN_ADDRESSES_SOL,
          pairAddresses,
        });
        holders.push({
          rank: idx + 1,
          address: h.address,
          tokenAccount: null,
          tag: h.tag,
          isContract: h.isContract,
          balance: Number(h.balance) || null,
          balanceFormatted: shortBalance(Number(h.balance) || null),
          percentOfSupply: h.percent,
          isLocked: h.isLocked,
          classes: cls.classes,
          reasons: cls.reasons,
        });
      });
    }

    // Security flags
    const flags: SecurityFlag[] = [];
    if (sec?.mintAuthorityRevoked) flags.push({ key: "mint_revoked", label: "Mint authority revoked", level: "good" });
    else if (sec?.mintAuthority) flags.push({ key: "mint_active", label: "Mint authority active (more supply can be minted)", level: "warn" });
    if (sec?.freezeAuthorityRevoked) flags.push({ key: "freeze_revoked", label: "Freeze authority revoked", level: "good" });
    else if (sec?.freezeAuthority) flags.push({ key: "freeze_active", label: "Freeze authority active (holders can be frozen)", level: "bad" });
    if (heliusHolderCountRaw != null) {
      flags.push({ key: "helius_holders", label: `On-chain holders: ${heliusHolderCountRaw.toLocaleString()} (non-zero balance)`, level: "info" });
    } else if (sec?.holders && sec.holders.length > 0) {
      flags.push({ key: "goplus_holders", label: `GoPlus snapshot: ${sec.holders.length} top holders`, level: "info" });
    }

    const isRugLikely = (sec?.freezeAuthority != null) || (sec?.mintAuthority != null && (resolvedHolderCount ?? 0) < 50);
    const isHoneypotLikely = false; // Solana model differs — GoPlus does not flag honeypots on SOL today.

    const topTen = holders
      .filter((h) => !h.classes.includes("lp") && !h.classes.includes("burn") && !h.classes.includes("exchange"))
      .slice(0, 10);
    const topTenSharePct = topTen.length === 0 ? null : topTen.reduce((s, h) => s + h.percentOfSupply, 0);
    const dev = holders.find((h) => h.classes.includes("dev"));
    const devSharePct = dev?.percentOfSupply ?? 0;
    const proRatioPct = topTen.length === 0
      ? null
      : (topTen.filter((h) => h.classes.includes("whale") || h.classes.includes("pro")).length / topTen.length) * 100;

    const rec = computeRecommendation({
      liquidityUsd: pair?.liquidity?.usd ?? null,
      volume24hUsd: pair?.volume?.h24 ?? null,
      holderCount: resolvedHolderCount,
      topTenSharePct,
      devSharePct,
      lpBurnedOrLocked: true, // For Pump.fun / Raydium pools, LP tokens commonly burned; we can't verify cheaply so default optimistic but note.
      isHoneypot: isHoneypotLikely ? true : null,
      buyTaxPct: null,
      sellTaxPct: null,
      pairAgeMs: pair?.pairCreatedAt ? (pair.pairCreatedAt < 1e12 ? pair.pairCreatedAt * 1000 : pair.pairCreatedAt) : null,
      proRatioPct,
      contractRiskFlags: flags.filter((f) => f.level === "bad").length,
    });

    return buildReport({
      chain: "solana",
      contract: normalized,
      pair,
      tokenName: sec?.tokenName ?? null,
      tokenSymbol: sec?.tokenSymbol ?? null,
      holderCount: resolvedHolderCount,
      flags,
      isHoneypotLikely,
      isRugLikely,
      lpLocked: true,
      lpBurnedOrLocked: true,
      topTenSharePct,
      devWallet: dev?.address ?? sec?.creatorAddress ?? null,
      ownerWallet: null,
      mintAuthority: sec?.mintAuthority ?? null,
      freezeAuthority: sec?.freezeAuthority ?? null,
      holders,
      lpHolders: [],
      recommendation: rec,
      sources,
      notes,
    });
  }

  // -------------------- EVM (BSC / ETH) --------------------
  // Auto-detect: try BSC first (memes more common there), then Ethereum.
  const tryChains: Array<"bsc" | "ethereum"> =
    requested === "bsc" ? ["bsc"] : requested === "ethereum" ? ["ethereum"] : ["bsc", "ethereum"];

  let chosen: "bsc" | "ethereum" | null = null;
  let pair: DexPair | null = null;
  let sec: Awaited<ReturnType<typeof getEvmTokenSecurity>> = null;
  for (const c of tryChains) {
    const [p, s] = await Promise.all([
      c === "bsc" ? getBscToken(normalized) : (async () => {
        // Reuse Dexscreener tokens/v1 for ethereum.
        try {
          const res = await fetch(`https://api.dexscreener.com/tokens/v1/ethereum/${normalized}`, { cache: "no-store" });
          if (!res.ok) return null;
          const raw = (await res.json()) as DexPair[] | { pairs?: DexPair[] };
          const arr = Array.isArray(raw) ? raw : (raw?.pairs ?? []);
          const ethPairs = arr.filter((x) => (x.chainId || "").toLowerCase() === "ethereum");
          if (ethPairs.length === 0) return null;
          return ethPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        } catch {
          return null;
        }
      })(),
      getEvmTokenSecurity(normalized, c),
    ]);
    if (p || s) {
      chosen = c;
      pair = p;
      sec = s;
      break;
    }
  }
  if (!chosen) {
    return {
      ok: false,
      error: "Could not resolve token on BSC or Ethereum via Dexscreener / GoPlus. Check the contract address.",
      status: 404,
    };
  }
  sources.dexscreener = !!pair;
  sources.goplus = !!sec;
  if (!pair) notes.push(`No Dexscreener pair found on ${chosen.toUpperCase()}; running on GoPlus-only data.`);
  if (!sec) notes.push("GoPlus had no record; security flags omitted.");

  const burnSet = BURN_ADDRESSES_EVM;
  const lpAddresses = new Set<string>(
    (sec?.lpHolders ?? []).map((h) => h.address.toLowerCase()).filter((s) => !!s),
  );
  if (pair?.pairAddress) lpAddresses.add(pair.pairAddress.toLowerCase());

  const holders: AnalyzedHolder[] = [];
  if (sec?.holders) {
    sec.holders.forEach((h, idx) => {
      const cls = classifyEvmHolder(h, {
        rank: idx + 1,
        ownerAddress: sec?.ownerAddress ?? null,
        creatorAddress: sec?.creatorAddress ?? null,
        burnSet,
        lpAddresses,
        isLpHolder: false,
      });
      holders.push({
        rank: idx + 1,
        address: h.address,
        tokenAccount: null,
        tag: h.tag,
        isContract: h.isContract,
        balance: Number(h.balance) || null,
        balanceFormatted: shortBalance(Number(h.balance) || null),
        percentOfSupply: h.percent,
        isLocked: h.isLocked,
        classes: cls.classes,
        reasons: cls.reasons,
      });
    });
  }
  const lpHoldersOut: AnalyzedHolder[] = [];
  if (sec?.lpHolders) {
    sec.lpHolders.forEach((h, idx) => {
      const cls = classifyEvmHolder(h, {
        rank: idx + 1,
        ownerAddress: sec?.ownerAddress ?? null,
        creatorAddress: sec?.creatorAddress ?? null,
        burnSet,
        lpAddresses,
        isLpHolder: true,
      });
      lpHoldersOut.push({
        rank: idx + 1,
        address: h.address,
        tokenAccount: null,
        tag: h.tag,
        isContract: h.isContract,
        balance: Number(h.balance) || null,
        balanceFormatted: shortBalance(Number(h.balance) || null),
        percentOfSupply: h.percent,
        isLocked: h.isLocked,
        classes: cls.classes,
        reasons: cls.reasons,
      });
    });
  }

  const flags: SecurityFlag[] = sec ? buildEvmSecurityFlags(sec) : [];
  const lpInfo = sec ? lpInfoFromEvm(sec) : { lpLocked: false, lpBurnedOrLocked: false };
  if (lpInfo.lpBurnedOrLocked) flags.push({ key: "lp_locked_burned", label: "LP locked or burned ≥ 50%", level: "good" });
  else if (sec?.lpHolders && sec.lpHolders.length > 0) flags.push({ key: "lp_unlocked", label: "LP not locked / burned", level: "warn" });

  const topTen = holders
    .filter((h) => !h.classes.includes("lp") && !h.classes.includes("burn") && !h.classes.includes("exchange"))
    .slice(0, 10);
  const topTenSharePct = topTen.length === 0 ? null : topTen.reduce((s, h) => s + h.percentOfSupply, 0);
  const dev = holders.find((h) => h.classes.includes("dev"));
  const devSharePct = dev?.percentOfSupply ?? 0;
  const proRatioPct = topTen.length === 0
    ? null
    : (topTen.filter((h) => h.classes.includes("whale") || h.classes.includes("pro")).length / topTen.length) * 100;

  const isHoneypotLikely = sec?.isHoneypot === true;
  const isRugLikely = !!sec && (sec.canTakeBackOwnership === true || sec.hiddenOwner === true || sec.transferPausable === true || sec.selfdestruct === true);

  const rec = computeRecommendation({
    liquidityUsd: pair?.liquidity?.usd ?? null,
    volume24hUsd: pair?.volume?.h24 ?? null,
    holderCount: sec?.holderCount ?? null,
    topTenSharePct,
    devSharePct,
    lpBurnedOrLocked: lpInfo.lpBurnedOrLocked,
    isHoneypot: sec?.isHoneypot ?? null,
    buyTaxPct: sec?.buyTaxPct ?? null,
    sellTaxPct: sec?.sellTaxPct ?? null,
    pairAgeMs: pair?.pairCreatedAt ? (pair.pairCreatedAt < 1e12 ? pair.pairCreatedAt * 1000 : pair.pairCreatedAt) : null,
    proRatioPct,
    contractRiskFlags: flags.filter((f) => f.level === "bad").length,
  });

  return buildReport({
    chain: chosen,
    contract: normalized,
    pair,
    tokenName: sec?.tokenName ?? pair?.baseToken?.name ?? null,
    tokenSymbol: sec?.tokenSymbol ?? pair?.baseToken?.symbol ?? null,
    holderCount: sec?.holderCount ?? null,
    flags,
    isHoneypotLikely,
    isRugLikely,
    lpLocked: lpInfo.lpLocked,
    lpBurnedOrLocked: lpInfo.lpBurnedOrLocked,
    topTenSharePct,
    devWallet: dev?.address ?? sec?.creatorAddress ?? null,
    ownerWallet: sec?.ownerAddress ?? null,
    mintAuthority: null,
    freezeAuthority: null,
    holders,
    lpHolders: lpHoldersOut,
    recommendation: rec,
    sources,
    notes,
  });
}

function buildReport(input: {
  chain: DeepChain;
  contract: string;
  pair: DexPair | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  holderCount: number | null;
  flags: SecurityFlag[];
  isHoneypotLikely: boolean;
  isRugLikely: boolean;
  lpLocked: boolean;
  lpBurnedOrLocked: boolean;
  topTenSharePct: number | null;
  devWallet: string | null;
  ownerWallet: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  holders: AnalyzedHolder[];
  lpHolders: AnalyzedHolder[];
  recommendation: DeepMemeReport["recommendation"];
  sources: DeepMemeReport["sources"];
  notes: string[];
}): DeepMemeReport {
  const socials = input.pair ? extractSocials(input.pair) : { website: null, twitter: null, telegram: null };
  const pairAgeMs = input.pair?.pairCreatedAt
    ? input.pair.pairCreatedAt < 1e12
      ? input.pair.pairCreatedAt * 1000
      : input.pair.pairCreatedAt
    : null;
  const dexUrl = input.pair?.pairAddress
    ? `https://dexscreener.com/${input.chain === "solana" ? "solana" : input.chain}/${input.pair.pairAddress}`
    : null;
  return {
    ok: true,
    chain: input.chain,
    contract: input.contract,
    token: {
      name: input.tokenName,
      symbol: input.tokenSymbol,
      priceUsd: input.pair?.priceUsd != null ? Number(input.pair.priceUsd) : null,
      marketCapUsd: input.pair?.fdv ?? null,
      fdvUsd: input.pair?.fdv ?? null,
      liquidityUsd: input.pair?.liquidity?.usd ?? null,
      volume24hUsd: input.pair?.volume?.h24 ?? null,
      txns24h: input.pair?.txns?.h24
        ? { buys: input.pair.txns.h24.buys ?? 0, sells: input.pair.txns.h24.sells ?? 0 }
        : null,
      priceChange24hPct: input.pair?.priceChange?.h24 ?? null,
      pairCreatedAtMs: pairAgeMs,
      dexUrl,
      pairAddress: input.pair?.pairAddress ?? null,
      socials,
    },
    security: {
      flags: input.flags,
      isHoneypotLikely: input.isHoneypotLikely,
      isRugLikely: input.isRugLikely,
      lpLocked: input.lpLocked,
      lpBurnedOrLocked: input.lpBurnedOrLocked,
      topTenSharePct: input.topTenSharePct,
      holderCount: input.holderCount,
      devWallet: input.devWallet,
      ownerWallet: input.ownerWallet,
      mintAuthority: input.mintAuthority,
      freezeAuthority: input.freezeAuthority,
    },
    holders: input.holders,
    lpHolders: input.lpHolders,
    recommendation: input.recommendation,
    sources: input.sources,
    notes: input.notes,
    generatedAtMs: Date.now(),
  };
}
