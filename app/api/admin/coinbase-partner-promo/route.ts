import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  COINBASE_PARTNERSHIP_LAUNCH_BANNER,
  getCoinbasePartnerPromoForAdmin,
  listCoinbasePartnerLinkClicks,
  setCoinbasePartnerPromo,
  type CoinbasePartnerPromoConfig,
} from "@/lib/coinbase-partner-promo";
import { setSiteAnnouncementBanner } from "@/lib/site-announcement-banner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const promo = await getCoinbasePartnerPromoForAdmin();
    const clicks = await listCoinbasePartnerLinkClicks(100);
    return NextResponse.json({ success: true, promo, clicks });
  } catch (e) {
    console.error("admin coinbase-partner-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load Coinbase partner promo." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<CoinbasePartnerPromoConfig> & {
      publishLaunchBroadcast?: boolean;
    };

    if (body.publishLaunchBroadcast) {
      const { publishLaunchBroadcast: _p, ...patch } = body;
      const promo = await setCoinbasePartnerPromo(patch);
      await setSiteAnnouncementBanner({
        ...COINBASE_PARTNERSHIP_LAUNCH_BANNER,
        showPartnerLogos: promo.includeLogosInBroadcast,
        partnerBrand: "coinbase",
      });
      return NextResponse.json({ success: true, promo, broadcastPublished: true });
    }

    const { publishLaunchBroadcast: _, ...patch } = body;
    const promo = await setCoinbasePartnerPromo(patch);
    return NextResponse.json({ success: true, promo });
  } catch (e) {
    console.error("admin coinbase-partner-promo PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update Coinbase partner promo." },
      { status: 400 }
    );
  }
}
