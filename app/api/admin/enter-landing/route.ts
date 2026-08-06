import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getEnterLandingConfig,
  normalizeEnterLandingConfig,
  resetEnterLandingConfig,
  setEnterLandingConfig,
  type EnterLandingConfig,
} from "@/lib/enter-landing";
import { getFeatureFlag, FEATURE_FLAG_KEYS, setFeatureFlag } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const [enabled, config] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.ENTER_LANDING_ENABLED),
      getEnterLandingConfig(),
    ]);
    return NextResponse.json({ success: true, enabled, config });
  } catch (e) {
    console.error("admin enter-landing GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load landing config." }, { status: 500 });
  }
}

/** PATCH — body: { enabled?: boolean, config?: EnterLandingConfig, resetToDefault?: boolean } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json();

    if (typeof body.enabled === "boolean") {
      await setFeatureFlag(FEATURE_FLAG_KEYS.ENTER_LANDING_ENABLED, body.enabled);
    }

    let config;
    if (body.resetToDefault === true) {
      config = await resetEnterLandingConfig();
    } else if (body.config && typeof body.config === "object") {
      const normalized = normalizeEnterLandingConfig(body.config as EnterLandingConfig);
      config = await setEnterLandingConfig(normalized);
    } else {
      config = await getEnterLandingConfig();
    }

    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.ENTER_LANDING_ENABLED);
    return NextResponse.json({ success: true, enabled, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin enter-landing PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
