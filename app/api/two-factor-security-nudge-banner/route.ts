import { NextResponse } from "next/server";
import { getTwoFactorSecurityNudgeBannerForPublic } from "@/lib/two-factor-security-nudge-banner";

export async function GET() {
  try {
    const banner = await getTwoFactorSecurityNudgeBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("two-factor-security-nudge-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load banner." }, { status: 500 });
  }
}
