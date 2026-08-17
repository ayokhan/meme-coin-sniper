import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, message: "Owner only." }, { status: 403 });
    }
    const missing: string[] = [];
    if (!process.env.APIFY_API_TOKEN) missing.push("APIFY_API_TOKEN");
    if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
    if (!process.env.BIRDEYE_API_KEY) missing.push("BIRDEYE_API_KEY");

    if (missing.length > 0) {
      return NextResponse.json({
        success: false,
        message: "Twitter scan is not configured.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Twitter scan is configured.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Twitter scan check failed", missing: [] },
      { status: 500 }
    );
  }
}
