import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { getConfig, getInstrument, getPositions, getTicker } from "@/lib/blofin";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * Live unrealized PnL for one NovaScalper config (same Blofin account + instrument as ticks).
 * GET ?configId= — uses user keys; owner may use server env keys.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const userId = session.user.id;
    const configId = new URL(request.url).searchParams.get("configId")?.trim();
    if (!configId) {
      return NextResponse.json({ success: false, error: "configId required." }, { status: 400 });
    }

    const row = await db.novaScalperConfig.findFirst({ where: { id: configId, userId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
    }

    let userCfg = await getBlofinConfigForUser(userId);
    if (!userCfg && isOwnerSession(session)) {
      userCfg = getConfig();
    }
    if (!userCfg) {
      return NextResponse.json({
        success: true,
        needsKeys: true,
        hasPosition: false,
        upl: null as number | null,
        quote: row.marginCurrency === "USDC" ? "USDC" : "USDT",
        instId: null as string | null,
      });
    }

    const quote = row.marginCurrency === "USDC" ? "USDC" : "USDT";
    const isDemo = row.mode !== "live";
    const blofinOpts = { demo: isDemo, config: userCfg };

    const { instId, base } = parseScalperInstrument(String(row.symbol ?? ""), quote);
    if (!base || !instId) {
      return NextResponse.json({
        success: true,
        hasPosition: false,
        upl: null,
        quote,
        instId: null,
      });
    }

    const positions = await getPositions(instId, blofinOpts);
    if (positions.length === 0) {
      return NextResponse.json({
        success: true,
        hasPosition: false,
        upl: null,
        quote,
        instId,
      });
    }

    const p = positions[0];
    let upl: number | null = null;
    if (p.upl != null && p.upl !== "") {
      const n = parseFloat(p.upl);
      if (Number.isFinite(n)) upl = n;
    }

    let markPx: number | null = null;
    if (p.markPx != null && p.markPx !== "") {
      const m = parseFloat(p.markPx);
      if (Number.isFinite(m)) markPx = m;
    }
    const ticker = await getTicker(instId, isDemo, { config: userCfg });
    const last = ticker?.last ? parseFloat(ticker.last) : NaN;
    if (!Number.isFinite(markPx) && Number.isFinite(last)) markPx = last;

    if (upl == null && markPx != null && p.avgPx) {
      const inst = await getInstrument(instId, { demo: isDemo, config: userCfg });
      const cv = inst ? parseFloat(inst.contractValue) : NaN;
      const avg = parseFloat(p.avgPx);
      const contracts = Math.abs(parseFloat(p.pos));
      if (Number.isFinite(cv) && cv > 0 && Number.isFinite(avg) && Number.isFinite(contracts) && contracts > 0) {
        const long = p.posSide === "long" || parseFloat(p.pos) >= 0;
        upl = long ? (markPx - avg) * contracts * cv : (avg - markPx) * contracts * cv;
      }
    }

    return NextResponse.json({
      success: true,
      hasPosition: true,
      instId,
      quote,
      upl,
      markPrice: markPx,
      avgPx: parseFloat(p.avgPx),
      pos: p.pos,
      posSide: p.posSide,
    });
  } catch (e) {
    console.error("nova-scalper position GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load position." },
      { status: 500 }
    );
  }
}
