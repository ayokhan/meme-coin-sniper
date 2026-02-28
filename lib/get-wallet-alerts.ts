/**
 * Shared wallet-tracker logic: compute alerts (minBuyers+ tracked wallets bought same token).
 * Owner-only: first-buy alerts (notify once per wallet+token).
 */
import { prisma } from '@/lib/db';
import { getTrackedWallets, getAlertRules, getFirstBuyRules } from '@/lib/wallet-tracker-config';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getWalletTokenBuysFromBirdeye } from '@/lib/api-clients/birdeye';
import { getWalletBuySwapsFromMoralis } from '@/lib/api-clients/moralis';
import { getSolanaToken, type DexPair } from '@/lib/api-clients/dexscreener';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

/** Min viral score (0–100) for a wallet-tracker alert to be sent to Telegram. Alerts below this are not sent. */
export const MIN_VIRAL_SCORE_FOR_TELEGRAM = 60;

/** Simple 0–100 score from DexPair (liquidity + socials + age) for filtering Telegram wallet alerts. */
function simpleViralScoreFromDex(dex: DexPair | null): number {
  if (!dex) return 0;
  const liq = dex.liquidity?.usd ?? 0;
  const socials = dex.info?.socials ?? [];
  const websites = dex.info?.websites ?? [];
  const hasTwitter = socials.some((s) => (s.type ?? s.platform ?? '').toLowerCase().includes('twitter'));
  const hasTelegram = socials.some((s) => (s.type ?? s.platform ?? '').toLowerCase().includes('telegram'));
  const hasWebsite = websites.length > 0;
  const now = Date.now();
  const createdMs = dex.pairCreatedAt < 1e12 ? dex.pairCreatedAt * 1000 : dex.pairCreatedAt;
  const ageMinutes = (now - createdMs) / 60000;

  let liquidityScore = 0;
  if (liq >= 1_000_000) liquidityScore = 35;
  else if (liq >= 500_000) liquidityScore = 30;
  else if (liq >= 100_000) liquidityScore = 25;
  else if (liq >= 50_000) liquidityScore = 18;
  else if (liq >= 20_000) liquidityScore = 12;
  else if (liq >= 5_000) liquidityScore = 6;

  const socialScore = (hasWebsite ? 10 : 0) + (hasTwitter ? 15 : 0) + (hasTelegram ? 10 : 0);

  let timingScore = 0;
  if (ageMinutes >= 10 && ageMinutes <= 120) timingScore = 30;
  else if (ageMinutes >= 5 && ageMinutes <= 180) timingScore = 20;
  else if (ageMinutes <= 60) timingScore = 12;

  return Math.min(100, Math.round(liquidityScore + socialScore + timingScore));
}

const LIMIT_PER_WALLET = 30;

/** Get recent buys – Moralis first (if enabled), then Helius, then Birdeye. */
async function getBuysForWallet(
  address: string,
  limit: number,
  maxAgeMs: number,
  useMoralis: boolean
) {
  if (useMoralis) {
    const moralis = await getWalletBuySwapsFromMoralis(address, limit, maxAgeMs);
    if (moralis.length > 0) return moralis;
  }
  const helius = await getRecentTokenBuysForWallet(address, limit, maxAgeMs);
  if (helius.length > 0) return helius;
  return getWalletTokenBuysFromBirdeye(address, limit, maxAgeMs);
}

export type WalletAlert = {
  contractAddress: string;
  symbol: string;
  name: string;
  buyerCount: number;
  buyers: Array<{ address: string; label?: string }>;
  liquidity?: number | null;
  priceUSD?: number | null;
  /** Latest buy timestamp (ms) among the tracked wallets for this token */
  latestBuyAt?: number | null;
  /** Simple 0–100 score from liquidity + socials + age; used to filter Telegram alerts (e.g. only send if > 60). */
  viralScore?: number;
};

