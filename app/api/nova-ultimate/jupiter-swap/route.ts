import { NextResponse } from "next/server";
import axios from "axios";
import { assertNovaUltimateApiAccess } from "@/lib/nova-ultimate-server";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const JUPITER_SWAP = "https://quote-api.jup.ag/v6/swap";

/** POST { quoteResponse, userPublicKey } — returns unsigned swapTransaction (base64) for Phantom to sign. */
export async function POST(request: Request) {
  try {
    const gate = await assertNovaUltimateApiAccess();
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const quoteResponse = body.quoteResponse;
    const userPublicKey = String(body.userPublicKey ?? "").trim();

    if (!quoteResponse || typeof quoteResponse !== "object") {
      return NextResponse.json({ success: false, error: "quoteResponse required." }, { status: 400 });
    }
    if (!userPublicKey || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(userPublicKey)) {
      return NextResponse.json({ success: false, error: "Valid userPublicKey required." }, { status: 400 });
    }

    const res = await axios.post(
      JUPITER_SWAP,
      {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      },
      { timeout: 30000, headers: { "Content-Type": "application/json" } }
    );

    const swapTransaction = res.data?.swapTransaction;
    if (!swapTransaction || typeof swapTransaction !== "string") {
      return NextResponse.json({ success: false, error: "No swap transaction from Jupiter." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      swapTransaction,
      lastValidBlockHeight: res.data?.lastValidBlockHeight,
    });
  } catch (e: unknown) {
    const message =
      e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Jupiter swap build failed"
        : e instanceof Error
          ? e.message
          : "Swap build failed";
    console.error("nova-ultimate/jupiter-swap:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
