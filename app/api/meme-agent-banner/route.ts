import { NextResponse } from "next/server";
import { getMemeAgentBannerForPublic } from "@/lib/meme-agent-banner";

export async function GET() {
  try {
    const banner = await getMemeAgentBannerForPublic();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("meme-agent-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load banner." }, { status: 500 });
  }
}
