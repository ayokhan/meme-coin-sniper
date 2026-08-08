import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeepMemeAgentAccess } from "@/lib/deep-meme-agent-access";
import { runDeepMemeAnalysis } from "@/lib/deep-meme-agent/analyze";
import type { DeepChain } from "@/lib/deep-meme-agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_CHAINS = new Set<DeepChain | "auto">(["auto", "solana", "bsc", "ethereum"]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getDeepMemeAgentAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      {
        success: false,
        error: access.error,
        disabled: access.disabled === true,
        locked: access.locked === true,
      },
      { status: access.status },
    );
  }
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { trialDeskLimitResponse } = await import("@/lib/trial-desk-gate");
  const blocked = await trialDeskLimitResponse(userId, "wallets");
  if (blocked) return blocked;

  let body: { contract?: string; chain?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const contract = String(body.contract ?? "").trim();
  if (!contract) {
    return NextResponse.json({ success: false, error: "Contract address is required." }, { status: 400 });
  }
  const chainParam = (body.chain ?? "auto") as DeepChain | "auto";
  if (!ALLOWED_CHAINS.has(chainParam)) {
    return NextResponse.json({ success: false, error: "Invalid chain." }, { status: 400 });
  }

  try {
    const result = await runDeepMemeAnalysis(contract, chainParam);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status ?? 400 },
      );
    }
    return NextResponse.json({ success: true, report: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Deep Meme analysis failed." },
      { status: 500 },
    );
  }
}
