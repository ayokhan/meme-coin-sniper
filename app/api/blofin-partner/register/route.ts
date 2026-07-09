import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import {
  getBlofinPartnerPromoForPublic,
  guestHashFromRequest,
  recordBlofinPartnerLinkClick,
} from "@/lib/blofin-partner-promo";

export const dynamic = "force-dynamic";

/** GET — record click and redirect to Blofin affiliate register URL. */
export async function GET(request: Request) {
  const promo = await getBlofinPartnerPromoForPublic();
  if (!promo.active || !promo.registerUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { userId } = await getSessionAndSubscription();
  await recordBlofinPartnerLinkClick({
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
