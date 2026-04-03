import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isBlofinConfigured } from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function ensureNovaScalperRow(sessionUserId: string) {
  let row = await db.novaScalperConfig.findFirst({ where: { userId: sessionUserId } });
  if (row) return row;
  const legacyList = await db.novaScalperConfig.findMany({ where: { userId: null } });
  if (legacyList.length === 1) {
    return await db.novaScalperConfig.update({
      where: { id: legacyList[0].id },
      data: { userId: sessionUserId },
    });
  }
  if (legacyList.length > 1) {
    await db.novaScalperConfig.deleteMany({ where: { userId: null } });
  }
  return await db.novaScalperConfig.create({
    data: {
      userId: sessionUserId,
      symbol: "BTC",
      marginCurrency: "USDT",
      entryPrice: 95000,
      exitPrice: 96000,
      positionSizeUsdt: 50,
      leverage: 5,
      side: "long",
    },
  });
}

async function normalizeStoredInstrument(row: { id: string; symbol: string; marginCurrency?: string }) {
  const sym = String(row.symbol);
  if (!sym.includes("/") && !sym.includes("-")) return row;
  const { base, quote } = parseScalperInstrument(sym, row.marginCurrency ?? "USDT");
  if (!base) return row;
  if (sym === base) return row;
  return await db.novaScalperConfig.update({
    where: { id: row.id },
    data: { symbol: base, marginCurrency: quote },
  });
}

function validateBody(body: Record<string, unknown>): string | undefined {
  const parsed = parseScalperInstrument(
    String(body.symbol ?? ""),
    body.marginCurrency === "USDC" ? "USDC" : "USDT"
  );
  if (!parsed.base || !parsed.instId) return "Instrument is required (e.g. BTC/USDT or BTC/USDC).";
  const lev = Number(body.leverage);
  if (!Number.isFinite(lev) || lev < 1 || lev > 125) return "Leverage must be 1–125.";
  const entry = Number(body.entryPrice);
  const exit = Number(body.exitPrice);
  if (!Number.isFinite(entry) || entry <= 0) return "Entry price must be positive.";
  if (!Number.isFinite(exit) || exit <= 0) return "Exit price must be positive.";
  const side = body.side === "short" ? "short" : "long";
  if (side === "long" && exit <= entry) return "Long: exit must be above entry.";
  if (side === "short" && exit >= entry) return "Short: exit must be below entry.";
  const pos = Number(body.positionSizeUsdt);
  if (!Number.isFinite(pos) || pos < 1 || pos > 1_000_000) return "Margin must be 1–1,000,000.";
  const sl = body.stopLossPrice;
  if (sl != null && sl !== "") {
    const s = Number(sl);
    if (!Number.isFinite(s) || s <= 0) return "Stop loss must be positive if set.";
    if (side === "long" && s >= entry) return "Long: stop should be below entry.";
    if (side === "short" && s <= entry) return "Short: stop should be above entry.";
  }
  return undefined;
}

