import { NextResponse } from "next/server";
import { getEnterLandingConfig } from "@/lib/enter-landing";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Public: landing copy + whether guest landing is enabled. */
export async function GET() {
  try {
    const [enabled, config] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.ENTER_LANDING_ENABLED),
      getEnterLandingConfig(),
    ]);
    const { usesDefault, updatedAt, ...landing } = config;
    return NextResponse.json({
      success: true,
      enabled,
      landing,
      meta: { usesDefault, updatedAt },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load landing." },
      { status: 500 }
    );
  }
}
