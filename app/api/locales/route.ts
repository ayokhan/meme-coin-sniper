import { NextResponse } from "next/server";
import { getLocaleConfigPublic } from "@/lib/locale-config";

export const dynamic = "force-dynamic";

/** Public: which languages appear in the language switcher. */
export async function GET() {
  try {
    const config = await getLocaleConfigPublic();
    return NextResponse.json({ success: true, ...config });
  } catch (e) {
    console.error("locales GET:", e);
    return NextResponse.json(
      { success: false, error: "Failed to load languages." },
      { status: 500 }
    );
  }
}
