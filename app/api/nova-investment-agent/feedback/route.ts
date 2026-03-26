import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_INVESTMENT_AGENT);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Nova Investment Agent is temporarily disabled.", locked: true }, { status: 403 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const pinId = typeof body.pinId === "string" ? body.pinId.trim() : "";
    const worked = body.worked === true || body.worked === false ? body.worked : null;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

    if (!pinId || worked === null) {
      return NextResponse.json({ success: false, error: "Missing pinId or worked." }, { status: 400 });
    }

    const updated = await (prisma as any).novaInvestmentAgentPortfolioPin.update({
      where: { id: pinId },
      data: {
        ownerFeedbackWorked: worked,
        ownerFeedbackNote: note ? note : null,
        ownerFeedbackAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pin: { id: updated.id },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Feedback failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

