import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getVipStrategySessionPromoConfig,
  setVipStrategySessionPromoEndsOnDate,
  buildVipStrategySessionBanner,
  refreshLiveStrategySessionBannerIfPublished,
  isVipStrategySessionPromoActive,
} from "@/lib/vip-strategy-session-promo";
import {
  buildVipStrategySessionLaunchEmail,
  buildVipStrategySessionBookingEmail,
} from "@/lib/vip-strategy-session-promo-email";
import { setSiteAnnouncementBanner } from "@/lib/site-announcement-banner";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Owner: read / update promo end date (drives banner, email presets, subscribe copy). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const config = await getVipStrategySessionPromoConfig();
    const flagOn = await getFeatureFlag(FEATURE_FLAG_KEYS.VIP_STRATEGY_SESSION_PROMO);
    const active = await isVipStrategySessionPromoActive();
    return NextResponse.json({
      success: true,
      config,
      flagOn,
      active,
      launchEmail: buildVipStrategySessionLaunchEmail(config.endsOnDate),
      bookingEmail: buildVipStrategySessionBookingEmail(config.endsOnDate),
      banner: buildVipStrategySessionBanner(config.endsOnDate),
    });
  } catch (e) {
    console.error("admin vip-strategy-session-promo GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load promo config." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      endsOnDate?: string;
      publishBanner?: boolean;
      refreshLiveBanner?: boolean;
    };

    let config = await getVipStrategySessionPromoConfig();
    if (body.endsOnDate != null) {
      config = await setVipStrategySessionPromoEndsOnDate(body.endsOnDate);
    }

    let bannerRefreshed = false;
    if (body.publishBanner) {
      await setSiteAnnouncementBanner({
        ...buildVipStrategySessionBanner(config.endsOnDate),
        enabled: true,
      });
      bannerRefreshed = true;
    } else if (body.refreshLiveBanner !== false) {
      // Default: if this promo is already the live announcement, rewrite dates in place.
      bannerRefreshed = await refreshLiveStrategySessionBannerIfPublished(config.endsOnDate);
    }

    const flagOn = await getFeatureFlag(FEATURE_FLAG_KEYS.VIP_STRATEGY_SESSION_PROMO);
    const active = await isVipStrategySessionPromoActive();

    return NextResponse.json({
      success: true,
      config,
      flagOn,
      active,
      bannerRefreshed,
      launchEmail: buildVipStrategySessionLaunchEmail(config.endsOnDate),
      bookingEmail: buildVipStrategySessionBookingEmail(config.endsOnDate),
      banner: buildVipStrategySessionBanner(config.endsOnDate),
    });
  } catch (e) {
    console.error("admin vip-strategy-session-promo PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update promo config." },
      { status: 400 }
    );
  }
}
