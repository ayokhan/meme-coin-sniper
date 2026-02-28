import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getTopTradersPositions, getLastFillTimeMs } from "@/lib/api-clients/hyperliquid";
import { leverageDb } from "@/lib/leverage-db";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const APEXLIQUID_DETAIL_URL = "https://apexliquid.bot/trade/detail";

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userRows = await (prisma as any).userLeverageWallet.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      });
      rows = userRows.map((r: { address: string; nickname: string | null }) => ({ address: r.address, nickname: r.nickname }));
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