function toConfig(row: Record<string, unknown>) {
  const base = String(row.symbol ?? "BTC");
  const quote = row.marginCurrency === "USDC" ? "USDC" : "USDT";
  const { instId } = parseScalperInstrument(base, quote);
  const ownerForceOff = !!(row.ownerForceOff as boolean | undefined);
  const rawEnabled = !!row.enabled;
  return {
    id: row.id,
    enabled: rawEnabled && !ownerForceOff,
    ownerForceOff,
    mode: row.mode === "live" ? "live" : "demo",
    symbol: base,
    marginCurrency: quote,
    instrumentPair: `${base}/${quote}`,
    instId,
    marginMode: row.marginMode === "isolated" ? "isolated" : "cross",
    side: row.side === "short" ? "short" : "long",
    entryTrigger: row.entryTrigger === "cross_up" ? "cross_up" : "cross_down",
    leverage: row.leverage,
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    stopLossPrice: row.stopLossPrice != null ? Number(row.stopLossPrice) : null,
    positionSizeUsdt: row.positionSizeUsdt,
    maxRounds: row.maxRounds ?? 0,
    completedRounds: row.completedRounds ?? 0,
    inPosition: !!row.inPosition,
    lastRefPrice: row.lastRefPrice != null ? Number(row.lastRefPrice) : null,
    attachTpsl: !!row.attachTpsl,
    tpslTpPct: row.tpslTpPct != null ? Number(row.tpslTpPct) : null,
    tpslSlPct: row.tpslSlPct != null ? Number(row.tpslSlPct) : null,
    lastTickAt: row.lastTickAt ? (row.lastTickAt as Date).toISOString() : null,
    lastError: row.lastError ?? null,
    lastAction: row.lastAction ?? null,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }

    let row = await ensureNovaScalperRow(sessionUserId);
    row = await normalizeStoredInstrument(row);

    return NextResponse.json({ success: true, config: toConfig(row as Record<string, unknown>) });
  } catch (e) {
    console.error("nova-scalper GET:", e);
    const msg = e instanceof Error ? e.message : "Failed to load.";
    return NextResponse.json(
      {
        success: false,
        error:
          msg.includes("userId") || msg.includes("NovaScalperConfig")
            ? "Database needs the latest schema. Run: npx prisma db push"
            : msg,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }

    const uid = sessionUserId;
    const userCfg = await getBlofinConfigForUser(uid);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const err = validateBody(body);
    if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });

    let row = await ensureNovaScalperRow(sessionUserId);
    const lockedByOwner = !!(row as { ownerForceOff?: boolean }).ownerForceOff;
    if (lockedByOwner && body.enabled === true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "NovaScalper was disabled by the owner. You cannot turn it back on until they allow it again in Admin → NovaScalper.",
        },
        { status: 403 }
      );
    }

    if (body.enabled === true && !isBlofinConfigured() && !userCfg) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Add your Blofin API keys below (or in Trading Bot) before enabling NovaScalper. VIP accounts use their own keys.",
        },
        { status: 400 }
      );
    }

    const { base, quote } = parseScalperInstrument(
      String(body.symbol ?? ""),
      body.marginCurrency === "USDC" ? "USDC" : "USDT"
    );

    const stopRaw = body.stopLossPrice;
    const stopLossPrice = stopRaw == null || stopRaw === "" ? null : Number(stopRaw);

    const tpslTp = body.tpslTpPct != null && body.tpslTpPct !== "" ? Number(body.tpslTpPct) : null;
    const tpslSl = body.tpslSlPct != null && body.tpslSlPct !== "" ? Number(body.tpslSlPct) : null;

    row = await db.novaScalperConfig.update({
      where: { id: row.id },
      data: {
        enabled: body.enabled === true,
        mode: body.mode === "live" ? "live" : "demo",
        symbol: base,
        marginCurrency: quote,
        marginMode: body.marginMode === "isolated" ? "isolated" : "cross",
        side: body.side === "short" ? "short" : "long",
        entryTrigger: body.entryTrigger === "cross_up" ? "cross_up" : "cross_down",
        leverage: Math.floor(Number(body.leverage) || 5),
        entryPrice: Number(body.entryPrice),
        exitPrice: Number(body.exitPrice),
        stopLossPrice,
        positionSizeUsdt: Number(body.positionSizeUsdt),
        maxRounds: Math.max(0, Math.min(10_000, Math.floor(Number(body.maxRounds) || 0))),
        attachTpsl: body.attachTpsl === true,
        tpslTpPct: tpslTp != null && Number.isFinite(tpslTp) && tpslTp > 0 ? tpslTp : null,
        tpslSlPct: tpslSl != null && Number.isFinite(tpslSl) && tpslSl > 0 ? tpslSl : null,
      },
    });

    return NextResponse.json({ success: true, config: toConfig(row as Record<string, unknown>) });
  } catch (e) {
    console.error("nova-scalper PATCH:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Save failed." }, { status: 500 });
  }
}
