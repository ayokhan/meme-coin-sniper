import { NextResponse } from "next/server";
import { getPromoBannerForPublic } from "@/lib/promo-banner";

export const dynamic = "force-dynamic";

/** Public read-only promo banner config for dashboard / register UI. */
export async function GET() {
  try {
    const promo = await getPromoBannerForPublic();
    return NextResponse.json({ success: true, promo });
  } catch (e) {
    console.error("promo-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load promo." }, { status: 500 });
  }
}
