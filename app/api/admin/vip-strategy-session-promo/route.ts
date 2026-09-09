import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getVipStrategySessionPromoConfig,
  setVipStrategySessionPromoConfig,
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

/** Owner: read / update promo end date + session list price (drives banner, email presets, subscribe copy). */
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
      launchEmail: buildVipStrategySessionLaunchEmail(config.endsOnDate, config.sessionListPriceUsd),
      bookingEmail: buildVipStrategySessionBookingEmail(config.endsOnDate, config.sessionListPriceUsd),
      banner: buildVipStrategySessionBanner(config.endsOnDate, config.sessionListPriceUsd),
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
      sessionListPriceUsd?: number | string;
      publishBanner?: boolean;
      refreshLiveBanner?: boolean;
    };

    const config = await setVipStrategySessionPromoConfig({
      endsOnDate: body.endsOnDate,
      sessionListPriceUsd: body.sessionListPriceUsd,
    });

    let bannerRefreshed = false;
    if (body.publishBanner) {
      await setSiteAnnouncementBanner({
        ...buildVipStrategySessionBanner(config.endsOnDate, config.sessionListPriceUsd),
        enabled: true,
      });
      bannerRefreshed = true;
    } else if (body.refreshLiveBanner !== false) {
      bannerRefreshed = await refreshLiveStrategySessionBannerIfPublished(
        config.endsOnDate,
        config.sessionListPriceUsd
      );
    }

    const flagOn = await getFeatureFlag(FEATURE_FLAG_KEYS.VIP_STRATEGY_SESSION_PROMO);
    const active = await isVipStrategySessionPromoActive();

    return NextResponse.json({
      success: true,
      config,
      flagOn,
      active,
      bannerRefreshed,
      launchEmail: buildVipStrategySessionLaunchEmail(config.endsOnDate, config.sessionListPriceUsd),
      bookingEmail: buildVipStrategySessionBookingEmail(config.endsOnDate, config.sessionListPriceUsd),
      banner: buildVipStrategySessionBanner(config.endsOnDate, config.sessionListPriceUsd),
    });
  } catch (e) {
    console.error("admin vip-strategy-session-promo PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update promo config." },
      { status: 400 }
    );
  }
}
