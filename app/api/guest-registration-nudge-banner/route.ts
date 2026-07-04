import { NextResponse } from "next/server";
import { getGuestRegistrationNudgeBannerForPublic } from "@/lib/guest-registration-nudge-banner";

export async function GET() {
  try {
    const banner = await getGuestRegistrationNudgeBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("guest-registration-nudge-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load banner." }, { status: 500 });
  }
}
