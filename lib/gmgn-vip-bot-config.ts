import { prisma } from "@/lib/db";
import { decryptField, encryptField, maskSecret } from "@/lib/field-encryption";
import { resolveServerGmgnCredentials, type GmgnChain, type GmgnCredentials } from "@/lib/gmgn-client";
import { isOwnerSession } from "@/lib/auth";
import type { Session } from "next-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type GmgnTradingMode = "semi_auto" | "auto";

export type GmgnVipBotConfigView = {
  enabled: boolean;
  ownerForceOff: boolean;
  tradingMode: GmgnTradingMode;
  chains: GmgnChain[];
  maxTradeUsd: number;
  maxDailyLossUsd: number;
  maxOpenTrades: number;
  slippagePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  walletAddress: string | null;
  hasCredentials: boolean;
  apiKeyMask: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};

const DEFAULT_CHAINS: GmgnChain[] = ["sol", "bsc", "robinhood"];

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
  return {
    enabled: !!row.enabled && !ownerForceOff,
    ownerForceOff,
    tradingMode: row.tradingMode === "auto" ? "auto" : "semi_auto",
    chains: parseChains(row.chains),
    maxTradeUsd: Number(row.maxTradeUsd) || 25,
    maxDailyLossUsd: Number(row.maxDailyLossUsd) || 100,
    maxOpenTrades: Math.max(1, Math.min(10, Number(row.maxOpenTrades) || 3)),
    slippagePct: Number(row.slippagePct) || 15,
    stopLossPct: Number(row.stopLossPct) || 20,
    takeProfitPct: Number(row.takeProfitPct) || 50,
    walletAddress: (row.walletAddress as string | null) ?? null,
    hasCredentials: !!(apiKey || resolveServerGmgnCredentials()?.apiKey),
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
  if (isOwnerSession(session)) {
    const server = resolveServerGmgnCredentials();
    if (server) return server;
  }
  const row = await ensureGmgnVipBotConfig(userId);
  const apiKey = decryptField(row.gmgnApiKeyEnc);
  if (!apiKey) {
    return resolveServerGmgnCredentials();
  }
  const privateKey = decryptField(row.gmgnPrivateKeyEnc) ?? undefined;
  return { apiKey, privateKey };
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
    slippagePct: number;
    stopLossPct: number;
    takeProfitPct: number;
    walletAddress: string | null;
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
  if (patch.slippagePct !== undefined) data.slippagePct = patch.slippagePct;
  if (patch.stopLossPct !== undefined) data.stopLossPct = patch.stopLossPct;
  if (patch.takeProfitPct !== undefined) data.takeProfitPct = patch.takeProfitPct;
  if (patch.walletAddress !== undefined) data.walletAddress = patch.walletAddress?.trim() || null;

  if (patch.clearCredentials) {
    data.gmgnApiKeyEnc = null;
    data.gmgnPrivateKeyEnc = null;
  } else {
    if (patch.gmgnApiKey?.trim()) data.gmgnApiKeyEnc = encryptField(patch.gmgnApiKey.trim());
    if (patch.gmgnPrivateKey?.trim()) data.gmgnPrivateKeyEnc = encryptField(patch.gmgnPrivateKey.trim());
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
