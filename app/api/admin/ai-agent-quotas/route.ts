import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getGlobalAiAgentQuotas, setGlobalAiAgentQuotas } from "@/lib/ai-agent-quota";

function parseOptionalLimit(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1000, Math.round(n)));
}

/** GET — global free-tier limits. Owner only. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const quotas = await getGlobalAiAgentQuotas();
  return NextResponse.json({ success: true, quotas });
}

/** PATCH — update global free-tier limits. Owner only. */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const memeDaily = Number(body.memeAgentFreeDailyLimit);
  const chartDaily = Number(body.chartAnalysisFreeDailyLimit);
  if (!Number.isFinite(memeDaily) || !Number.isFinite(chartDaily)) {
    return NextResponse.json({ success: false, error: "Invalid daily limits." }, { status: 400 });
  }

  const memeWeekly = parseOptionalLimit(body.memeAgentFreeWeeklyLimit);
  const memeMonthly = parseOptionalLimit(body.memeAgentFreeMonthlyLimit);
  const chartWeekly = parseOptionalLimit(body.chartAnalysisFreeWeeklyLimit);
  const chartMonthly = parseOptionalLimit(body.chartAnalysisFreeMonthlyLimit);

  if (
    memeWeekly === undefined ||
    memeMonthly === undefined ||
    chartWeekly === undefined ||
    chartMonthly === undefined
  ) {
    return NextResponse.json({ success: false, error: "Invalid weekly or monthly limits." }, { status: 400 });
  }

  await setGlobalAiAgentQuotas({
    memeAgentFreeDailyLimit: memeDaily,
    memeAgentFreeWeeklyLimit: memeWeekly,
    memeAgentFreeMonthlyLimit: memeMonthly,
    chartAnalysisFreeDailyLimit: chartDaily,
    chartAnalysisFreeWeeklyLimit: chartWeekly,
    chartAnalysisFreeMonthlyLimit: chartMonthly,
  });
  const quotas = await getGlobalAiAgentQuotas();
  return NextResponse.json({ success: true, quotas });
}
