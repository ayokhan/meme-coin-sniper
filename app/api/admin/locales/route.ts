import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { parseAppLocale, type AppLocale } from "@/lib/i18n/locales";
import { getLocaleConfigForAdmin, setLocaleConfig } from "@/lib/locale-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const config = await getLocaleConfigForAdmin();
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("admin locales GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load languages." }, { status: 500 });
  }
}

/** PATCH — body: { enabledLocales?: string[], defaultLocale?: string } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const body = await request.json();
    const patch: { enabledLocales?: AppLocale[]; defaultLocale?: AppLocale } = {};

    if (Array.isArray(body.enabledLocales)) {
      patch.enabledLocales = body.enabledLocales
        .map((x: unknown) => parseAppLocale(x))
        .filter((x: AppLocale | null): x is AppLocale => x != null);
    }
    if (typeof body.defaultLocale === "string") {
      const d = parseAppLocale(body.defaultLocale);
      if (d) patch.defaultLocale = d;
    }

    const config = await setLocaleConfig(patch);
    return NextResponse.json({ success: true, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("admin locales PATCH:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
