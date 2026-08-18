import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { getTopTradersPositions, getLastFillTimeMs, getUserFills } from "@/lib/api-clients/hyperliquid";
import type { HyperliquidPosition, TopTraderState } from "@/lib/api-clients/hyperliquid";
import { leverageDb } from "@/lib/leverage-db";
import { prisma } from "@/lib/db";

const APEXLIQUID_DETAIL_URL = "https://apexliquid.bot/trade/detail";
const APEXLIQUID_TOP_TRADES_API = "https://apexliquid.bot/v1/web/top_trades";

type InferredPosition = {
  coin: string;
  side: "long" | "short";
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  openedAtMs?: number;
};

/**
 * Infer open xyz:* positions from fills (matches Top Leverage Traders route).
 */
export function inferOpenXyzPositionsFromFills(
  fills: Array<{ coin: string; dir: string; sz: string; px: string }>
): InferredPosition[] {
  const byCoin = new Map<string, { net: number; lastPx: number }>();
  for (const f of fills) {
    const coin = (f.coin ?? "").trim();
    if (!coin || !coin.toLowerCase().startsWith("xyz:")) continue;
    const dir = (f.dir ?? "").toLowerCase();
    const sz = Number(f.sz ?? "0");
    const px = Number(f.px ?? "0");
    if (!Number.isFinite(sz) || sz <= 0) continue;
    const row = byCoin.get(coin) ?? { net: 0, lastPx: Number.isFinite(px) && px > 0 ? px : 0 };

    if (dir.startsWith("open long") || dir.startsWith("add long")) row.net += sz;
    else if (dir.startsWith("close long") || dir.startsWith("reduce long")) row.net -= sz;
    else if (dir.startsWith("open short") || dir.startsWith("add short")) row.net -= sz;
    else if (dir.startsWith("close short") || dir.startsWith("reduce short")) row.net += sz;
    else continue;

    if (Number.isFinite(px) && px > 0) row.lastPx = px;
    byCoin.set(coin, row);
  }

  const out: InferredPosition[] = [];
  for (const [coin, row] of byCoin.entries()) {
    if (!Number.isFinite(row.net) || Math.abs(row.net) <= 1e-9) continue;
    const side: "long" | "short" = row.net > 0 ? "long" : "short";
    const sizeAbs = Math.abs(row.net);
    const notional = (row.lastPx || 0) * sizeAbs;
    out.push({
      coin,
      side,
      szi: row.net.toString(),
      entryPx: row.lastPx > 0 ? row.lastPx.toString() : "0",
      positionValue: Number.isFinite(notional) ? notional.toString() : "0",
      unrealizedPnl: "0",
    });
  }
  out.sort((a, b) => a.coin.localeCompare(b.coin));
  return out;
}

export type TopTraderSessionRow = TopTraderState & {
  positions: HyperliquidPosition[];
  lastTradeTimeMs: number | null;
  apexLiquidUrl: string;
  isGlobal: boolean;
};

type TraderSeedRow = { address: string; nickname: string | null };

type TopTraderSeeds = {
  rows: TraderSeedRow[];
  /** `null` means every hydrated row is treated as global (owner session on the global list). */
  globalAddressesForResponse: Set<string> | null;
};

