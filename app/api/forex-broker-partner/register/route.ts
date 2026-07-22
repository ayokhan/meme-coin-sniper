import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import {
  FOREX_BROKER_PARTNER_IDS,
  getForexBrokerPartnerPromoForPublic,
  guestHashFromRequest,
  recordForexBrokerPartnerLinkClick,
} from "@/lib/forex-broker-partner-promo";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";

export const dynamic = "force-dynamic";

function isValidBroker(v: unknown): v is ForexBrokerId {
  return typeof v === "string" && (FOREX_BROKER_PARTNER_IDS as string[]).includes(v);
}

/** GET ?broker= — record click and redirect to the broker's affiliate register URL. */
export async function GET(request: Request) {
  const broker = new URL(request.url).searchParams.get("broker");
  if (!isValidBroker(broker)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const promo = await getForexBrokerPartnerPromoForPublic(broker);
  if (!promo.active || !promo.registerUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { userId } = await getSessionAndSubscription();
  await recordForexBrokerPartnerLinkClick({
    broker,
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
