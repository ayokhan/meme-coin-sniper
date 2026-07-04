import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getMemeAgentBannerForAdmin,
  resetMemeAgentBannerToDefault,
  setMemeAgentBanner,
  type MemeAgentBannerConfig,
} from "@/lib/meme-agent-banner";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const banner = await getMemeAgentBannerForAdmin();
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("admin meme-agent-banner GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load banner." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<MemeAgentBannerConfig> & { resetToDefault?: boolean };
    if (body.resetToDefault) {
      const banner = await resetMemeAgentBannerToDefault();
      return NextResponse.json({ success: true, banner });
    }
    const banner = await setMemeAgentBanner({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    });
    return NextResponse.json({ success: true, banner });
  } catch (e) {
    console.error("admin meme-agent-banner PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update banner." },
      { status: 500 }
    );
  }
}
