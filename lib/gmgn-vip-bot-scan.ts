import { prisma } from "@/lib/db";
import {
  fetchGmgnTrending,
  type GmgnChain,
  type GmgnCredentials,
  type GmgnTrendingToken,
} from "@/lib/gmgn-client";
import { touchGmgnBotRun } from "@/lib/gmgn-vip-bot-config";
import { GMGN_BOT_DEFAULTS } from "@/lib/gmgn-vip-bot-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function tokenAddress(t: GmgnTrendingToken): string | null {
  const addr = (t.address ?? t.token_address ?? "").trim();
  return addr || null;
}

function pickSymbol(t: GmgnTrendingToken): string {
  return (t.symbol ?? "???").slice(0, 16);
}

function pickName(t: GmgnTrendingToken): string {
  return (t.name ?? t.symbol ?? "Token").slice(0, 64);
}

export async function scanGmgnVipBot(params: {
  userId: string;
  creds: GmgnCredentials;
  chains: GmgnChain[];
  maxOpenTrades: number;
  minLiquidityUsd: number;
  minMomentum1hPct: number;
}): Promise<{ created: number; scanned: number; error?: string }> {
  const openCount = await db.gmgnVipBotSignal.count({
    where: { userId: params.userId, status: { in: ["pending", "approved"] } },
  });
  const slots = Math.max(0, params.maxOpenTrades - openCount);
  if (slots <= 0) {
    await touchGmgnBotRun(params.userId, null);
    return { created: 0, scanned: 0 };
  }

  let created = 0;
  let scanned = 0;

  const minLiq = Math.max(0, params.minLiquidityUsd);
  const minMom = params.minMomentum1hPct;

  for (const chain of params.chains) {
    if (created >= slots) break;
    try {
      const trending = await fetchGmgnTrending(chain, params.creds, GMGN_BOT_DEFAULTS.trendingLimit);
      for (const tok of trending) {
        if (created >= slots) break;
        scanned += 1;
        const addr = tokenAddress(tok);
        if (!addr) continue;

        const liq = Number(tok.liquidity ?? 0);
        const ch1h = Number(tok.price_change_percent1h ?? tok.price_change_percent ?? 0);
        if (liq > 0 && liq < minLiq) continue;
        if (ch1h < minMom) continue;

        const dup = await db.gmgnVipBotSignal.findFirst({
          where: {
            userId: params.userId,
            tokenAddress: addr,
            chain,
            createdAt: { gte: new Date(Date.now() - GMGN_BOT_DEFAULTS.dedupeHours * 60 * 60 * 1000) },
          },
        });
        if (dup) continue;

        await db.gmgnVipBotSignal.create({
          data: {
            userId: params.userId,
            chain,
            tokenAddress: addr,
            symbol: pickSymbol(tok),
            name: pickName(tok),
            action: "buy",
            status: "pending",
            reason: `GMGN 1h trending +${ch1h.toFixed(1)}%${liq ? ` · liq $${Math.round(liq).toLocaleString()}` : ""}`,
          },
        });
        created += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      await touchGmgnBotRun(params.userId, msg);
      return { created, scanned, error: msg };
    }
  }

  await touchGmgnBotRun(params.userId, null);
  return { created, scanned };
}
