import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getTopTradersPositions, getLastFillTimeMs, getUserFills } from "@/lib/api-clients/hyperliquid";
import { leverageDb } from "@/lib/leverage-db";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const APEXLIQUID_DETAIL_URL = "https://apexliquid.bot/trade/detail";

type InferredPosition = {
  coin: string;
  side: "long" | "short";
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
};

/**
 * Some instruments (notably xyz:* synthetic markets shown by ApexLiquid) can appear
 * in fills while not consistently appearing in clearinghouse open positions.
 * We infer open xyz positions from recent fills so UI stays aligned with Apex screens.
 */
function inferOpenXyzPositionsFromFills(
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

/** Owner: admin list (LeverageWallet). Logged-in user: their UserLeverageWallet list. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Sign in required to view Top Leverage Traders." },
        { status: 401 }
      );
    }
    let rows: { address: string; nickname: string | null }[];
    let globalAddressesForResponse: Set<string> | null = null;
    if (isOwnerSession(session)) {
      let adminRows = await leverageDb.leverageWallet.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      });
      if (adminRows.length === 0) {
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
        adminRows = await leverageDb.leverageWallet.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
      }
      rows = adminRows.map((r) => ({ address: r.address, nickname: r.nickname }));
    } else {
      // Non-owner: global admin wallets + user's own list (dedupe by address)
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
      for (const r of userRows as { address: string; nickname: string | null }[]) {
        const addr = r.address.toLowerCase();
        if (!byAddr.has(addr)) byAddr.set(addr, r.nickname);
      }
      rows = Array.from(byAddr.entries()).map(([address, nickname]) => ({ address, nickname }));
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: true, traders: [] });
    }
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
        const inferredXyzPositions = inferOpenXyzPositionsFromFills(fills);
        const existingCoins = new Set((t.positions ?? []).map((p) => p.coin.toLowerCase()));
        const mergedPositions = [
          ...(t.positions ?? []),
          ...inferredXyzPositions.filter((p) => !existingCoins.has(p.coin.toLowerCase())),
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
    return NextResponse.json({ success: true, traders: withTime });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Top Leverage Traders";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