async function fetchLiveApexLiquidTopTraderAddresses(): Promise<string[]> {
  try {
    const res = await fetch(APEXLIQUID_TOP_TRADES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const raw = await res.json();
    const trades = Array.isArray(raw?.data?.trades) ? raw.data.trades : [];
    const dedup = new Set<string>();
    for (const trade of trades) {
      const addr = String(trade?.address ?? "").trim().toLowerCase();
      if (/^0x[a-fA-F0-9]{40}$/.test(addr)) dedup.add(addr);
    }
    return Array.from(dedup);
  } catch {
    return [];
  }
}

async function getTopTraderSeedsForSession(session: Session): Promise<TopTraderSeeds> {
  let rows: TraderSeedRow[];
  let globalAddressesForResponse: Set<string> | null = null;
  if (isOwnerSession(session)) {
    let adminRows = await leverageDb.leverageWallet.findMany({
      where: { active: true, global: true },
      orderBy: { createdAt: "asc" },
    });
    if (adminRows.length === 0) {
      const totalWallets = await leverageDb.leverageWallet.count();
      if (totalWallets === 0) {
        const { APEXLIQUID_TOP_TRADERS } = await import("@/lib/config/apexliquid-top-traders");
        for (const { address } of APEXLIQUID_TOP_TRADERS) {
          const addr = address.trim().toLowerCase();
          if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
          await leverageDb.leverageWallet.upsert({
            where: { address: addr },
            create: { address: addr, active: true, alertEnabled: false },
            update: {},
          });
        }
        adminRows = await leverageDb.leverageWallet.findMany({
          where: { active: true, global: true },
          orderBy: { createdAt: "asc" },
        });
      }
    }
    rows = adminRows.map((r) => ({ address: r.address, nickname: r.nickname }));
    globalAddressesForResponse = null;
  } else {
    const [globalAdminRows, userRows] = await Promise.all([
      leverageDb.leverageWallet.findMany({ where: { active: true, global: true }, orderBy: { createdAt: "asc" } }),
      (prisma as any).userLeverageWallet.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    globalAddressesForResponse = new Set(globalAdminRows.map((r) => r.address.toLowerCase()));
    const byAddr = new Map<string, string | null>();
    for (const r of globalAdminRows) byAddr.set(r.address.toLowerCase(), r.nickname);
    for (const r of userRows) {
      const addr = r.address.toLowerCase();
      if (!byAddr.has(addr)) byAddr.set(addr, r.nickname);
    }
    rows = Array.from(byAddr.entries()).map(([address, nickname]) => ({ address, nickname }));
  }
  return { rows, globalAddressesForResponse };
}

async function hydrateTopTraders(rows: TraderSeedRow[], globalAddressesForResponse: Set<string> | null): Promise<TopTraderSessionRow[]> {
  if (rows.length === 0) return [];

  const tradersInput = rows.map((r) => ({
    address: r.address,
    label: r.nickname ?? undefined,
    nickname: r.nickname,
    alertEnabled: true,
  }));
  const traders = await getTopTradersPositions(tradersInput);
  const withTime = await Promise.all(
    traders.map(async (t) => {
      const fills = await getUserFills(t.address).catch(() => []);
      const openedAtByCoinSide = inferOpenPositionOpenedAtFromFills(fills);
      const inferredXyzPositions = inferOpenXyzPositionsFromFills(fills);
      const inferredHl: HyperliquidPosition[] = inferredXyzPositions.map((p) => ({
        coin: p.coin,
        side: p.side,
        szi: p.szi,
        entryPx: p.entryPx,
        positionValue: p.positionValue,
        unrealizedPnl: p.unrealizedPnl,
        openedAtMs: p.openedAtMs,
      }));
      const existingCoins = new Set((t.positions ?? []).map((x) => x.coin.toLowerCase()));
      const mergedPositions: HyperliquidPosition[] = [
        ...(t.positions ?? []).map((p) => ({
          ...p,
          openedAtMs: openedAtByCoinSide.get(`${p.coin.toLowerCase()}|${p.side}`),
        })),
        ...inferredHl.filter((p) => !existingCoins.has(p.coin.toLowerCase())),
      ];

      const lastTradeTimeMs =
        fills.length > 0
          ? Math.max(...fills.map((f) => (typeof f.time === "number" ? f.time : 0)).filter((n) => n > 0))
          : await getLastFillTimeMs(t.address).catch(() => undefined);
      const isGlobal = globalAddressesForResponse === null ? true : globalAddressesForResponse.has(t.address.toLowerCase());
      return {
        ...t,
        positions: mergedPositions,
        lastTradeTimeMs: lastTradeTimeMs ?? null,
        apexLiquidUrl: `${APEXLIQUID_DETAIL_URL}?address=${encodeURIComponent(t.address)}`,
        isGlobal,
      };
    })
  );
  return withTime;
}

function inferOpenPositionOpenedAtFromFills(
  fills: Array<{ coin?: string; dir?: string; sz?: string; time?: number }>
): Map<string, number> {
  type CoinState = { net: number; openedAtMs: number | null };
  const byCoin = new Map<string, CoinState>();
  const asc = [...fills]
    .filter((f) => Number.isFinite(Number(f?.time ?? 0)) && Number(f?.time ?? 0) > 0)
    .sort((a, b) => Number(a.time ?? 0) - Number(b.time ?? 0));

  for (const f of asc) {
    const coin = String(f.coin ?? "").trim().toLowerCase();
    if (!coin) continue;
    const dir = String(f.dir ?? "").toLowerCase();
    const sz = Number(f.sz ?? "0");
    if (!Number.isFinite(sz) || sz <= 0) continue;
    const ts = Number(f.time ?? 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;

    let delta = 0;
    if (dir.startsWith("open long") || dir.startsWith("add long")) delta = sz;
    else if (dir.startsWith("close long") || dir.startsWith("reduce long")) delta = -sz;
    else if (dir.startsWith("open short") || dir.startsWith("add short")) delta = -sz;
    else if (dir.startsWith("close short") || dir.startsWith("reduce short")) delta = sz;
    else continue;

    const cur = byCoin.get(coin) ?? { net: 0, openedAtMs: null };
    const before = cur.net;
    const after = before + delta;
    let openedAtMs = cur.openedAtMs;

    if (Math.abs(after) <= 1e-12) {
      byCoin.set(coin, { net: 0, openedAtMs: null });
      continue;
    }

    if (Math.abs(before) <= 1e-12) {
      openedAtMs = ts;
    } else if (before * after < 0) {
      // Position flipped side in one trade, treat this fill time as the new open time.
      openedAtMs = ts;
    } else if (openedAtMs == null) {
      openedAtMs = ts;
    }

    byCoin.set(coin, { net: after, openedAtMs });
  }

  const out = new Map<string, number>();
  for (const [coin, state] of byCoin.entries()) {
    if (!state.openedAtMs || Math.abs(state.net) <= 1e-12) continue;
    const side = state.net > 0 ? "long" : "short";
    out.set(`${coin}|${side}`, state.openedAtMs);
  }
  return out;
}

/**
 * Same wallet list + Hyperliquid merge as GET /api/hyperliquid/top-traders (for reuse by Nova Eagle, etc.).
 */
export async function fetchTopTradersForSession(session: Session): Promise<TopTraderSessionRow[]> {
  if (!session?.user?.id) return [];
  const { rows, globalAddressesForResponse } = await getTopTraderSeedsForSession(session);
  return hydrateTopTraders(rows, globalAddressesForResponse);
}

/**
 * Nova Eagle "Global" mode: Apex seed list ∪ same wallets as tracked (admin global + user's Top Leverage),
 * one Hyperliquid pass. Broader coverage than the seed list alone without dropping curated addresses.
 */
export async function fetchTopTradersForNovaEagleGlobal(session: Session): Promise<TopTraderSessionRow[]> {
  const liveApexAddresses = await fetchLiveApexLiquidTopTraderAddresses();
  if (!session?.user?.id) {
    if (liveApexAddresses.length > 0) return fetchTopTradersFromAddresses(liveApexAddresses);
    const { APEXLIQUID_TOP_TRADERS } = await import("@/lib/config/apexliquid-top-traders");
    return fetchTopTradersFromAddresses(APEXLIQUID_TOP_TRADERS.map((t) => t.address));
  }
  const { APEXLIQUID_TOP_TRADERS } = await import("@/lib/config/apexliquid-top-traders");
  const seeds = await getTopTraderSeedsForSession(session);

  const byAddr = new Map<string, string | null>();
  for (const r of seeds.rows) {
    byAddr.set(r.address.toLowerCase(), r.nickname?.trim() || null);
  }
  const apexAddresses =
    liveApexAddresses.length > 0 ? liveApexAddresses : APEXLIQUID_TOP_TRADERS.map((t) => t.address);
  for (const rawAddress of apexAddresses) {
    const addr = rawAddress.trim().toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
    const staticSeed = APEXLIQUID_TOP_TRADERS.find((t) => t.address.toLowerCase() === addr);
    const label = staticSeed?.label?.trim() || null;
    if (!byAddr.has(addr)) byAddr.set(addr, label);
    else {
      const cur = byAddr.get(addr);
      if ((cur == null || cur === "") && label) byAddr.set(addr, label);
    }
  }

  const mergedRows: TraderSeedRow[] = Array.from(byAddr.entries()).map(([address, nickname]) => ({ address, nickname }));

  let globalSet: Set<string> | null;
  if (seeds.globalAddressesForResponse === null) {
    globalSet = null;
  } else {
    globalSet = new Set(seeds.globalAddressesForResponse);
    for (const rawAddress of apexAddresses) {
      const addr = rawAddress.trim().toLowerCase();
      if (/^0x[a-fA-F0-9]{40}$/.test(addr)) globalSet.add(addr);
    }
  }

  return hydrateTopTraders(mergedRows, globalSet);
}

/** Fetch top-trader positions from an explicit wallet set (used by Nova Eagle global mode). */
export async function fetchTopTradersFromAddresses(addresses: string[]): Promise<TopTraderSessionRow[]> {
  const dedup = new Set<string>();
  for (const raw of addresses) {
    const addr = String(raw ?? "").trim().toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
    dedup.add(addr);
  }
  const rows: TraderSeedRow[] = Array.from(dedup).map((address) => ({ address, nickname: null }));
  const globalSet = new Set(rows.map((r) => r.address.toLowerCase()));
  return hydrateTopTraders(rows, globalSet);
}
