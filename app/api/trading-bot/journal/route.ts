import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { closedTradeToJournalPayload } from "@/lib/trading-bot-journal";
import { radarSnapshotMatchesTrade } from "@/lib/nova-radar-last-run";
import type { NovaRadarLastRunSnapshot } from "@/lib/nova-radar-last-run";
import { normalizeUnixMs, type ClosedTrade } from "@/lib/closed-trades";

function parseClosedAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const ms = normalizeUnixMs(raw);
  return ms != null ? new Date(ms) : null;
}

export const dynamic = "force-dynamic";

function rowToDto(row: {
  id: string;
  externalId: string | null;
  source: string;
  instId: string | null;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  leverage: number | null;
  positionNotionalUsdt: number | null;
  realizedPnlUsdt: number | null;
  roiPct: number | null;
  outcome: string;
  blofinMode: string | null;
  novaRadarSnapshot: string | null;
  notes: string | null;
  closedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.source,
    instId: row.instId,
    symbol: row.symbol,
    side: row.side,
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    takeProfitPrice: row.takeProfitPrice,
    stopLossPrice: row.stopLossPrice,
    leverage: row.leverage,
    positionNotionalUsdt: row.positionNotionalUsdt,
    realizedPnlUsdt: row.realizedPnlUsdt,
    roiPct: row.roiPct,
    outcome: row.outcome,
    blofinMode: row.blofinMode,
    novaRadarSnapshot: row.novaRadarSnapshot,
    notes: row.notes,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** GET — list journal entries for the signed-in user. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading bot access required." }, { status: 403 });
    }
    const limit = Math.min(100, Math.max(1, parseInt(new URL(req.url).searchParams.get("limit") ?? "50", 10) || 50));

    const rows = await prisma.tradingBotJournalEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      entries: rows.map((row) => rowToDto(row as Parameters<typeof rowToDto>[0])),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load journal";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST — create manual entry, sync closed trades, or save NovaRadar snapshot. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading bot access required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = session.user.id;

    if (body.action === "sync" && Array.isArray(body.trades)) {
      let created = 0;
      let skipped = 0;
      const mode = body.blofinMode === "live" ? "live" : "demo";
      const snapshotRaw = body.novaRadarSnapshot as NovaRadarLastRunSnapshot | null | undefined;
      const snapshotJson =
        snapshotRaw != null && typeof snapshotRaw === "object" ? JSON.stringify(snapshotRaw) : null;
      for (const raw of body.trades as ClosedTrade[]) {
        if (!raw?.id || !raw.displaySymbol) continue;
        const payload = closedTradeToJournalPayload(raw, mode);
        const attachSnapshot =
          snapshotJson != null && radarSnapshotMatchesTrade(snapshotRaw ?? null, payload.symbol);
        try {
          await prisma.tradingBotJournalEntry.upsert({
            where: {
              userId_externalId: { userId, externalId: payload.externalId },
            },
            create: {
              userId,
              externalId: payload.externalId,
              source: payload.source,
              instId: payload.instId,
              symbol: payload.symbol,
              side: payload.side,
              entryPrice: payload.entryPrice,
              exitPrice: payload.exitPrice,
              leverage: Number.isFinite(payload.leverage) ? Math.round(payload.leverage) : null,
              realizedPnlUsdt: payload.realizedPnlUsdt,
              roiPct: payload.roiPct,
              outcome: payload.outcome,
              blofinMode: payload.blofinMode,
              closedAt: parseClosedAt(payload.closedAt),
              notes: payload.notes,
              novaRadarSnapshot: attachSnapshot ? snapshotJson : null,
            },
            update: {
              exitPrice: payload.exitPrice,
              realizedPnlUsdt: payload.realizedPnlUsdt,
              roiPct: payload.roiPct,
              outcome: payload.outcome,
              closedAt: parseClosedAt(payload.closedAt),
              ...(attachSnapshot ? { novaRadarSnapshot: snapshotJson } : {}),
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }
      return NextResponse.json({ success: true, synced: created, skipped });
    }

    const symbol = String(body.symbol ?? "").trim();
    const side = String(body.side ?? "long").toLowerCase() === "short" ? "short" : "long";
    const entryPrice = Number(body.entryPrice);
    if (!symbol || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      return NextResponse.json({ success: false, error: "symbol and entryPrice required." }, { status: 400 });
    }

    const row = await prisma.tradingBotJournalEntry.create({
      data: {
        userId,
        externalId: body.externalId != null ? String(body.externalId) : null,
        source: String(body.source ?? "manual"),
        instId: body.instId != null ? String(body.instId) : null,
        symbol,
        side,
        entryPrice,
        exitPrice: body.exitPrice != null ? Number(body.exitPrice) : null,
        takeProfitPrice: body.takeProfitPrice != null ? Number(body.takeProfitPrice) : null,
        stopLossPrice: body.stopLossPrice != null ? Number(body.stopLossPrice) : null,
        leverage: body.leverage != null ? Math.round(Number(body.leverage)) : null,
        positionNotionalUsdt:
          body.positionNotionalUsdt != null ? Number(body.positionNotionalUsdt) : null,
        realizedPnlUsdt: body.realizedPnlUsdt != null ? Number(body.realizedPnlUsdt) : null,
        roiPct: body.roiPct != null ? Number(body.roiPct) : null,
        outcome: String(body.outcome ?? "open"),
        blofinMode: body.blofinMode != null ? String(body.blofinMode) : null,
        novaRadarSnapshot:
          body.novaRadarSnapshot != null ? JSON.stringify(body.novaRadarSnapshot) : null,
        notes: body.notes != null ? String(body.notes) : null,
        closedAt: body.closedAt != null ? new Date(body.closedAt) : null,
      },
    });

    return NextResponse.json({
      success: true,
      entry: rowToDto(row as Parameters<typeof rowToDto>[0]),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save journal entry";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH — update notes on an entry. */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading bot access required." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    const data: { notes?: string } = {};
    if (body.notes != null) data.notes = String(body.notes);

    const row = await prisma.tradingBotJournalEntry.updateMany({
      where: { id, userId: session.user.id },
      data,
    });
    if (row.count === 0) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }
    const updated = await prisma.tradingBotJournalEntry.findUnique({ where: { id } });
    return NextResponse.json({
      success: true,
      entry: updated ? rowToDto(updated as Parameters<typeof rowToDto>[0]) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE — remove journal entry. */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading bot access required." }, { status: 403 });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    await prisma.tradingBotJournalEntry.deleteMany({
      where: { id, userId: session.user.id },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
