import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { runAiAnalysis } from "@/lib/ai-analyze";
import { runAiAnalysisEvm } from "@/lib/ai-analyze-bsc";
import { canUseAiAnalysisRag } from "@/lib/ai-analysis-rag-access";
import { assertAiAgentAccess, recordAiAgentUsage } from "@/lib/ai-agent-quota";
import {
  resolveMemeAgentContract,
  type MemeAgentChainMode,
} from "@/lib/meme-contract-detect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseChainMode(raw: unknown): MemeAgentChainMode {
  if (
    raw === "solana" ||
    raw === "bsc" ||
    raw === "ethereum" ||
    raw === "robinhood" ||
    raw === "hyperevm" ||
    raw === "auto"
  ) {
    return raw;
  }
  return "auto";
}

export async function POST(request: Request) {
  try {
    const { session, isPaid, userId, tier } = await getSessionAndSubscription();
    const access = await assertAiAgentAccess(session, isPaid, "meme_agent");
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          locked: access.locked,
          limitReached: access.limitReached,
          used: access.used,
          limit: access.limit,
        },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = String(body.contractAddress ?? body.ca ?? "").trim();
    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: "Missing contractAddress or ca in request body." },
        { status: 400 }
      );
    }

    const resolved = await resolveMemeAgentContract(contractAddress, parseChainMode(body.chain));
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: 400 });
    }

    const amountUsd =
      typeof body.amountUsd === "number" && Number.isFinite(body.amountUsd) && body.amountUsd > 0
        ? body.amountUsd
        : undefined;

    const useRag = resolved.chain === "solana" ? await canUseAiAnalysisRag(session, tier) : false;

    if (resolved.chain === "solana") {
      const result = await runAiAnalysis(resolved.contractAddress, {
        ...(amountUsd != null ? { amountUsd } : {}),
        ...(useRag && userId ? { useRag: true, ragUserId: userId } : {}),
      });
      if (userId) await recordAiAgentUsage(userId, "meme_agent").catch(() => {});
      return NextResponse.json({
        success: true,
        resolvedChain: resolved.chain,
        score: result.score,
        signal: result.signal,
        reasons: result.reasons,
        narrativeAssessment: result.narrativeAssessment,
        amountRiskNote: result.amountRiskNote,
        recommendations: result.recommendations,
        tokenInfo: { ...result.tokenInfo, chain: resolved.chain },
        ragEnabled: useRag,
        ragUsed: useRag ? (result.rag?.used ?? false) : false,
        ragConfigured: useRag ? (result.rag?.configured ?? false) : false,
        ragSnippets: useRag && result.rag?.snippets?.length ? result.rag.snippets : undefined,
      });
    }

    const result = await runAiAnalysisEvm(
      resolved.contractAddress,
      resolved.chain,
      amountUsd != null ? { amountUsd } : undefined
    );
    if (userId) await recordAiAgentUsage(userId, "meme_agent").catch(() => {});

    return NextResponse.json({
      success: true,
      resolvedChain: resolved.chain,
      score: result.score,
      signal: result.signal,
      reasons: result.reasons,
      narrativeAssessment: result.narrativeAssessment,
      amountRiskNote: result.amountRiskNote,
      recommendations: result.recommendations,
      tokenInfo: { ...result.tokenInfo, chain: resolved.chain },
      ragEnabled: false,
      ragUsed: false,
      ragConfigured: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "NovaStaris AI Agent failed";
    console.error("AI analyze-token error:", error);
    const isOverloaded = /overloaded|529/i.test(message);
    const friendlyMessage = isOverloaded
      ? "AI is temporarily overloaded. Please try again in a minute."
      : message;
    const status = message.includes("not found") ? 404 : message.includes("not configured") ? 503 : isOverloaded ? 503 : 500;
    return NextResponse.json({ success: false, error: friendlyMessage }, { status });
  }
}
