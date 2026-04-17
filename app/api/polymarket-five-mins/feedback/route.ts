import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeNovaFiveMinsHorizon, NOVA_FIVE_MINS_HORIZONS } from "@/lib/nova-five-mins-spot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OUTCOMES = ["matched", "missed", "n_a"] as const;
type Outcome = (typeof OUTCOMES)[number];

function isOutcome(s: string): s is Outcome {
  return (OUTCOMES as readonly string[]).includes(s);
}

/** POST — owner only: label whether the last lean matched reality (for future model training). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const outcomeRaw = String(body.outcome ?? "").trim();
    if (!isOutcome(outcomeRaw)) {
      return NextResponse.json(
        { success: false, error: `Invalid outcome. Use one of: ${OUTCOMES.join(", ")}.` },
        { status: 400 }
      );
    }

    const symbolInput = String(body.symbolInput ?? "").trim().slice(0, 64);
    const pair = String(body.pair ?? "").trim().slice(0, 32);
    if (!symbolInput || !pair) {
      return NextResponse.json({ success: false, error: "symbolInput and pair are required." }, { status: 400 });
    }

    const horizonMinutes = normalizeNovaFiveMinsHorizon(body.horizonMinutes);
    if (!NOVA_FIVE_MINS_HORIZONS.includes(horizonMinutes)) {
      return NextResponse.json({ success: false, error: "Invalid horizon." }, { status: 400 });
    }

    const direction = String(body.direction ?? "").trim();
    if (!["Up", "Down", "Unclear"].includes(direction)) {
      return NextResponse.json({ success: false, error: "Invalid direction." }, { status: 400 });
    }

    const convRaw = Number(body.convictionPct);
    const convictionPct = Number.isFinite(convRaw) ? Math.min(100, Math.max(0, Math.round(convRaw))) : null;
    const tapeRegime = body.tapeRegime != null ? String(body.tapeRegime).trim().slice(0, 32) || null : null;
    const lastClose = body.lastClose != null && Number.isFinite(Number(body.lastClose)) ? Number(body.lastClose) : null;
    const benchmarkOpen =
      body.benchmarkOpen != null && Number.isFinite(Number(body.benchmarkOpen)) ? Number(body.benchmarkOpen) : null;
    const feed = body.feed != null ? String(body.feed).trim().slice(0, 32) || null : null;
    const notes = body.notes != null ? String(body.notes).trim().slice(0, 4000) || null : null;
    const analysisSummary =
      body.analysisSummary != null ? String(body.analysisSummary).trim().slice(0, 8000) || null : null;

    await prisma.novaFiveMinsOwnerFeedback.create({
      data: {
        userId: session.user.id,
        symbolInput,
        pair,
        horizonMinutes,
        direction,
        convictionPct,
        tapeRegime,
        lastClose,
        benchmarkOpen,
        feed,
        outcome: outcomeRaw,
        notes,
        analysisSummary,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("polymarket-five-mins/feedback:", e);
    return NextResponse.json({ success: false, error: "Failed to save feedback." }, { status: 500 });
  }
}
