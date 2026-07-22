import { NextResponse } from "next/server";
import {
  FOREX_BROKER_PARTNER_IDS,
  getAllForexBrokerPartnerPromosForAdmin,
  getForexBrokerPartnerPromoForPublic,
} from "@/lib/forex-broker-partner-promo";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";

export const dynamic = "force-dynamic";

function isValidBroker(v: unknown): v is ForexBrokerId {
  return typeof v === "string" && (FOREX_BROKER_PARTNER_IDS as string[]).includes(v);
}

function toPublic(promo: Awaited<ReturnType<typeof getForexBrokerPartnerPromoForPublic>>) {
  return {
    broker: promo.broker,
    enabled: promo.enabled,
    active: promo.active,
    headline: promo.headline,
    bodyText: promo.bodyText,
    promoLabel: promo.promoLabel,
    ctaLabel: promo.ctaLabel,
    showLogosInBanner: promo.showLogosInBanner,
  };
}

/** GET ?broker=vantage|tiomarkets for one broker, or no query for all active. */
export async function GET(request: Request) {
  try {
    const broker = new URL(request.url).searchParams.get("broker");
    if (broker) {
      if (!isValidBroker(broker)) {
        return NextResponse.json(
          { success: false, error: `broker must be one of: ${FOREX_BROKER_PARTNER_IDS.join(", ")}` },
          { status: 400 }
        );
      }
      const promo = await getForexBrokerPartnerPromoForPublic(broker);
      return NextResponse.json({ success: true, promo: toPublic(promo) });
    }
    const promos = await getAllForexBrokerPartnerPromosForAdmin();
    return NextResponse.json({ success: true, promos: promos.map(toPublic) });
  } catch (e) {
    console.error("forex-broker-partner-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load promo." }, { status: 500 });
  }
}
