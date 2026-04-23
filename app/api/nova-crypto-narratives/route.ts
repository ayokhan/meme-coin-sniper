import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildNovaCryptoNarratives } from "@/lib/nova-crypto-narratives";
import { getNovaFuturesNarrativesAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** VIP: narrative + CFTC / news scan (standalone tab). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaFuturesNarrativesAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error ?? "Nova Futures Narratives is for VIP subscribers.",
          locked: true,
          disabled: access.disabled,
        },
        { status: access.status ?? 403 }
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
