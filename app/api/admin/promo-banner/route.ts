import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getPromoBannerForAdmin,
  resetPromoBannerToDefault,
  setPromoBanner,
  type PromoBannerConfig,
} from "@/lib/promo-banner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const promo = await getPromoBannerForAdmin();
    return NextResponse.json({ success: true, promo });
  } catch (e) {
    console.error("admin promo-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load promo banner." }, { status: 500 });
  }
}

/** PATCH — update promo fields. Body: partial PromoBannerConfig + resetToDefault?: boolean */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json();
    if (body.resetToDefault === true) {
      const promo = await resetPromoBannerToDefault();
      return NextResponse.json({ success: true, promo });
    }

    const patch: Partial<PromoBannerConfig> = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.headline === "string") patch.headline = body.headline;
    if (typeof body.prizeLabel === "string") patch.prizeLabel = body.prizeLabel;
    if (body.drawAt === null || body.drawAt === "") patch.drawAt = null;
    else if (typeof body.drawAt === "string") patch.drawAt = body.drawAt;
    if (body.bodyText === null || body.bodyText === "") patch.bodyText = null;
    else if (typeof body.bodyText === "string") patch.bodyText = body.bodyText;
    if (typeof body.ctaLabel === "string") patch.ctaLabel = body.ctaLabel;
    if (typeof body.ctaHref === "string") patch.ctaHref = body.ctaHref;
    if (typeof body.showOnDashboard === "boolean") patch.showOnDashboard = body.showOnDashboard;
    if (typeof body.showOnRegister === "boolean") patch.showOnRegister = body.showOnRegister;

    const promo = await setPromoBanner(patch);
    return NextResponse.json({ success: true, promo });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin promo-banner PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
