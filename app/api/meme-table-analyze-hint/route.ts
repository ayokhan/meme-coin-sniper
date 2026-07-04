import { NextResponse } from "next/server";
import { getMemeTableAnalyzeHintBannerForPublic } from "@/lib/meme-table-analyze-hint-banner";

export async function GET() {
  try {
    const banner = await getMemeTableAnalyzeHintBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("meme-table-analyze-hint GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load banner." }, { status: 500 });
  }
}
