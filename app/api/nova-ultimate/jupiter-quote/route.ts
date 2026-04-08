import { NextResponse } from "next/server";
import axios from "axios";
import { assertNovaUltimateApiAccess } from "@/lib/nova-ultimate-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const JUPITER_QUOTE = "https://quote-api.jup.ag/v6/quote";
const SOL_DECIMALS = 9;
const DEFAULT_TOKEN_DECIMALS = 6;

/** POST { tokenMint, amountSol?, direction?: 'buy'|'sell', slippageBps? } — VIP + Nova Ultimate on-demand. */
export async function POST(request: Request) {
  try {
    const gate = await assertNovaUltimateApiAccess();
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const tokenMint = String(body.tokenMint ?? "").trim();
    const direction = body.direction === "sell" ? "sell" : "buy";
    const amountRaw = body.amountSol ?? body.amount;
    const slippageBps = Math.min(5000, Math.max(1, Number(body.slippageBps) || 100));

    if (!tokenMint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenMint)) {
      return NextResponse.json({ success: false, error: "Invalid token mint." }, { status: 400 });
    }

    const amountNum = Number(amountRaw);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount (SOL for buys, token amount for sells)." }, { status: 400 });
    }

    const inputMint = direction === "buy" ? "So11111111111111111111111111111111111111112" : tokenMint;
    const outputMint = direction === "buy" ? tokenMint : "So11111111111111111111111111111111111111112";
    const amountInSmallestUnits =
      direction === "buy"
        ? Math.floor(amountNum * Math.pow(10, SOL_DECIMALS))
        : Math.floor(amountNum * Math.pow(10, DEFAULT_TOKEN_DECIMALS));

    const res = await axios.get(JUPITER_QUOTE, {
      params: {
        inputMint,
        outputMint,
        amount: amountInSmallestUnits.toString(),
        slippageBps,
      },
      timeout: 20000,
    });

    const data = res.data;
    if (!data) return NextResponse.json({ success: false, error: "Empty Jupiter response." }, { status: 502 });

    return NextResponse.json({
      success: true,
      quoteResponse: data,
    });
  } catch (e: unknown) {
    const message =
      e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Jupiter quote failed"
        : e instanceof Error
          ? e.message
          : "Quote failed";
    console.error("nova-ultimate/jupiter-quote:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
