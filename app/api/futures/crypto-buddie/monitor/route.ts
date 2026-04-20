import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCryptoBuddieAccess } from "@/lib/vip-futures-addon-access";
import { runAiAnalysis } from "@/lib/ai-analyze";
import { runAiAnalysisBsc } from "@/lib/ai-analyze-bsc";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type AiSnapshot = {
  signal: string;
  score: number;
  tokenInfo: { priceUsd?: number | null; priceChange24hPct?: number };
};

function fingerprintFromAnalysis(r: AiSnapshot): string {
  const px = r.tokenInfo.priceUsd ?? 0;
  const ch = r.tokenInfo.priceChange24hPct ?? 0;
  return `${r.signal}|${r.score}|${px.toFixed(6)}|${ch.toFixed(2)}`;
}

type MonitorBody = {
  chain?: string;
  contract?: string;
  previousFingerprint?: string | null;
};

/**
 * VIP + Crypto Buddie flag: one AI token snapshot for Solana or BSC (same engine as AI Agent).
 * Client polls and compares `fingerprint` to prior — if it changes, suggest reassessing the trade.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getCryptoBuddieAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = (await request.json().catch(() => ({}))) as MonitorBody;
    const chain = body.chain === "bsc" ? "bsc" : "solana";
    const contract = String(body.contract ?? "").trim();
    if (!contract) {
      return NextResponse.json({ success: false, error: "Enter a contract address." }, { status: 400 });
    }

    const result = chain === "bsc" ? await runAiAnalysisBsc(contract) : await runAiAnalysis(contract);
    const fingerprint = fingerprintFromAnalysis(result);
    const prev = body.previousFingerprint?.trim() || null;
    const changed = !!prev && prev !== fingerprint;
    const suggestion = changed ? "reassess" : "hold";
    const message = changed
      ? "The AI snapshot changed since your last refresh — consider taking profit, tightening stops, or exiting; reassess before staying in."
      : "No material change in this AI snapshot versus the last poll — if your plan still matches the market, you might remain in the trade; always follow your own risk rules.";

    return NextResponse.json({
      success: true,
      chain,
      fingerprint,
      previousFingerprint: prev,
      snapshotChanged: changed,
      suggestion,
      message,
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crypto Buddie monitor failed";
    console.error("crypto-buddie/monitor:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
