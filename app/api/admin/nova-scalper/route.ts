import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInstrument, isBlofinConfigured } from "@/lib/blofin";
import { getInstrument as getCoinbaseInstrument, isCoinbaseConfigured } from "@/lib/coinbase";
import { roundToTickSize } from "@/lib/blofin-tick";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { getCoinbaseConfigForUser } from "@/lib/coinbase-user-config";
import { parseScalperInstrument, type ScalperExchange } from "@/lib/nova-scalper-instrument";
import { NOVA_SCALPER_MAX_CONFIGS } from "@/lib/nova-scalper-constants";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const defaultNovaScalperCreate = {
  symbol: "BTC",
  marginCurrency: "USDT",
  entryPrice: 95000,
  exitPrice: 96000,
  positionSizeUsdt: 50,
  leverage: 5,
  side: "long",
};

async function ensureNovaScalperConfigsForUser(sessionUserId: string) {
  let rows = await db.novaScalperConfig.findMany({
    where: { userId: sessionUserId },
    orderBy: { slot: "asc" },
  });
  if (rows.length > 0) return rows;
  const legacyList = await db.novaScalperConfig.findMany({ where: { userId: null } });
  if (legacyList.length === 1) {
    const updated = await db.novaScalperConfig.update({
      where: { id: legacyList[0].id },
      data: { userId: sessionUserId, slot: 1 },
    });
    return [updated];
  }
  if (legacyList.length > 1) {
    await db.novaScalperConfig.deleteMany({ where: { userId: null } });
  }
  const created = await db.novaScalperConfig.create({
    data: {
      userId: sessionUserId,
      slot: 1,
      ...defaultNovaScalperCreate,
    },
  });
  return [created];
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
  const exchange: ScalperExchange = body.exchange === "coinbase" ? "coinbase" : "blofin";
  const parsed = parseScalperInstrument(
    String(body.symbol ?? ""),
    body.marginCurrency === "USDC" ? "USDC" : "USDT",
    exchange
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
  const exchange: ScalperExchange = row.exchange === "coinbase" ? "coinbase" : "blofin";
  const { instId } = parseScalperInstrument(base, quote, exchange);
  const ownerForceOff = !!(row.ownerForceOff as boolean | undefined);
  const rawEnabled = !!row.enabled;
  return {
    id: row.id,
    slot: typeof row.slot === "number" ? row.slot : 1,
    enabled: rawEnabled && !ownerForceOff,
    ownerForceOff,
    exchange,
    mode: row.mode === "live" ? "live" : "demo",
    symbol: base,
    marginCurrency: quote,
    instrumentPair: `${base}/${quote}`,
    instId,
    marginMode: row.marginMode === "isolated" ? "isolated" : "cross",
    side: row.side === "short" ? "short" : "long",
    entryTrigger:
      row.entryTrigger === "cross_up"
        ? "cross_up"
        : row.entryTrigger === "immediate"
          ? "immediate"
          : "cross_down",
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
    sizeMode: row.sizeMode === "contracts" ? "contracts" : "margin",
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

    const rows = await ensureNovaScalperConfigsForUser(sessionUserId);
    const configs: ReturnType<typeof toConfig>[] = [];
    for (const r of rows) {
      const norm = await normalizeStoredInstrument(r);
      configs.push(toConfig(norm as Record<string, unknown>));
    }
    return NextResponse.json({
      success: true,
      configs,
      maxConfigs: NOVA_SCALPER_MAX_CONFIGS,
    });
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
    const userBlofinCfg = await getBlofinConfigForUser(uid);
    const userCoinbaseCfg = await getCoinbaseConfigForUser(uid);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const err = validateBody(body);
    if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });

    const exchange: ScalperExchange = body.exchange === "coinbase" ? "coinbase" : "blofin";

    let configId = String(body.configId ?? "").trim();
    if (!configId) {
      const all = await ensureNovaScalperConfigsForUser(sessionUserId);
      if (all.length === 1) configId = all[0].id as string;
      else {
        return NextResponse.json(
          { success: false, error: "configId is required when you have more than one NovaScalper config." },
          { status: 400 }
        );
      }
    }

    let row = await db.novaScalperConfig.findFirst({
      where: { id: configId, userId: sessionUserId },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
    }
    row = await normalizeStoredInstrument(row);
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

    if (body.enabled === true) {
      if (exchange === "coinbase") {
        if (!isCoinbaseConfigured() && !userCoinbaseCfg) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Add your Coinbase CDP API keys below (or in Trading Bot) before enabling NovaScalper on Coinbase.",
            },
            { status: 400 }
          );
        }
      } else if (!isBlofinConfigured() && !userBlofinCfg) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Add your Blofin API keys below (or in Trading Bot) before enabling NovaScalper. VIP accounts use their own keys.",
          },
          { status: 400 }
        );
      }
    }

    const { base, quote } = parseScalperInstrument(
      String(body.symbol ?? ""),
      body.marginCurrency === "USDC" ? "USDC" : "USDT",
      exchange
    );

    const stopRaw = body.stopLossPrice;
    let stopLossPrice = stopRaw == null || stopRaw === "" ? null : Number(stopRaw);

    const tpslTp = body.tpslTpPct != null && body.tpslTpPct !== "" ? Number(body.tpslTpPct) : null;
    const tpslSl = body.tpslSlPct != null && body.tpslSlPct !== "" ? Number(body.tpslSlPct) : null;

    const { instId } = parseScalperInstrument(base, quote, exchange);
    let entryPrice = Number(body.entryPrice);
    let exitPrice = Number(body.exitPrice);
    try {
      const inst =
        exchange === "coinbase"
          ? await getCoinbaseInstrument(instId)
          : await getInstrument(instId);
      const tick = inst?.tickSize ? Number(inst.tickSize) : NaN;
      if (Number.isFinite(tick) && tick > 0) {
        entryPrice = roundToTickSize(entryPrice, tick);
        exitPrice = roundToTickSize(exitPrice, tick);
        if (stopLossPrice != null) stopLossPrice = roundToTickSize(stopLossPrice, tick);
      }
    } catch {
      /* keep raw prices if instrument lookup fails */
    }

    row = await db.novaScalperConfig.update({
      where: { id: row.id },
      data: {
        enabled: body.enabled === true,
        exchange,
        mode: body.mode === "live" ? "live" : "demo",
        symbol: base,
        marginCurrency: quote,
        marginMode: body.marginMode === "isolated" ? "isolated" : "cross",
        side: body.side === "short" ? "short" : "long",
        entryTrigger:
          body.entryTrigger === "cross_up"
            ? "cross_up"
            : body.entryTrigger === "immediate"
              ? "immediate"
              : "cross_down",
        leverage: Math.floor(Number(body.leverage) || 5),
        entryPrice,
        exitPrice,
        stopLossPrice,
        positionSizeUsdt: Number(body.positionSizeUsdt),
        sizeMode: exchange === "coinbase" && body.sizeMode === "contracts" ? "contracts" : "margin",
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

/** Add another parallel config (next slot). */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }

    const rows = await ensureNovaScalperConfigsForUser(sessionUserId);
    if (rows.length >= NOVA_SCALPER_MAX_CONFIGS) {
      return NextResponse.json(
        { success: false, error: `You can have at most ${NOVA_SCALPER_MAX_CONFIGS} NovaScalper configs.` },
        { status: 400 }
      );
    }
    const maxSlot = rows.reduce((m: number, r: { slot?: number }) => Math.max(m, r.slot ?? 0), 0);
    const created = await db.novaScalperConfig.create({
      data: {
        userId: sessionUserId,
        slot: maxSlot + 1,
        ...defaultNovaScalperCreate,
      },
    });
    const norm = await normalizeStoredInstrument(created);
    const all = await db.novaScalperConfig.findMany({
      where: { userId: sessionUserId },
      orderBy: { slot: "asc" },
    });
    const configs = [];
    for (const r of all) {
      const n = await normalizeStoredInstrument(r);
      configs.push(toConfig(n as Record<string, unknown>));
    }
    return NextResponse.json({ success: true, config: toConfig(norm as Record<string, unknown>), configs });
  } catch (e) {
    console.error("nova-scalper POST:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Create failed." }, { status: 500 });
  }
}

/** Remove a config (must keep at least one). */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
    }

    const count = await db.novaScalperConfig.count({ where: { userId: sessionUserId } });
    if (count <= 1) {
      return NextResponse.json(
        { success: false, error: "Keep at least one NovaScalper config. Clear settings instead." },
        { status: 400 }
      );
    }

    const row = await db.novaScalperConfig.findFirst({ where: { id, userId: sessionUserId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
    }

    await db.novaScalperConfig.delete({ where: { id } });

    const all = await db.novaScalperConfig.findMany({
      where: { userId: sessionUserId },
      orderBy: { slot: "asc" },
    });
    const configs = [];
    for (const r of all) {
      const n = await normalizeStoredInstrument(r);
      configs.push(toConfig(n as Record<string, unknown>));
    }
    return NextResponse.json({ success: true, configs });
  } catch (e) {
    console.error("nova-scalper DELETE:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Delete failed." }, { status: 500 });
  }
}
