import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  FOREX_BROKER_LAUNCH_BANNER,
  FOREX_BROKER_PARTNER_IDS,
  getAllForexBrokerPartnerPromosForAdmin,
  getForexBrokerPartnerPromoForAdmin,
  listForexBrokerPartnerLinkClicks,
  resetForexBrokerPartnerPromoToDefault,
  setForexBrokerPartnerPromo,
  type ForexBrokerPartnerPromoConfig,
} from "@/lib/forex-broker-partner-promo";
import { setSiteAnnouncementBanner } from "@/lib/site-announcement-banner";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";

export const dynamic = "force-dynamic";

function isValidBroker(v: unknown): v is ForexBrokerId {
  return typeof v === "string" && (FOREX_BROKER_PARTNER_IDS as string[]).includes(v);
}

/** GET ?broker= for one broker + its clicks, or no query for all brokers + all clicks. Owner only. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const broker = new URL(request.url).searchParams.get("broker");
    if (broker) {
      if (!isValidBroker(broker)) {
        return NextResponse.json(
          { success: false, error: `broker must be one of: ${FOREX_BROKER_PARTNER_IDS.join(", ")}` },
          { status: 400 }
        );
      }
      const promo = await getForexBrokerPartnerPromoForAdmin(broker);
      const clicks = await listForexBrokerPartnerLinkClicks(broker, 100);
      return NextResponse.json({ success: true, promo, clicks });
    }
    const promos = await getAllForexBrokerPartnerPromosForAdmin();
    const clicks = await listForexBrokerPartnerLinkClicks(undefined, 100);
    return NextResponse.json({ success: true, promos, clicks });
  } catch (e) {
    console.error("admin forex-broker-partner-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load forex broker partner promo." }, { status: 500 });
  }
}

/** PATCH — body must include broker. Supports resetToDefault and publishLaunchBroadcast per broker. Owner only. */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<ForexBrokerPartnerPromoConfig> & {
      broker?: string;
      resetToDefault?: boolean;
      publishLaunchBroadcast?: boolean;
    };

    if (!isValidBroker(body.broker)) {
      return NextResponse.json(
        { success: false, error: `broker must be one of: ${FOREX_BROKER_PARTNER_IDS.join(", ")}` },
        { status: 400 }
      );
    }
    const broker = body.broker;

    if (body.resetToDefault) {
      const promo = await resetForexBrokerPartnerPromoToDefault(broker);
      return NextResponse.json({ success: true, promo });
    }

    if (body.publishLaunchBroadcast) {
      const { resetToDefault: _r, publishLaunchBroadcast: _p, broker: _b, ...patch } = body;
      const promo = await setForexBrokerPartnerPromo(broker, patch);
      await setSiteAnnouncementBanner({
        ...FOREX_BROKER_LAUNCH_BANNER[broker],
        showPartnerLogos: promo.includeLogosInBroadcast,
      });
      return NextResponse.json({ success: true, promo, broadcastPublished: true });
    }

    const { resetToDefault: _, publishLaunchBroadcast: __, broker: _b2, ...patch } = body;
    const promo = await setForexBrokerPartnerPromo(broker, patch);
    return NextResponse.json({ success: true, promo });
  } catch (e) {
    console.error("admin forex-broker-partner-promo PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update forex broker partner promo." },
      { status: 400 }
    );
  }
}
