import { NextResponse } from "next/server";
import { getSiteAnnouncementBannerForPublic } from "@/lib/site-announcement-banner";

export async function GET() {
  try {
    const banner = await getSiteAnnouncementBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("site-announcement-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load announcement." }, { status: 500 });
  }
}
