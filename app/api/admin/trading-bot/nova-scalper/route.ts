import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function validateBody(body: Record<string, unknown>): string | undefined {
  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return "Symbol is required.";
  const side = body.side === "short" ? "short" : "long";
  const openWhen = body.openWhen === "gte" ? "gte" : "lte";
  const entry = Number(body.entryPrice);
  const exitP = Number(body.exitPrice);
  if (!Number.isFinite(entry) || entry <= 0) return "Entry price must be a positive number.";
  if (!Number.isFinite(exitP) || exitP <= 0) return "Exit price must be a positive number.";
  if (side === "long" && openWhen === "lte" && exitP <= entry) return "For long (buy the dip), exit should be above entry.";
  if (side === "long" && openWhen === "gte" && exitP <= entry) return "For long breakout, exit should be above entry.";
  if (side === "short" && openWhen === "gte" && exitP >= entry) return "For short (fade rally), exit should be below entry.";
  if (side === "short" && openWhen === "lte" && exitP >= entry) return "For short breakdown, exit should be below entry.";
  const lev = Number(body.leverage);
  if (!Number.isFinite(lev) || lev < 1 || lev > 125) return "Leverage must be 1–125.";
  const margin = Number(body.marginUsdt);
  if (!Number.isFinite(margin) || margin < 1 || margin > 1_000_000) return "Margin (USDT) must be between 1 and 1,000,000.";
  const slRaw = body.stopLossPrice;
  if (slRaw != null && slRaw !== "") {
    const sl = Number(slRaw);
    if (!Number.isFinite(sl) || sl <= 0) return "Stop loss must be a positive price or empty.";
    if (side === "long" && sl >= entry) return "Long stop should be below entry.";
    if (side === "short" && sl <= entry) return "Short stop should be above entry.";
  }
  return undefined;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading Bot access required." }, { status: 403 });
    }
    let row = await db.novaScalperConfig.findUnique({ where: { userId: session.user.id } });
    if (!row) {
      row = await db.novaScalperConfig.create({
        data: {
          userId: session.user.id,
          symbol: "BTC",
          side: "long",
          openWhen: "lte",
          entryPrice: 0,
          exitPrice: 0,
          marginUsdt: 50,
          leverage: 10,
          mode: "demo",
          enabled: false,
          runState: "flat",
        },
      });
    }
    return NextResponse.json({
      success: true,
      config: {
        id: row.id,
        symbol: row.symbol,
        marginCurrency: row.marginCurrency ?? "USDT",
        marginMode: row.marginMode ?? "cross",
        side: row.side,
        openWhen: row.openWhen ?? "lte",
        entryPrice: row.entryPrice,
        exitPrice: row.exitPrice,
        stopLossPrice: row.stopLossPrice,
        marginUsdt: row.marginUsdt,
        leverage: row.leverage,
        mode: row.mode,
        enabled: row.enabled,
        runState: row.runState,
        cyclesCompleted: row.cyclesCompleted ?? 0,
        lastMark: row.lastMark,
        lastTickAt: row.lastTickAt?.toISOString() ?? null,
        lastActionAt: row.lastActionAt?.toISOString() ?? null,
        lastActionMsg: row.lastActionMsg ?? null,
        lastError: row.lastError ?? null,
      },
    });
  } catch (e) {
    console.error("nova-scalper GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load NovaScalper." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading Bot access required." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    let row = await db.novaScalperConfig.findUnique({ where: { userId: session.user.id } });
    if (!row) {
      row = await db.novaScalperConfig.create({
        data: {
          userId: session.user.id,
          symbol: "BTC",
          side: "long",
          openWhen: "lte",
          entryPrice: 0,
          exitPrice: 0,
          marginUsdt: 50,
          leverage: 10,
          mode: "demo",
          enabled: false,
        },
      });
    }

    const merged = {
      symbol: (body.symbol ?? row.symbol).toString().trim().toUpperCase(),
      marginCurrency: body.marginCurrency === "USDC" ? "USDC" : "USDT",
      marginMode: body.marginMode === "isolated" ? "isolated" : "cross",
      side: body.side === "short" ? "short" : row.side,
      openWhen: body.openWhen === "gte" ? "gte" : row.openWhen,
      entryPrice: num(body.entryPrice, row.entryPrice),
      exitPrice: num(body.exitPrice, row.exitPrice),
      stopLossPrice:
        body.stopLossPrice === null || body.stopLossPrice === "" || body.stopLossPrice === undefined
          ? null
          : (() => {
              const n = num(body.stopLossPrice, NaN);
              return Number.isFinite(n) && n > 0 ? n : null;
            })(),
      marginUsdt: num(body.marginUsdt, row.marginUsdt),
      leverage: Math.round(num(body.leverage, row.leverage)),
      mode: body.mode === "live" ? "live" : "demo",
      enabled: typeof body.enabled === "boolean" ? body.enabled : row.enabled,
    };

    if (body.side === "long" || body.side === "short") merged.side = body.side;
    if (body.openWhen === "lte" || body.openWhen === "gte") merged.openWhen = body.openWhen;

    if (merged.enabled) {
      const err = validateBody({ ...merged, symbol: merged.symbol });
      if (err) {
        return NextResponse.json({ success: false, error: `${err} Fix inputs before enabling.` }, { status: 400 });
      }
    }

    const updated = await db.novaScalperConfig.update({
      where: { id: row.id },
      data: {
        symbol: merged.symbol,
        marginCurrency: merged.marginCurrency,
        marginMode: merged.marginMode,
        side: merged.side,
        openWhen: merged.openWhen,
        entryPrice: merged.entryPrice,
        exitPrice: merged.exitPrice,
        stopLossPrice: merged.stopLossPrice,
        marginUsdt: merged.marginUsdt,
        leverage: merged.leverage,
        mode: merged.mode,
        enabled: merged.enabled,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: updated.id,
        symbol: updated.symbol,
        marginCurrency: updated.marginCurrency ?? "USDT",
        marginMode: updated.marginMode ?? "cross",
        side: updated.side,
        openWhen: updated.openWhen ?? "lte",
        entryPrice: updated.entryPrice,
        exitPrice: updated.exitPrice,
        stopLossPrice: updated.stopLossPrice,
        marginUsdt: updated.marginUsdt,
        leverage: updated.leverage,
        mode: updated.mode,
        enabled: updated.enabled,
        runState: updated.runState,
        cyclesCompleted: updated.cyclesCompleted ?? 0,
        lastMark: updated.lastMark,
        lastTickAt: updated.lastTickAt?.toISOString() ?? null,
        lastActionAt: updated.lastActionAt?.toISOString() ?? null,
        lastActionMsg: updated.lastActionMsg ?? null,
        lastError: updated.lastError ?? null,
      },
    });
  } catch (e) {
    console.error("nova-scalper PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 500 }
    );
  }
}
