import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { getCoinbaseConfigForUser } from "@/lib/coinbase-user-config";
import { getConfig as getBlofinEnvConfig, getInstrument as getBlofinInstrument, getPositions as getBlofinPositions, getTicker as getBlofinTicker } from "@/lib/blofin";
import { getConfig as getCoinbaseEnvConfig, getInstrument as getCoinbaseInstrument, getPositions as getCoinbasePositions, getTicker as getCoinbaseTicker } from "@/lib/coinbase";
import { parseScalperInstrument, type ScalperExchange } from "@/lib/nova-scalper-instrument";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * Live unrealized PnL for one NovaScalper config (same exchange account + instrument as ticks).
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

    const exchange: ScalperExchange = row.exchange === "coinbase" ? "coinbase" : "blofin";
    const quote = row.marginCurrency === "USDC" ? "USDC" : "USDT";
    const isDemo = row.mode !== "live";

    if (exchange === "coinbase") {
      let coinbaseCfg = await getCoinbaseConfigForUser(userId);
      if (!coinbaseCfg && isOwnerSession(session)) {
        coinbaseCfg = getCoinbaseEnvConfig();
      }
      if (!coinbaseCfg) {
        return NextResponse.json({
          success: true,
          needsKeys: true,
          hasPosition: false,
          upl: null as number | null,
          quote,
          instId: null as string | null,
          exchange,
        });
      }

      const { instId, base } = parseScalperInstrument(String(row.symbol ?? ""), quote, exchange);
      if (!base || !instId) {
        return NextResponse.json({ success: true, hasPosition: false, upl: null, quote, instId: null, exchange });
      }

      const coinbaseOpts = { demo: isDemo, config: coinbaseCfg };
      const positions = await getCoinbasePositions(instId, coinbaseOpts);
      if (positions.length === 0) {
        return NextResponse.json({ success: true, hasPosition: false, upl: null, quote, instId, exchange });
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
      const ticker = await getCoinbaseTicker(instId, isDemo, coinbaseOpts);
      const last = ticker?.last ? parseFloat(ticker.last) : NaN;
      if (!Number.isFinite(markPx) && Number.isFinite(last)) markPx = last;

      if (upl == null && markPx != null && p.avgPx) {
        const inst = await getCoinbaseInstrument(instId, coinbaseOpts);
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
        exchange,
      });
    }

    let blofinCfg = await getBlofinConfigForUser(userId);
    if (!blofinCfg && isOwnerSession(session)) {
      blofinCfg = getBlofinEnvConfig();
    }
    if (!blofinCfg) {
      return NextResponse.json({
        success: true,
        needsKeys: true,
        hasPosition: false,
        upl: null as number | null,
        quote,
        instId: null as string | null,
        exchange,
      });
    }

    const blofinOpts = { demo: isDemo, config: blofinCfg };

    const { instId, base } = parseScalperInstrument(String(row.symbol ?? ""), quote, exchange);
    if (!base || !instId) {
      return NextResponse.json({
        success: true,
        hasPosition: false,
        upl: null,
        quote,
        instId: null,
        exchange,
      });
    }

    const positions = await getBlofinPositions(instId, blofinOpts);
    if (positions.length === 0) {
      return NextResponse.json({
        success: true,
        hasPosition: false,
        upl: null,
        quote,
        instId,
        exchange,
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
    const ticker = await getBlofinTicker(instId, isDemo, { config: blofinCfg });
    const last = ticker?.last ? parseFloat(ticker.last) : NaN;
    if (!Number.isFinite(markPx) && Number.isFinite(last)) markPx = last;

    if (upl == null && markPx != null && p.avgPx) {
      const inst = await getBlofinInstrument(instId, { demo: isDemo, config: blofinCfg });
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
      exchange,
    });
  } catch (e) {
    console.error("nova-scalper position GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load position." },
      { status: 500 }
    );
  }
}
