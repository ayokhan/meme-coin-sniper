import { NextResponse } from "next/server";
import { getCoinbasePartnerPromoForPublic } from "@/lib/coinbase-partner-promo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const promo = await getCoinbasePartnerPromoForPublic();
    const publicPromo = {
      enabled: promo.enabled,
      active: promo.active,
      headline: promo.headline,
      bodyText: promo.bodyText,
      promoLabel: promo.promoLabel,
      ctaLabel: promo.ctaLabel,
      referralCode: promo.referralCode,
      showLogosInBanner: promo.showLogosInBanner,
    };
    return NextResponse.json({ success: true, promo: publicPromo });
  } catch (e) {
    console.error("coinbase-partner-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load promo." }, { status: 500 });
  }
}
