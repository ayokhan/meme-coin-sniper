import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { listUserBillingInvoices } from "@/lib/billing-invoices";

export const dynamic = "force-dynamic";

/** GET — billing history for signed-in user (database only; no Stripe API). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.ACCOUNT_BILLING_HISTORY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Billing history is not enabled." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  try {
    const invoices = await listUserBillingInvoices(session.user.id, { month, limit: 50 });
    return NextResponse.json({ success: true, invoices });
  } catch (e) {
    console.error("user billing-invoices GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load billing history." }, { status: 500 });
  }
}
