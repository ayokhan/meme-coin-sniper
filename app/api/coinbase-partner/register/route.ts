import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import {
  getCoinbasePartnerPromoForPublic,
  guestHashFromRequest,
  recordCoinbasePartnerLinkClick,
} from "@/lib/coinbase-partner-promo";

export const dynamic = "force-dynamic";

/** GET — record click and redirect to Coinbase register URL. */
export async function GET(request: Request) {
  const promo = await getCoinbasePartnerPromoForPublic();
  if (!promo.active || !promo.registerUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { userId } = await getSessionAndSubscription();
  await recordCoinbasePartnerLinkClick({
    userId: userId ?? null,
    guestHash: userId ? null : guestHashFromRequest(request),
  });

  try {
    const target = new URL(promo.registerUrl);
    return NextResponse.redirect(target.toString());
  } catch {
    return NextResponse.redirect(promo.registerUrl);
  }
}
