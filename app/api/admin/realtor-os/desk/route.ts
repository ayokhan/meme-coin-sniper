import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { getRealtorOsConfigPublic } from "@/lib/realtor-os-config";
import { listRealtorDesk } from "@/lib/realtor-os/desk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const [config, desk] = await Promise.all([getRealtorOsConfigPublic(), listRealtorDesk()]);
    return NextResponse.json({ success: true, config, ...desk });
  } catch (e) {
    console.error("realtor-os desk GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load desk." },
      { status: 500 }
    );
  }
}
