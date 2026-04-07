import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { buildNovaCryptoNarratives } from "@/lib/nova-crypto-narratives";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pro + VIP: narrative + CFTC / news scan for Crypto Futures tab. */
export async function POST(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json(
        {
          success: false,
          error: "Nova Crypto Narratives is for Pro and VIP subscribers.",
          locked: true,
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = String(body.symbol ?? "BTC").trim();
    if (!symbol) {
      return NextResponse.json({ success: false, error: "Enter a contract symbol (e.g. BTC)." }, { status: 400 });
    }

    const result = await buildNovaCryptoNarratives(symbol);
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Crypto Narratives failed";
    console.error("nova-crypto-narratives:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
