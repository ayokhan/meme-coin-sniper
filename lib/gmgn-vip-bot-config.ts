import { prisma } from "@/lib/db";
import { decryptField, encryptField, maskSecret } from "@/lib/field-encryption";
import { resolveServerGmgnCredentials, type GmgnChain, type GmgnCredentials } from "@/lib/gmgn-client";
import { isGmgnProxyConfigured } from "@/lib/gmgn-fetch";
import { normalizeGmgnPrivateKeyPem, validateGmgnPrivateKey } from "@/lib/gmgn-private-key";
import { GMGN_BOT_DEFAULTS, parseWalletAddresses, resolveWalletForChain } from "@/lib/gmgn-vip-bot-rules";
import { isOwnerSession } from "@/lib/auth";
import type { Session } from "next-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type GmgnTradingMode = "semi_auto" | "auto";

const DEFAULT_CHAINS: GmgnChain[] = ["sol", "bsc", "robinhood"];

export type GmgnVipBotConfigView = {
  enabled: boolean;
  ownerForceOff: boolean;
  tradingMode: GmgnTradingMode;
  chains: GmgnChain[];
  maxTradeUsd: number;
  maxDailyLossUsd: number;
  maxOpenTrades: number;
  minLiquidityUsd: number;
  minMomentum1hPct: number;
  slippagePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  walletAddress: string | null;
  walletAddresses: string[];
  hasCredentials: boolean;
  credentialsFromServer: boolean;
  /** True when a GMGN private key is available for swap signing. */
  hasTradeSigningKey: boolean;
  /** Server routes GMGN trades through a fixed-egress proxy when configured. */
  gmgnProxyConfigured: boolean;
  apiKeyMask: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};

function parseChains(raw: unknown): GmgnChain[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CHAINS];
  const allowed = new Set<GmgnChain>(["sol", "bsc", "robinhood", "eth", "base"]);
  const out: GmgnChain[] = [];
  for (const c of raw) {
    if (typeof c === "string" && allowed.has(c as GmgnChain) && !out.includes(c as GmgnChain)) {
      out.push(c as GmgnChain);
    }
  }
  return out.length ? out : [...DEFAULT_CHAINS];
}

function toView(row: Record<string, unknown>): GmgnVipBotConfigView {
  const ownerForceOff = !!row.ownerForceOff;
  const apiKey = decryptField(row.gmgnApiKeyEnc as string | null);
  const serverCreds = resolveServerGmgnCredentials();
  const hasUserKey = !!apiKey;
  const hasCredentials = hasUserKey || !!serverCreds?.apiKey;
  const userPrivateKey = decryptField(row.gmgnPrivateKeyEnc as string | null);
  const serverPrivateKey = serverCreds?.privateKey ?? null;
  const validUserPrivate = userPrivateKey ? validateGmgnPrivateKey(userPrivateKey) : null;
  const validServerPrivate =
    serverPrivateKey && validateGmgnPrivateKey(serverPrivateKey).ok ? serverPrivateKey : null;
  const hasTradeSigningKey = !!(validUserPrivate?.ok || validServerPrivate);
  const walletAddresses = parseWalletAddresses(row.walletAddresses, (row.walletAddress as string | null) ?? null);
  return {
    enabled: !!row.enabled && !ownerForceOff,
    ownerForceOff,
    tradingMode: row.tradingMode === "auto" ? "auto" : "semi_auto",
    chains: parseChains(row.chains),
    maxTradeUsd: Number(row.maxTradeUsd) || GMGN_BOT_DEFAULTS.maxTradeUsd,
    maxDailyLossUsd: Number(row.maxDailyLossUsd) || GMGN_BOT_DEFAULTS.maxDailyLossUsd,
    maxOpenTrades: Math.max(1, Math.min(10, Number(row.maxOpenTrades) || GMGN_BOT_DEFAULTS.maxOpenTrades)),
    minLiquidityUsd: Number(row.minLiquidityUsd) || GMGN_BOT_DEFAULTS.minLiquidityUsd,
    minMomentum1hPct: Number(row.minMomentum1hPct) || GMGN_BOT_DEFAULTS.minMomentum1hPct,
    slippagePct: Number(row.slippagePct) || GMGN_BOT_DEFAULTS.slippagePct,
    stopLossPct: Number(row.stopLossPct) || GMGN_BOT_DEFAULTS.stopLossPct,
    takeProfitPct: Number(row.takeProfitPct) || GMGN_BOT_DEFAULTS.takeProfitPct,
    walletAddresses,
    walletAddress:
      resolveWalletForChain("sol", walletAddresses) ??
      resolveWalletForChain("bsc", walletAddresses) ??
      walletAddresses[0] ??
      (row.walletAddress as string | null) ??
      null,
    hasCredentials,
    credentialsFromServer: hasCredentials && !hasUserKey,
    hasTradeSigningKey,
    gmgnProxyConfigured: isGmgnProxyConfigured(),
    apiKeyMask: maskSecret(apiKey),
    lastRunAt: row.lastRunAt ? (row.lastRunAt as Date).toISOString() : null,
    lastError: (row.lastError as string | null) ?? null,
  };
}

