import { NextResponse } from "next/server";
import { getCaseStudiesPageConfig } from "@/lib/case-studies-content";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Public: case studies page copy + master visibility flag. */
export async function GET() {
  try {
    const [enabled, admin] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_CASE_STUDIES),
      getCaseStudiesPageConfig(),
    ]);
    const { usesDefault: _u, updatedAt: _t, ...config } = admin;
    const studies = config.studies.filter((s) => s.enabled);
    return NextResponse.json({
      success: true,
      enabled,
      config: { ...config, studies },
    });
  } catch (e) {
    console.error("public case-studies GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load case studies." }, { status: 500 });
  }
}
