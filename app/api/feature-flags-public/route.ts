import { NextResponse } from "next/server";
import { getAllFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Public (no auth): read-only feature flags for the client.
 * Used for showing/hiding GUI tabs based on owner toggles.
 */
export async function GET() {
  const flags = await getAllFeatureFlags();
  // Only return GUI page tab flags to keep payload small.
  const pageTabFlags = Object.fromEntries(Object.entries(flags).filter(([k]) => k.startsWith("page_tab_")));
  return NextResponse.json({ success: true, flags: pageTabFlags });
}