export async function ensureGmgnVipBotConfig(userId: string) {
  let row = await db.gmgnVipBotUserConfig.findUnique({ where: { userId } });
  if (!row) {
    row = await db.gmgnVipBotUserConfig.create({ data: { userId } });
  }
  return row;
}

export async function getGmgnVipBotConfigView(userId: string): Promise<GmgnVipBotConfigView> {
  const row = await ensureGmgnVipBotConfig(userId);
  return toView(row);
}

export async function resolveUserGmgnCredentials(
  userId: string,
  session: Session | null
): Promise<GmgnCredentials | null> {
  const row = await ensureGmgnVipBotConfig(userId);
  const userApiKey = decryptField(row.gmgnApiKeyEnc);
  const userPrivateRaw = decryptField(row.gmgnPrivateKeyEnc);
  const userPrivateCheck = userPrivateRaw ? validateGmgnPrivateKey(userPrivateRaw) : null;
  const userPrivateKey = userPrivateCheck?.ok ? userPrivateCheck.pem : undefined;

  const server = resolveServerGmgnCredentials();
  const serverPrivateCheck = server?.privateKey ? validateGmgnPrivateKey(server.privateKey) : null;
  const serverPrivateKey = serverPrivateCheck?.ok ? serverPrivateCheck.pem : undefined;

  if (isOwnerSession(session) && server?.apiKey) {
    return {
      apiKey: server.apiKey,
      privateKey: userPrivateKey ?? serverPrivateKey,
    };
  }

  if (userApiKey) {
    return { apiKey: userApiKey, privateKey: userPrivateKey };
  }

  if (server?.apiKey) {
    return { apiKey: server.apiKey, privateKey: serverPrivateKey };
  }

  return null;
}

export async function updateGmgnVipBotConfig(
  userId: string,
  patch: Partial<{
    enabled: boolean;
    tradingMode: GmgnTradingMode;
    chains: GmgnChain[];
    maxTradeUsd: number;
    maxDailyLossUsd: number;
    maxOpenTrades: number;
    minLiquidityUsd: number;
    minMomentum1hPct: number;
    slippagePct: number;
    stopLossPct: number;
    takeProfitPct: number;
    walletAddress: string | null;
    walletAddresses: string[];
    gmgnApiKey: string | null;
    gmgnPrivateKey: string | null;
    clearCredentials: boolean;
  }>
) {
  const row = await ensureGmgnVipBotConfig(userId);
  const data: Record<string, unknown> = {};

  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.tradingMode !== undefined) data.tradingMode = patch.tradingMode;
  if (patch.chains !== undefined) data.chains = patch.chains;
  if (patch.maxTradeUsd !== undefined) data.maxTradeUsd = patch.maxTradeUsd;
  if (patch.maxDailyLossUsd !== undefined) data.maxDailyLossUsd = patch.maxDailyLossUsd;
  if (patch.maxOpenTrades !== undefined) data.maxOpenTrades = patch.maxOpenTrades;
  if (patch.minLiquidityUsd !== undefined) data.minLiquidityUsd = patch.minLiquidityUsd;
  if (patch.minMomentum1hPct !== undefined) data.minMomentum1hPct = patch.minMomentum1hPct;
  if (patch.slippagePct !== undefined) data.slippagePct = patch.slippagePct;
  if (patch.stopLossPct !== undefined) data.stopLossPct = patch.stopLossPct;
  if (patch.takeProfitPct !== undefined) data.takeProfitPct = patch.takeProfitPct;
  if (patch.walletAddresses !== undefined) {
    const list = patch.walletAddresses.map((w) => w.trim()).filter(Boolean);
    data.walletAddresses = list;
    data.walletAddress = list[0] ?? null;
  } else if (patch.walletAddress !== undefined) {
    const one = patch.walletAddress?.trim() || null;
    data.walletAddress = one;
    data.walletAddresses = one ? [one] : [];
  }

  if (patch.clearCredentials) {
    data.gmgnApiKeyEnc = null;
    data.gmgnPrivateKeyEnc = null;
  } else {
    if (patch.gmgnApiKey?.trim()) data.gmgnApiKeyEnc = encryptField(patch.gmgnApiKey.trim());
    if (patch.gmgnPrivateKey?.trim()) {
      const keyCheck = validateGmgnPrivateKey(patch.gmgnPrivateKey.trim());
      if (!keyCheck.ok) throw new Error(keyCheck.error);
      data.gmgnPrivateKeyEnc = encryptField(keyCheck.pem);
    }
  }

  const updated = await db.gmgnVipBotUserConfig.update({ where: { id: row.id }, data });
  return toView(updated);
}

export async function touchGmgnBotRun(userId: string, error: string | null) {
  await db.gmgnVipBotUserConfig.update({
    where: { userId },
    data: { lastRunAt: new Date(), lastError: error },
  });
}
