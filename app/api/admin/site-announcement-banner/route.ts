import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getSiteAnnouncementBannerForPublic,
  resetSiteAnnouncementBannerToDefault,
  setSiteAnnouncementBanner,
  type SiteAnnouncementBannerConfig,
} from "@/lib/site-announcement-banner";
import { AFFILIATE_LAUNCH_BANNER } from "@/lib/referral-program";
import { PNL_CALCULATOR_LAUNCH_BANNER } from "@/lib/pnl-calculator-launch-email";
import { BLOFIN_PARTNERSHIP_LAUNCH_BANNER, getBlofinPartnerPromoForAdmin } from "@/lib/blofin-partner-promo";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const banner = await getSiteAnnouncementBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("admin site-announcement-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load announcement." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<SiteAnnouncementBannerConfig> & {
      resetToDefault?: boolean;
      preset?: string;
    };
    if (body.resetToDefault) {
      const banner = await resetSiteAnnouncementBannerToDefault();
      return NextResponse.json({ success: true, banner });
    }
    if (body.preset === "affiliate-launch") {
      const banner = await setSiteAnnouncementBanner({ ...AFFILIATE_LAUNCH_BANNER });
      return NextResponse.json({ success: true, banner });
    }
    if (body.preset === "blofin-partnership") {
      const promo = await getBlofinPartnerPromoForAdmin().catch(() => null);
      const banner = await setSiteAnnouncementBanner({
        ...BLOFIN_PARTNERSHIP_LAUNCH_BANNER,
        showPartnerLogos: promo?.includeLogosInBroadcast ?? true,
      });
      return NextResponse.json({ success: true, banner });
    }
    if (body.preset === "pnl-calculator-launch") {
      const banner = await setSiteAnnouncementBanner({ ...PNL_CALCULATOR_LAUNCH_BANNER });
      return NextResponse.json({ success: true, banner });
    }
    const { resetToDefault: _, preset: __, ...patch } = body;
    const banner = await setSiteAnnouncementBanner(patch);
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("admin site-announcement-banner PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update announcement." },
      { status: 400 }
    );
  }
}
