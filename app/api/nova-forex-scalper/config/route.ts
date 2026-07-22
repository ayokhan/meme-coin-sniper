import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNovaForexScalpBotAccess } from "@/lib/vip-futures-addon-access";
import { normalizeForexSymbol, validateForexScalpSymbol } from "@/lib/forex-market";
import { NOVA_FOREX_SCALPER_MAX_CONFIGS } from "@/lib/nova-forex-scalper-constants";
import { parseForexBrokerId } from "@/lib/forex-broker-user-config";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const defaultCreate = {
  symbol: "EURUSD",
  entryPrice: 1.09,
  exitPrice: 1.095,
  lotSize: 0.01,
  side: "long",
};

async function ensureConfigsForUser(userId: string) {
  const rows = await db.novaForexScalperConfig.findMany({ where: { userId }, orderBy: { slot: "asc" } });
  if (rows.length > 0) return rows;
  const created = await db.novaForexScalperConfig.create({
    data: { userId, slot: 1, ...defaultCreate },
  });
  return [created];
}

function validateBody(body: Record<string, unknown>): string | undefined {
  const check = validateForexScalpSymbol(String(body.symbol ?? ""));
  if (!check.ok) return check.error;
  const entry = Number(body.entryPrice);
  const exit = Number(body.exitPrice);
  if (!Number.isFinite(entry) || entry <= 0) return "Entry price must be positive.";
  if (!Number.isFinite(exit) || exit <= 0) return "Exit price must be positive.";
  const side = body.side === "short" ? "short" : "long";
  if (side === "long" && exit <= entry) return "Long: exit must be above entry.";
  if (side === "short" && exit >= entry) return "Short: exit must be below entry.";
  const lotSize = Number(body.lotSize);
  if (!Number.isFinite(lotSize) || lotSize <= 0) return "Lot size must be positive.";
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
  const ownerForceOff = !!(row.ownerForceOff as boolean | undefined);
  return {
    id: row.id,
    slot: typeof row.slot === "number" ? row.slot : 1,
    enabled: !!row.enabled && !ownerForceOff,
    ownerForceOff,
    mode: row.mode === "live" ? "live" : "demo",
    broker: parseForexBrokerId(row.broker) ?? "vantage",
    symbol: row.symbol ?? "EURUSD",
    side: row.side === "short" ? "short" : "long",
    entryTrigger: row.entryTrigger === "cross_up" ? "cross_up" : "cross_down",
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    stopLossPrice: row.stopLossPrice != null ? Number(row.stopLossPrice) : null,
    lotSize: row.lotSize,
    maxRounds: row.maxRounds ?? 0,
    completedRounds: row.completedRounds ?? 0,
    inPosition: !!row.inPosition,
    lastRefPrice: row.lastRefPrice != null ? Number(row.lastRefPrice) : null,
    lastTickAt: row.lastTickAt ? (row.lastTickAt as Date).toISOString() : null,
    lastError: row.lastError ?? null,
    lastAction: row.lastAction ?? null,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const rows = await ensureConfigsForUser(access.userId);
    return NextResponse.json({
      success: true,
      configs: rows.map((r: Record<string, unknown>) => toConfig(r)),
      maxConfigs: NOVA_FOREX_SCALPER_MAX_CONFIGS,
    });
  } catch (e) {
    console.error("nova-forex-scalper/config GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load." },
      { status: 500 }
    );
  }
}

/** POST — upsert a slot's settings. Body includes configId to edit an existing slot, else creates slot 1. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // "Add config" — no meaningful fields besides configId marker → create next slot.
    if (!body || Object.keys(body).length === 0 || body.addSlot === true) {
      const rows = await ensureConfigsForUser(access.userId);
      if (rows.length >= NOVA_FOREX_SCALPER_MAX_CONFIGS) {
        return NextResponse.json(
          { success: false, error: `You can have at most ${NOVA_FOREX_SCALPER_MAX_CONFIGS} Nova Forex Scalper configs.` },
          { status: 400 }
        );
      }
      const maxSlot = rows.reduce((m: number, r: { slot?: number }) => Math.max(m, r.slot ?? 0), 0);
      const created = await db.novaForexScalperConfig.create({
        data: { userId: access.userId, slot: maxSlot + 1, ...defaultCreate },
      });
      const all = await db.novaForexScalperConfig.findMany({ where: { userId: access.userId }, orderBy: { slot: "asc" } });
      return NextResponse.json({
        success: true,
        config: toConfig(created),
        configs: all.map((r: Record<string, unknown>) => toConfig(r)),
      });
    }

    const err = validateBody(body);
    if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });

    let configId = String(body.configId ?? "").trim();
    if (!configId) {
      const all = await ensureConfigsForUser(access.userId);
      if (all.length === 1) configId = all[0].id as string;
      else {
        return NextResponse.json(
          { success: false, error: "configId is required when you have more than one config." },
          { status: 400 }
        );
      }
    }

    const row = await db.novaForexScalperConfig.findFirst({ where: { id: configId, userId: access.userId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
    }
    const lockedByOwner = !!row.ownerForceOff;
    if (lockedByOwner && body.enabled === true) {
      return NextResponse.json(
        {
          success: false,
          error: "Nova Forex Scalper was disabled by the owner. You cannot turn it back on until they allow it again.",
        },
        { status: 403 }
      );
    }

    const stopRaw = body.stopLossPrice;
    const stopLossPrice = stopRaw == null || stopRaw === "" ? null : Number(stopRaw);

    const updated = await db.novaForexScalperConfig.update({
      where: { id: row.id },
      data: {
        enabled: body.enabled === true,
        mode: body.mode === "live" ? "live" : "demo",
        broker: parseForexBrokerId(body.broker) ?? "vantage",
        symbol: normalizeForexSymbol(String(body.symbol ?? "")),
        side: body.side === "short" ? "short" : "long",
        entryTrigger: body.entryTrigger === "cross_up" ? "cross_up" : "cross_down",
        entryPrice: Number(body.entryPrice),
        exitPrice: Number(body.exitPrice),
        stopLossPrice,
        lotSize: Number(body.lotSize),
        maxRounds: Math.max(0, Math.min(10_000, Math.floor(Number(body.maxRounds) || 0))),
      },
    });

    return NextResponse.json({ success: true, config: toConfig(updated) });
  } catch (e) {
    console.error("nova-forex-scalper/config POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 500 }
    );
  }
}

/** DELETE — remove a config (must keep at least one). ?id= */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
    }

    const count = await db.novaForexScalperConfig.count({ where: { userId: access.userId } });
    if (count <= 1) {
      return NextResponse.json(
        { success: false, error: "Keep at least one Nova Forex Scalper config. Clear settings instead." },
        { status: 400 }
      );
    }

    const row = await db.novaForexScalperConfig.findFirst({ where: { id, userId: access.userId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
    }

    await db.novaForexScalperConfig.delete({ where: { id } });

    const all = await db.novaForexScalperConfig.findMany({ where: { userId: access.userId }, orderBy: { slot: "asc" } });
    return NextResponse.json({ success: true, configs: all.map((r: Record<string, unknown>) => toConfig(r)) });
  } catch (e) {
    console.error("nova-forex-scalper/config DELETE:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Delete failed." },
      { status: 500 }
    );
  }
}
