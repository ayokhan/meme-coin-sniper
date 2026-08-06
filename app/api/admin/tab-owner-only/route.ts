import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getTabOwnerOnlyConfig,
  resetTabOwnerOnlyConfig,
  setTabOwnerOnlyTabs,
} from "@/lib/tab-owner-only";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const config = await getTabOwnerOnlyConfig();
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("admin tab-owner-only GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}

/** PATCH — { ownerOnlyTabs?: string[], resetToDefault?: boolean } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json();
    let config;
    if (body.resetToDefault === true) {
      config = await resetTabOwnerOnlyConfig();
    } else if (Array.isArray(body.ownerOnlyTabs)) {
      config = await setTabOwnerOnlyTabs(body.ownerOnlyTabs);
    } else {
      config = await getTabOwnerOnlyConfig();
    }
    return NextResponse.json({ success: true, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin tab-owner-only PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
