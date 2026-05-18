import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  clearTabNewBadgeOverride,
  getTabNewBadgesForAdmin,
  setTabNewBadge,
  TAB_NEW_BADGE_OPTIONS,
} from "@/lib/tab-new-badges";

export const dynamic = "force-dynamic";

const VALID_TAB_IDS = new Set(TAB_NEW_BADGE_OPTIONS.map((o) => o.id));

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const rows = await getTabNewBadgesForAdmin();
    return NextResponse.json({ success: true, rows });
  } catch (e) {
    console.error("admin tab-new-badges GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load tab NEW badges." }, { status: 500 });
  }
}

/** PATCH body: { tabId, expiresAt: string | null, resetToDefault?: boolean } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json();
    const tabId = typeof body.tabId === "string" ? body.tabId.trim() : "";
    if (!tabId || !VALID_TAB_IDS.has(tabId)) {
      return NextResponse.json({ success: false, error: "Invalid tab id." }, { status: 400 });
    }

    if (body.resetToDefault === true) {
      await clearTabNewBadgeOverride(tabId);
    } else if (body.expiresAt === null || body.expiresAt === "") {
      await setTabNewBadge(tabId, null);
    } else if (typeof body.expiresAt === "string") {
      await setTabNewBadge(tabId, body.expiresAt);
    } else {
      return NextResponse.json({ success: false, error: "Provide expiresAt (ISO date) or null to turn off." }, { status: 400 });
    }

    const rows = await getTabNewBadgesForAdmin();
    return NextResponse.json({ success: true, rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin tab-new-badges PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
