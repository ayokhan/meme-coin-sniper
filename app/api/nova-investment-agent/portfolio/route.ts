import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

type NovaInvestmentAgentPinOwnerFeedback = {
  worked: boolean;
  note: string | null;
  at: string | null;
};

type NovaInvestmentAgentPortfolioPinResponse = {
  id: string;
  pinnedAt: string;
  result: unknown;
  ownerFeedback: NovaInvestmentAgentPinOwnerFeedback | null;
};

function formatOwnerFeedback(pin: { ownerFeedbackWorked: boolean | null; ownerFeedbackNote: string | null; ownerFeedbackAt: Date | null }): NovaInvestmentAgentPinOwnerFeedback | null {
  if (pin.ownerFeedbackWorked == null) return null;
  return {
    worked: !!pin.ownerFeedbackWorked,
    note: pin.ownerFeedbackNote ?? null,
    at: pin.ownerFeedbackAt ? pin.ownerFeedbackAt.toISOString() : null,
  };
}

function safeJsonResult(x: unknown): unknown {
  // Prisma JSON values are already structured; just pass through.
  return x;
}

export async function GET() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_INVESTMENT_AGENT);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Nova Investment Agent is temporarily disabled.", locked: true }, { status: 403 });
  }

  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) return NextResponse.json({ success: false, error: "Sign in to view portfolio.", locked: true }, { status: 401 });
    if (!isPaid) return NextResponse.json({ success: false, error: "Subscribe to use Nova Investment Agent.", locked: true }, { status: 403 });

    const pins = await (prisma as any).novaInvestmentAgentPortfolioPin.findMany({
      where: { userId },
      orderBy: { pinnedAt: "desc" },
      take: 50,
    });

    const mapped: NovaInvestmentAgentPortfolioPinResponse[] = (pins as any[]).map((p: any) => ({
      id: p.id,
      pinnedAt: p.pinnedAt.toISOString(),
      result: safeJsonResult(p.resultJson),
      ownerFeedback: formatOwnerFeedback(p),
    }));

    return NextResponse.json({ success: true, pins: mapped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load portfolio";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_INVESTMENT_AGENT);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Nova Investment Agent is temporarily disabled.", locked: true }, { status: 403 });
  }

  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) return NextResponse.json({ success: false, error: "Sign in to pin strategies.", locked: true }, { status: 401 });
    if (!isPaid) return NextResponse.json({ success: false, error: "Subscribe to pin strategies.", locked: true }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const result = body.result ?? body.strategy ?? body.pin;
    const baseSymbol = typeof body.baseSymbol === "string" ? body.baseSymbol : typeof result?.baseSymbol === "string" ? result.baseSymbol : null;

    if (!result || typeof result !== "object" || !baseSymbol) {
      return NextResponse.json({ success: false, error: "Missing strategy result." }, { status: 400 });
    }

    const amountUsd = typeof result.amountUsd === "number" ? result.amountUsd : Number(result.amountUsd);
    const riskProfitPreset = typeof result.riskProfitPreset === "string" ? result.riskProfitPreset : null;
    const durationMode = typeof result.durationMode === "string" ? result.durationMode : null;
    const totalExpectedReturnPct = typeof result.totalExpectedReturnPct === "number" ? result.totalExpectedReturnPct : Number(result.totalExpectedReturnPct);
    const totalExpectedReturnUsd = typeof result.totalExpectedReturnUsd === "number" ? result.totalExpectedReturnUsd : Number(result.totalExpectedReturnUsd);

    if (
      !Number.isFinite(amountUsd) ||
      !riskProfitPreset ||
      !durationMode ||
      !Number.isFinite(totalExpectedReturnPct) ||
      !Number.isFinite(totalExpectedReturnUsd)
    ) {
      return NextResponse.json({ success: false, error: "Invalid strategy result fields." }, { status: 400 });
    }

    const created = await (prisma as any).novaInvestmentAgentPortfolioPin.create({
      data: {
        userId,
        baseSymbol: baseSymbol.slice(0, 20),
        amountUsd,
        riskProfitPreset: riskProfitPreset.slice(0, 40),
        durationMode: durationMode.slice(0, 60),
        totalExpectedReturnPct,
        totalExpectedReturnUsd,
        resultJson: result as unknown as object,
        pinnedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pin: {
        id: created.id,
        pinnedAt: created.pinnedAt.toISOString(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to pin";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_INVESTMENT_AGENT);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Nova Investment Agent is temporarily disabled.", locked: true }, { status: 403 });
  }

  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) return NextResponse.json({ success: false, error: "Sign in to unpin.", locked: true }, { status: 401 });
    if (!isPaid) return NextResponse.json({ success: false, error: "Subscribe to unpin.", locked: true }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") ?? searchParams.get("pinId");
    if (!id) return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });

    await (prisma as any).novaInvestmentAgentPortfolioPin.deleteMany({
      where: { id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to unpin";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

