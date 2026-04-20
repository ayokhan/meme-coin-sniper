import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { runAiAnalysis } from "@/lib/ai-analyze";
import { runAiAnalysisBsc } from "@/lib/ai-analyze-bsc";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

function isValidBscAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

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

type Body = {
  chain?: string;
  contract?: string;
  previousFingerprint?: string | null;
  amountUsd?: number;
};

/**
 * Paid subscribers: poll-friendly full token AI snapshot (same engine as Analyze).
 * Compare `fingerprint` across polls for exit vs hold messaging — does not increment pin usage.
 */
export async function POST(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: "Subscribe to use NovaStaris AI Agent.", locked: true }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const chain = body.chain === "bsc" ? "bsc" : "solana";
    const contract = String(body.contract ?? "").trim();
    if (!contract) {
      return NextResponse.json({ success: false, error: "Enter a contract address." }, { status: 400 });
    }

    const amountUsd =
      typeof body.amountUsd === "number" && Number.isFinite(body.amountUsd) && body.amountUsd > 0 ? body.amountUsd : undefined;

    if (chain === "bsc") {
      if (!isValidBscAddress(contract)) {
        return NextResponse.json({ success: false, error: "Invalid BSC contract address (0x + 40 hex)." }, { status: 400 });
      }
    } else if (!isValidSolanaAddress(contract)) {
      return NextResponse.json({ success: false, error: "Invalid Solana contract address." }, { status: 400 });
    }

    const result = chain === "bsc" ? await runAiAnalysisBsc(contract, amountUsd != null ? { amountUsd } : undefined) : await runAiAnalysis(contract, amountUsd != null ? { amountUsd } : undefined);

    const fingerprint = fingerprintFromAnalysis(result);
    const prev = typeof body.previousFingerprint === "string" ? body.previousFingerprint.trim() : "";
    const changed = !!prev && prev !== fingerprint;
    const message = changed
      ? "The AI snapshot changed since your last refresh — consider taking profit, tightening stops, or exiting; reassess before staying in."
      : "No material change in this AI snapshot versus the last poll — if your plan still matches the market, you might remain in the trade; always follow your own risk rules.";

    return NextResponse.json({
      success: true,
      chain,
      fingerprint,
      previousFingerprint: prev || null,
      snapshotChanged: changed,
      suggestion: changed ? "reassess" : "hold",
      message,
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI monitor failed";
    console.error("ai-analyze-monitor:", e);
    const isOverloaded = /overloaded|529/i.test(message);
    const friendly = isOverloaded ? "AI is temporarily overloaded. Please try again in a minute." : message;
    const status = message.includes("not found") ? 404 : message.includes("not configured") ? 503 : isOverloaded ? 503 : 500;
    return NextResponse.json({ success: false, error: friendly }, { status });
  }
}
