import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getRealtorOsConfigPublic,
  resetRealtorOsConfig,
  setRealtorOsConfig,
  type RealtorOsConfig,
} from "@/lib/realtor-os-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const config = await getRealtorOsConfigPublic();
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("admin realtor-os GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load Realtor OS config." }, { status: 500 });
  }
}

/** PATCH — body: partial config fields, or { resetToDefault: true } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json();
    if (body.resetToDefault === true) {
      const config = await resetRealtorOsConfig();
      return NextResponse.json({ success: true, config });
    }
    const config = await setRealtorOsConfig(body as Partial<RealtorOsConfig>);
    return NextResponse.json({ success: true, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin realtor-os PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
