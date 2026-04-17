import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { fetchPolymarketTraderSummary } from "@/lib/polymarket-data-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ListRow = {
  address: string;
  nickname: string | null;
  isGlobal: boolean;
  source: "admin" | "user";
};

/** GET — merged tracker list + optional live summaries from Polymarket data API. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }

    let rows: ListRow[] = [];
    if (access.isOwner) {
      const adminRows = await prisma.polymarketTrackedWallet.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      });
      const byAddr = new Map<string, ListRow>();
      for (const r of adminRows) {
        byAddr.set(r.address.toLowerCase(), {
          address: r.address,
          nickname: r.nickname,
          isGlobal: r.global,
          source: "admin",
        });
      }
      const userRows = await prisma.userPolymarketTrackedWallet.findMany({
        where: { userId: access.userId },
        orderBy: { createdAt: "asc" },
      });
      for (const r of userRows) {
        const key = r.address.toLowerCase();
        if (!byAddr.has(key)) {
          byAddr.set(key, {
            address: r.address,
            nickname: r.nickname,
            isGlobal: false,
            source: "user",
          });
        }
      }
      rows = Array.from(byAddr.values());
    } else {
      const [globalAdmin, userRows] = await Promise.all([
        prisma.polymarketTrackedWallet.findMany({
          where: { active: true, global: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.userPolymarketTrackedWallet.findMany({
          where: { userId: access.userId },
          orderBy: { createdAt: "asc" },
        }),
      ]);
      const byAddr = new Map<string, ListRow>();
      for (const r of globalAdmin) {
        byAddr.set(r.address.toLowerCase(), {
          address: r.address,
          nickname: r.nickname,
          isGlobal: true,
          source: "admin",
        });
      }
      for (const r of userRows) {
        const key = r.address.toLowerCase();
        if (!byAddr.has(key)) {
          byAddr.set(key, {
            address: r.address,
            nickname: r.nickname,
            isGlobal: false,
            source: "user",
          });
        }
      }
      rows = Array.from(byAddr.values());
    }

    const traders: Array<
      ListRow & {
        valueUsd: number | null;
        positionCount: number;
        lastTradeTimeMs: number | null;
        tradeCount: number;
        volumeUsd: number;
        totalShares: number;
        netFlowUsd: number;
        closedPositionCount: number;
      }
    > = [];
    const chunk = 4;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const enriched = await Promise.all(
        slice.map(async (row) => {
          const s = await fetchPolymarketTraderSummary(row.address).catch(() => ({
            valueUsd: null as number | null,
            positionCount: 0,
            lastTradeTimeMs: null as number | null,
            tradeCount: 0,
            volumeUsd: 0,
            totalShares: 0,
            netFlowUsd: 0,
            closedPositionCount: 0,
          }));
          return { ...row, ...s };
        })
      );
      traders.push(...enriched);
    }

    return NextResponse.json({ success: true, traders });
  } catch (e) {
    console.error("polymarket-tracker/list:", e);
    const message = e instanceof Error ? e.message : "Failed to load tracker list.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
