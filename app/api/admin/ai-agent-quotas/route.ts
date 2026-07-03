import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getGlobalAiAgentQuotas, setGlobalAiAgentQuotas } from "@/lib/ai-agent-quota";

/** GET — global free-tier daily limits. Owner only. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const quotas = await getGlobalAiAgentQuotas();
  return NextResponse.json({ success: true, quotas });
}

/** PATCH — update global free-tier daily limits. Owner only. */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const meme = Number(body.memeAgentFreeDailyLimit);
  const chart = Number(body.chartAnalysisFreeDailyLimit);
  if (!Number.isFinite(meme) || !Number.isFinite(chart)) {
    return NextResponse.json({ success: false, error: "Invalid limits." }, { status: 400 });
  }
  await setGlobalAiAgentQuotas({
    memeAgentFreeDailyLimit: meme,
    chartAnalysisFreeDailyLimit: chart,
  });
  const quotas = await getGlobalAiAgentQuotas();
  return NextResponse.json({ success: true, quotas });
}
