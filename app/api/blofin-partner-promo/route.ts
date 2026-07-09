import { NextResponse } from "next/server";
import { getBlofinPartnerPromoForPublic } from "@/lib/blofin-partner-promo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const promo = await getBlofinPartnerPromoForPublic();
    const publicPromo = {
      enabled: promo.enabled,
      active: promo.active,
      headline: promo.headline,
      bodyText: promo.bodyText,
      promoLabel: promo.promoLabel,
      ctaLabel: promo.ctaLabel,
    };
    return NextResponse.json({ success: true, promo: publicPromo });
  } catch (e) {
    console.error("blofin-partner-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load promo." }, { status: 500 });
  }
}
