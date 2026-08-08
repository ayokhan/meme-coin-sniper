import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemeLeaderboardAccess } from "@/lib/meme-leaderboard-access";
import { analyzeSolanaWallet } from "@/lib/wallet-analyzer/solana";
import { analyzeBscWallet } from "@/lib/wallet-analyzer/bsc";
import type { AnalyzerChain, AnalyzerPeriod } from "@/lib/wallet-analyzer/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_PERIODS = new Set<AnalyzerPeriod>(["30m", "1h", "2h", "4h", "8h", "24h", "7d", "30d"]);

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function inferChain(address: string): AnalyzerChain | null {
  const a = address.trim();
  if (isValidEvmAddress(a)) return "bsc";
  if (isValidSolanaAddress(a)) return "solana";
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getMemeLeaderboardAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, disabled: access.disabled === true, locked: access.locked === true },
      { status: access.status },
    );
  }
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { trialDeskLimitResponse } = await import("@/lib/trial-desk-gate");
  const blocked = await trialDeskLimitResponse(userId, "wallets");
  if (blocked) return blocked;

  let body: { address?: string; chain?: string; period?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const address = (body.address ?? "").trim();
  if (!address) {
    return NextResponse.json({ success: false, error: "Wallet address is required." }, { status: 400 });
  }

  let chain: AnalyzerChain | null = null;
  const chainRaw = (body.chain ?? "").toLowerCase();
  if (chainRaw === "solana" || chainRaw === "bsc") {
    chain = chainRaw;
  } else {
    chain = inferChain(address);
  }
  if (!chain) {
    return NextResponse.json(
      { success: false, error: "Could not detect chain. Provide a valid Solana (base58) or BSC (0x...) wallet address." },
      { status: 400 },
    );
  }
  if (chain === "solana" && !isValidSolanaAddress(address)) {
    return NextResponse.json({ success: false, error: "Invalid Solana wallet address." }, { status: 400 });
  }
  if (chain === "bsc" && !isValidEvmAddress(address)) {
    return NextResponse.json({ success: false, error: "Invalid BSC wallet address (must be 0x… 40 hex chars)." }, { status: 400 });
  }

  const periodRaw = ((body.period ?? "7d") as string).toLowerCase() as AnalyzerPeriod;
  const period: AnalyzerPeriod = ALLOWED_PERIODS.has(periodRaw) ? periodRaw : "7d";

  try {
    const analysis = chain === "solana"
      ? await analyzeSolanaWallet(address, period)
      : await analyzeBscWallet(address, period);
    return NextResponse.json({ success: true, analysis });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Analyzer failed." },
      { status: 500 },
    );
  }
}