export async function getWalletAlerts(): Promise<WalletAlert[]> {
  const [trackedWallets, rules, moralisWalletTracker] = await Promise.all([
    getTrackedWallets(),
    getAlertRules(),
    getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_WALLET_TRACKER),
  ]);
  if (trackedWallets.length === 0) return [];

  const hasMoralis = moralisWalletTracker && Boolean(process.env.MORALIS_API_KEY);
  const hasHelius = Boolean(process.env.HELIUS_API_KEY);
  const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
  if (!hasMoralis && !hasHelius && !hasBirdeye) return [];

  const MAX_AGE_MS = rules.maxAgeHours * 60 * 60 * 1000;
  const mintToWallets: Record<string, Set<string>> = {};
  const mintToLatestBuy: Record<string, number> = {};
  for (const w of trackedWallets) {
    const buys = await getBuysForWallet(w.address, LIMIT_PER_WALLET, MAX_AGE_MS, hasMoralis);
    for (const b of buys) {
      if (!mintToWallets[b.mint]) mintToWallets[b.mint] = new Set();
      mintToWallets[b.mint].add(w.address);
      const ts = b.timestamp ?? 0;
      if (ts) mintToLatestBuy[b.mint] = Math.max(mintToLatestBuy[b.mint] ?? 0, ts);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const alertMints = Object.entries(mintToWallets)
    .filter(([, wallets]) => wallets.size >= rules.minBuyers)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, rules.maxAlerts);

  const alerts: WalletAlert[] = [];
  for (const [mint, walletSet] of alertMints) {
    const buyers = Array.from(walletSet).map((addr) => {
      const w = trackedWallets.find((x) => x.address === addr);
      return { address: addr, label: w?.label ?? undefined };
    });
    const dex = await getSolanaToken(mint);
    const viralScore = simpleViralScoreFromDex(dex ?? null);
    alerts.push({
      contractAddress: mint,
      symbol: dex?.baseToken?.symbol ?? '—',
      name: dex?.baseToken?.name ?? '—',
      buyerCount: buyers.length,
      buyers,
      liquidity: dex?.liquidity?.usd ?? null,
      priceUSD: dex?.priceUsd ? parseFloat(dex.priceUsd) : null,
      latestBuyAt: mintToLatestBuy[mint] ?? null,
      viralScore,
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  return alerts;
}

/** Process user meme coin wallets (Solana only): detect first buys and write to UserMemeCoinAlert (in-app). */
export async function processUserMemeCoinFirstBuys(): Promise<number> {
  const [userWallets, rules, moralisWalletTracker] = await Promise.all([
    (prisma as any).userMemeCoinWallet.findMany({ where: { chain: "solana" } }),
    getFirstBuyRules(),
    getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_WALLET_TRACKER),
  ]);
  const wallets = userWallets.map((w: { userId: string; address: string; label: string | null }) => ({ userId: w.userId, address: w.address, label: w.label }));
  if (wallets.length === 0) return 0;

  const hasMoralis = moralisWalletTracker && Boolean(process.env.MORALIS_API_KEY);
  const hasHelius = Boolean(process.env.HELIUS_API_KEY);
  const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
  if (!hasMoralis && !hasHelius && !hasBirdeye) return 0;

  const lookbackMs = rules.lookbackMinutes * 60 * 1000;
  const existing = await (prisma as any).userMemeCoinAlert.findMany({
    select: { userId: true, walletAddress: true, contractAddress: true },
  });
  const sentSet = new Set(existing.map((r: { userId: string; walletAddress: string; contractAddress: string }) => `${r.userId}:${r.walletAddress}:${r.contractAddress}`));

  let created = 0;
  for (const w of wallets) {
    const buys = await getBuysForWallet(w.address, LIMIT_PER_WALLET, lookbackMs, hasMoralis);
    for (const b of buys) {
      const key = `${w.userId}:${w.address}:${b.mint}`;
      if (sentSet.has(key)) continue;
      sentSet.add(key);
      const dex = await getSolanaToken(b.mint);
      const symbol = dex?.baseToken?.symbol ?? "—";
      try {
        await (prisma as any).userMemeCoinAlert.create({
          data: { userId: w.userId, walletAddress: w.address, contractAddress: b.mint, symbol },
        });
        created++;
      } catch (err: unknown) {
        const isDup = err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
        if (!isDup) throw err;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return created;
}

/** Owner-only: first time a tracked wallet bought a token (one alert per wallet+token ever). */
export type FirstBuyAlert = {
  walletAddress: string;
  walletLabel?: string;
  contractAddress: string;
  symbol: string;
  name: string;
  liquidity?: number | null;
  priceUSD?: number | null;
  firstBuyAt: number;
};

export async function getFirstBuyAlerts(): Promise<FirstBuyAlert[]> {
  const [allWallets, rules, moralisWalletTracker] = await Promise.all([
    getTrackedWallets(),
    getFirstBuyRules(),
    getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_WALLET_TRACKER),
  ]);
  // Only wallets with firstBuyEnabled get first-buy alerts (default true when not set)
  const trackedWallets = allWallets.filter((w) => w.firstBuyEnabled !== false);
  if (trackedWallets.length === 0) return [];

  const hasMoralis = moralisWalletTracker && Boolean(process.env.MORALIS_API_KEY);
  const hasHelius = Boolean(process.env.HELIUS_API_KEY);
  const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
  if (!hasMoralis && !hasHelius && !hasBirdeye) return [];

  const lookbackMs = rules.lookbackMinutes * 60 * 1000;
  const sentSet = new Set<string>();
  const db = prisma as unknown as {
    walletFirstBuyAlertSent?: {
      findMany: (args: { select: { walletAddress: true; contractAddress: true } }) => Promise<Array<{ walletAddress: string; contractAddress: string }>>;
    };
  };
  if (db.walletFirstBuyAlertSent) {
    const rows = await db.walletFirstBuyAlertSent.findMany({
      select: { walletAddress: true, contractAddress: true },
    });
    rows.forEach((r) => sentSet.add(`${r.walletAddress}:${r.contractAddress}`));
  }

  const candidates: Array<{ walletAddress: string; walletLabel?: string; contractAddress: string; firstBuyAt: number }> = [];
  for (const w of trackedWallets) {
    const buys = await getBuysForWallet(w.address, LIMIT_PER_WALLET, lookbackMs, hasMoralis);
    for (const b of buys) {
      const key = `${w.address}:${b.mint}`;
      if (sentSet.has(key)) continue;
      sentSet.add(key);
      candidates.push({
        walletAddress: w.address,
        walletLabel: w.label ?? undefined,
        contractAddress: b.mint,
        firstBuyAt: b.timestamp ?? Date.now(),
      });
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  candidates.sort((a, b) => b.firstBuyAt - a.firstBuyAt);
  const toReturn = candidates.slice(0, rules.maxAlerts);
  const alerts: FirstBuyAlert[] = [];
  for (const c of toReturn) {
    const dex = await getSolanaToken(c.contractAddress);
    alerts.push({
      walletAddress: c.walletAddress,
      walletLabel: c.walletLabel,
      contractAddress: c.contractAddress,
      symbol: dex?.baseToken?.symbol ?? '—',
      name: dex?.baseToken?.name ?? '—',
      liquidity: dex?.liquidity?.usd ?? null,
      priceUSD: dex?.priceUsd ? parseFloat(dex.priceUsd) : null,
      firstBuyAt: c.firstBuyAt,
    });
    await new Promise((r) => setTimeout(r, 150));
  }
  return alerts;
}
