import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getGuestRegistrationNudgeBannerForPublic,
  resetGuestRegistrationNudgeBannerToDefault,
  setGuestRegistrationNudgeBanner,
  type GuestRegistrationNudgeBannerConfig,
} from "@/lib/guest-registration-nudge-banner";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const banner = await getGuestRegistrationNudgeBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("admin guest-registration-nudge-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load banner." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<GuestRegistrationNudgeBannerConfig> & { resetToDefault?: boolean };
    if (body.resetToDefault) {
      const banner = await resetGuestRegistrationNudgeBannerToDefault();
      return NextResponse.json({ success: true, banner });
    }
    const { resetToDefault: _, ...patch } = body;
    const banner = await setGuestRegistrationNudgeBanner(patch);
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("admin guest-registration-nudge-banner PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update banner." },
      { status: 500 }
    );
  }
}
