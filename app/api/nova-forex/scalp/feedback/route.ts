import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNovaForexScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";

const OUTCOMES = ["win", "loss", "scratch", "skipped"] as const;
type Outcome = (typeof OUTCOMES)[number];

function isOutcome(s: string): s is Outcome {
  return (OUTCOMES as readonly string[]).includes(s);
}

/** POST — record whether user entered a Nova Forex Scalp plan and how it went. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbol = String(body.symbol ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 32);
    const timeframeId = String(body.timeframeId ?? "")
      .trim()
      .slice(0, 16);
    const side = String(body.side ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 16);
    const entered = body.entered === true;
    const outcomeRaw = body.outcome != null ? String(body.outcome).trim() : null;

    if (!symbol || !timeframeId || !["long", "short", "no_entry"].includes(side)) {
      return NextResponse.json({ success: false, error: "Invalid plan fields." }, { status: 400 });
    }

    if (outcomeRaw && !isOutcome(outcomeRaw)) {
      return NextResponse.json(
        { success: false, error: `Invalid outcome. Use: ${OUTCOMES.join(", ")}.` },
        { status: 400 }
      );
    }

    if (!entered && outcomeRaw && outcomeRaw !== "skipped") {
      return NextResponse.json(
        { success: false, error: "Outcome win/loss/scratch requires entered=true." },
        { status: 400 }
      );
    }

    const num = (v: unknown) =>
      v != null && Number.isFinite(Number(v)) ? Number(v) : null;
    const analyzedAt =
      body.analyzedAt != null ? String(body.analyzedAt).trim().slice(0, 64) || null : null;
    const note = body.note != null ? String(body.note).trim().slice(0, 500) || null : null;

    await prisma.novaScalpPlanFeedback.create({
      data: {
        userId: access.userId,
        symbol,
        timeframeId,
        side,
        entered,
        outcome: outcomeRaw,
        entryPrice: num(body.entryPrice),
        exitPrice: num(body.exitPrice),
        stopLossPrice: num(body.stopLossPrice),
        amountUsd: num(body.amountUsd),
        leverage:
          body.leverage != null && Number.isFinite(Number(body.leverage))
            ? Math.round(Number(body.leverage))
            : null,
        analyzedAt,
        note,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("nova-forex/scalp/feedback:", e);
    return NextResponse.json({ success: false, error: "Failed to save feedback." }, { status: 500 });
  }
}
