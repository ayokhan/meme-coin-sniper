import { prisma } from "@/lib/db";
import {
  fetchGmgnTrending,
  type GmgnChain,
  type GmgnCredentials,
  type GmgnTrendingToken,
} from "@/lib/gmgn-client";
import { touchGmgnBotRun } from "@/lib/gmgn-vip-bot-config";
import { GMGN_BOT_DEFAULTS } from "@/lib/gmgn-vip-bot-rules";
import { tokenContractAddress, tokenLiquidityUsd, tokenMomentum1h } from "@/lib/gmgn-token-metrics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type GmgnScanChainSummary = {
  chain: GmgnChain;
  fetched: number;
  passed: number;
  filteredLiquidity: number;
  filteredMomentum: number;
  duplicates: number;
  created: number;
  error?: string;
};

export type GmgnScanResult = {
  created: number;
  scanned: number;
  filtered: number;
  duplicates: number;
  openSlots: number;
  message: string;
  chains: GmgnScanChainSummary[];
  error?: string;
};

function tokenAddress(t: GmgnTrendingToken): string | null {
  return tokenContractAddress(t);
}

function pickSymbol(t: GmgnTrendingToken): string {
  return (t.symbol ?? "???").slice(0, 16);
}

function pickName(t: GmgnTrendingToken): string {
  return (t.name ?? t.symbol ?? "Token").slice(0, 64);
}

function buildScanMessage(
  result: Omit<GmgnScanResult, "message"> & { minLiquidityUsd: number; minMomentum1hPct: number }
): string {
  if (result.error) return result.error;
  if (result.openSlots <= 0) {
    return "No open signal slots. Raise max open trades or approve/reject pending signals.";
  }
  if (result.created > 0) {
    return `Created ${result.created} signal${result.created === 1 ? "" : "s"} from ${result.scanned} trending tokens.`;
  }
  if (result.scanned === 0) {
    const emptyChains = result.chains.filter((c) => !c.error && c.fetched === 0).map((c) => c.chain);
    if (emptyChains.length) {
      return `GMGN returned no trending tokens for ${emptyChains.join(", ")}. Try Solana/BSC or scan again later.`;
    }
    const errChain = result.chains.find((c) => c.error);
    if (errChain?.error) return errChain.error;
    return "No trending tokens returned from GMGN.";
  }
  const chainBits = result.chains
    .filter((c) => c.fetched > 0 || c.error)
    .map((c) =>
      c.error
        ? `${c.chain}: error`
        : `${c.chain}: ${c.fetched} scanned, ${c.created} new`
    );
  const chainSuffix = chainBits.length ? ` (${chainBits.join(" · ")})` : "";
  return `Checked ${result.scanned} tokens — 0 matched filters (${result.filtered} filtered out, ${result.duplicates} recent duplicates)${chainSuffix}. Try lowering min liquidity (now $${result.minLiquidityUsd.toLocaleString()}) or min 1h momentum (now +${result.minMomentum1hPct}%).`;
}

export async function scanGmgnVipBot(params: {
  userId: string;
  creds: GmgnCredentials;
  chains: GmgnChain[];
  maxOpenTrades: number;
  minLiquidityUsd: number;
  minMomentum1hPct: number;
}): Promise<GmgnScanResult> {
  const openCount = await db.gmgnVipBotSignal.count({
    where: { userId: params.userId, status: { in: ["pending", "approved"] } },
  });
  const openSlots = Math.max(0, params.maxOpenTrades - openCount);

  let created = 0;
  let scanned = 0;
  let filtered = 0;
  let duplicates = 0;
  const chains: GmgnScanChainSummary[] = [];
  const minLiq = Math.max(0, params.minLiquidityUsd);
  const minMom = params.minMomentum1hPct;

  if (openSlots <= 0) {
    const base = { created: 0, scanned: 0, filtered: 0, duplicates: 0, openSlots: 0, chains };
    const msg = buildScanMessage({ ...base, minLiquidityUsd: minLiq, minMomentum1hPct: minMom });
    await touchGmgnBotRun(params.userId, msg);
    return { ...base, message: msg };
  }

  if (!params.chains.length) {
    const base = { created: 0, scanned: 0, filtered: 0, duplicates: 0, openSlots, chains };
    return {
      ...base,
      error: "Select at least one chain to scan.",
      message: "Select at least one chain to scan.",
    };
  }

  for (const chain of params.chains) {
    if (created >= openSlots) break;
    const summary: GmgnScanChainSummary = {
      chain,
      fetched: 0,
      passed: 0,
      filteredLiquidity: 0,
      filteredMomentum: 0,
      duplicates: 0,
      created: 0,
    };
    chains.push(summary);

    try {
      const trending = await fetchGmgnTrending(chain, params.creds, GMGN_BOT_DEFAULTS.trendingLimit);
      summary.fetched = trending.length;

      for (const tok of trending) {
        if (created >= openSlots) break;
        scanned += 1;
        const addr = tokenAddress(tok);
        if (!addr) continue;

        const liq = tokenLiquidityUsd(tok);
        const mom = tokenMomentum1h(tok);
        if (liq > 0 && liq < minLiq) {
          filtered += 1;
          summary.filteredLiquidity += 1;
          continue;
        }
        if (mom.known && mom.value < minMom) {
          filtered += 1;
          summary.filteredMomentum += 1;
          continue;
        }

        const dup = await db.gmgnVipBotSignal.findFirst({
          where: {
            userId: params.userId,
            tokenAddress: addr,
            chain,
            createdAt: { gte: new Date(Date.now() - GMGN_BOT_DEFAULTS.dedupeHours * 60 * 60 * 1000) },
          },
        });
        if (dup) {
          duplicates += 1;
          summary.duplicates += 1;
          continue;
        }

        summary.passed += 1;
        const ch1h = mom.known ? mom.value : 0;
        await db.gmgnVipBotSignal.create({
          data: {
            userId: params.userId,
            chain,
            tokenAddress: addr,
            symbol: pickSymbol(tok),
            name: pickName(tok),
            action: "buy",
            status: "pending",
            reason: mom.known
              ? `GMGN 1h trending +${ch1h.toFixed(1)}%${liq ? ` · liq $${Math.round(liq).toLocaleString()}` : ""}`
              : `GMGN 1h trending${liq ? ` · liq $${Math.round(liq).toLocaleString()}` : ""}`,
          },
        });
        created += 1;
        summary.created += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      summary.error = msg;
      await touchGmgnBotRun(params.userId, msg);
      const base = { created, scanned, filtered, duplicates, openSlots, chains, error: msg };
      return {
        ...base,
        message: buildScanMessage({ ...base, minLiquidityUsd: minLiq, minMomentum1hPct: minMom }),
      };
    }
  }

  const base = { created, scanned, filtered, duplicates, openSlots, chains };
  const message = buildScanMessage({ ...base, minLiquidityUsd: minLiq, minMomentum1hPct: minMom });
  await touchGmgnBotRun(params.userId, message);
  return { ...base, message };
}
