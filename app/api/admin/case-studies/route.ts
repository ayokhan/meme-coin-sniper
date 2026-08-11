import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getCaseStudiesPageConfig,
  normalizeCaseStudiesPageConfig,
  resetCaseStudiesPageConfig,
  setCaseStudiesPageConfig,
  type CaseStudiesPageConfig,
} from "@/lib/case-studies-content";
import { getFeatureFlag, FEATURE_FLAG_KEYS, setFeatureFlag } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const [enabled, config] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_CASE_STUDIES),
      getCaseStudiesPageConfig(),
    ]);
    return NextResponse.json({ success: true, enabled, config });
  } catch (e) {
    console.error("admin case-studies GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load case studies config." }, { status: 500 });
  }
}

/** PATCH — body: { enabled?: boolean, config?: CaseStudiesPageConfig, resetToDefault?: boolean } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json();

    if (typeof body.enabled === "boolean") {
      await setFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_CASE_STUDIES, body.enabled);
    }

    let config;
    if (body.resetToDefault === true) {
      config = await resetCaseStudiesPageConfig();
    } else if (body.config && typeof body.config === "object") {
      const normalized = normalizeCaseStudiesPageConfig(body.config as CaseStudiesPageConfig);
      config = await setCaseStudiesPageConfig(normalized);
    } else {
      config = await getCaseStudiesPageConfig();
    }

    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_CASE_STUDIES);
    return NextResponse.json({ success: true, enabled, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin case-studies PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
