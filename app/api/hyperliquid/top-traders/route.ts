import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getTopTradersPositions, getLastFillTimeMs } from "@/lib/api-clients/hyperliquid";
import { leverageDb } from "@/lib/leverage-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const APEXLIQUID_DETAIL_URL = "https://apexliquid.bot/trade/detail";

/** Owner only. VIP + on demand for others (see Trading Bot tab). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json(
        { success: false, error: "Top Leverage Traders requires VIP + on demand. Contact for access." },
        { status: 403 }
      );
    }
    let rows = await leverageDb.leverageWallet.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) {
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
      rows = await leverageDb.leverageWallet.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
    }
    const tradersInput = rows.map((r) => ({
      address: r.address,
      label: r.nickname ?? undefined,
      nickname: r.nickname,
      alertEnabled: r.alertEnabled,
    }));
    const traders = await getTopTradersPositions(tradersInput);
    const withTime = await Promise.all(
      traders.map(async (t) => {
        const lastTradeTimeMs = await getLastFillTimeMs(t.address).catch(() => undefined);
        return {
          ...t,
          lastTradeTimeMs: lastTradeTimeMs ?? null,
          apexLiquidUrl: `${APEXLIQUID_DETAIL_URL}?address=${encodeURIComponent(t.address)}`,
        };
      })
    );
    return NextResponse.json({ success: true, traders: withTime });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Top Leverage Traders";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
