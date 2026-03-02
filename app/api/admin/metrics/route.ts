import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getUsageReportForAdmin } from "@/lib/usage";

export const dynamic = "force-dynamic";

/** GET - usage report for all users (current month). Owner only. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    const report = await getUsageReportForAdmin();
    return NextResponse.json(report);
  } catch (e) {
    console.error("Admin metrics:", e);
    return NextResponse.json({ error: "Failed to load metrics." }, { status: 500 });
  }
}
