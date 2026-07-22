import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNovaForexBotAccess } from "@/lib/vip-futures-addon-access";
import { normalizeForexSymbol } from "@/lib/forex-market";
import { parseForexBrokerId } from "@/lib/forex-broker-user-config";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function toView(row: Record<string, unknown>) {
  const ownerForceOff = !!row.ownerForceOff;
  return {
    id: row.id,
    enabled: !!row.enabled && !ownerForceOff,
    ownerForceOff,
    mode: row.mode === "live" ? "live" : "demo",
    broker: parseForexBrokerId(row.broker) ?? "vantage",
    symbol: row.symbol ?? "EURUSD",
    timeframe: row.timeframe ?? "15m",
    lotSize: row.lotSize ?? 0.01,
    fastMA: row.fastMA ?? 9,
    slowMA: row.slowMA ?? 21,
    stopLossPips: row.stopLossPips != null ? Number(row.stopLossPips) : null,
    takeProfitPips: row.takeProfitPips != null ? Number(row.takeProfitPips) : null,
    magic: row.magic != null ? Number(row.magic) : null,
    inPosition: !!row.inPosition,
    positionSide: row.positionSide ?? null,
    lastRunAt: row.lastRunAt ? (row.lastRunAt as Date).toISOString() : null,
    lastDecision: row.lastDecision ?? null,
    lastError: row.lastError ?? null,
  };
}

async function ensureConfig(userId: string) {
  let row = await db.novaForexBotConfig.findFirst({ where: { userId } });
  if (!row) {
    row = await db.novaForexBotConfig.create({ data: { userId } });
  }
  return row;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const row = await ensureConfig(access.userId);
    return NextResponse.json({ success: true, config: toView(row) });
  } catch (e) {
    console.error("nova-forex-bot/config GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const row = await ensureConfig(access.userId);

    if (row.ownerForceOff && body.enabled === true) {
      return NextResponse.json(
        {
          success: false,
          error: "Nova Forex Bot was disabled by the owner. You cannot turn it back on until they allow it again.",
        },
        { status: 403 }
      );
    }

    const lotSize = Number(body.lotSize);
    const fastMA = Number(body.fastMA);
    const slowMA = Number(body.slowMA);
    if (!Number.isFinite(lotSize) || lotSize <= 0) {
      return NextResponse.json({ success: false, error: "lotSize must be a positive number." }, { status: 400 });
    }
    if (!Number.isFinite(fastMA) || fastMA < 1 || !Number.isFinite(slowMA) || slowMA <= fastMA) {
      return NextResponse.json({ success: false, error: "slowMA must be greater than fastMA." }, { status: 400 });
    }

    const stopLossPips = body.stopLossPips == null || body.stopLossPips === "" ? null : Number(body.stopLossPips);
    const takeProfitPips = body.takeProfitPips == null || body.takeProfitPips === "" ? null : Number(body.takeProfitPips);
    const magic = body.magic == null || body.magic === "" ? null : Math.floor(Number(body.magic));

    const updated = await db.novaForexBotConfig.update({
      where: { id: row.id },
      data: {
        enabled: body.enabled === true,
        mode: body.mode === "live" ? "live" : "demo",
        broker: parseForexBrokerId(body.broker) ?? "vantage",
        symbol: normalizeForexSymbol(String(body.symbol ?? row.symbol ?? "EURUSD")) || "EURUSD",
        timeframe: String(body.timeframe ?? row.timeframe ?? "15m"),
        lotSize,
        fastMA: Math.floor(fastMA),
        slowMA: Math.floor(slowMA),
        stopLossPips: stopLossPips != null && Number.isFinite(stopLossPips) && stopLossPips > 0 ? stopLossPips : null,
        takeProfitPips:
          takeProfitPips != null && Number.isFinite(takeProfitPips) && takeProfitPips > 0 ? takeProfitPips : null,
        magic: magic != null && Number.isFinite(magic) ? magic : null,
      },
    });

    return NextResponse.json({ success: true, config: toView(updated) });
  } catch (e) {
    console.error("nova-forex-bot/config POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 500 }
    );
  }
}
