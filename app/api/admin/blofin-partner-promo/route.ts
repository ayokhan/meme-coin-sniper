import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getBlofinPartnerPromoForAdmin,
  listBlofinPartnerLinkClicks,
  resetBlofinPartnerPromoToDefault,
  setBlofinPartnerPromo,
  type BlofinPartnerPromoConfig,
} from "@/lib/blofin-partner-promo";
import { BLOFIN_PARTNERSHIP_LAUNCH_BANNER } from "@/lib/blofin-partner-promo";
import { setSiteAnnouncementBanner } from "@/lib/site-announcement-banner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const promo = await getBlofinPartnerPromoForAdmin();
    const clicks = await listBlofinPartnerLinkClicks(100);
    return NextResponse.json({ success: true, promo, clicks });
  } catch (e) {
    console.error("admin blofin-partner-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load Blofin partner promo." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<BlofinPartnerPromoConfig> & {
      resetToDefault?: boolean;
      publishLaunchBroadcast?: boolean;
    };

    if (body.resetToDefault) {
      const promo = await resetBlofinPartnerPromoToDefault();
      return NextResponse.json({ success: true, promo });
    }

    if (body.publishLaunchBroadcast) {
      const { resetToDefault: _r, publishLaunchBroadcast: _p, ...patch } = body;
      const promo = await setBlofinPartnerPromo(patch);
      await setSiteAnnouncementBanner({
        ...BLOFIN_PARTNERSHIP_LAUNCH_BANNER,
        showPartnerLogos: promo.includeLogosInBroadcast,
        partnerBrand: "blofin",
      });
      return NextResponse.json({ success: true, promo, broadcastPublished: true });
    }

    const { resetToDefault: _, publishLaunchBroadcast: __, ...patch } = body;
    const promo = await setBlofinPartnerPromo(patch);
    return NextResponse.json({ success: true, promo });
  } catch (e) {
    console.error("admin blofin-partner-promo PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update Blofin partner promo." },
      { status: 400 }
    );
  }
}
