import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getUserPageActivityForAdmin, type UsageReportPeriod } from "@/lib/usage";

export const dynamic = "force-dynamic";

/** GET - Page view drill-down for one user. Owner only. Query: userId, period, month|day */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId required." }, { status: 400 });
    }

    const periodParam = searchParams.get("period");
    const period: UsageReportPeriod | undefined =
      periodParam === "day" ? "day" : periodParam === "month" ? "month" : undefined;
    const month = searchParams.get("month") ?? undefined;
    const day = searchParams.get("day") ?? undefined;

    const drill = await getUserPageActivityForAdmin(userId, { period, month, day });
    if (!drill) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, drill });
  } catch (e) {
    console.error("Admin metrics user-activity:", e);
    return NextResponse.json({ success: false, error: "Failed to load page activity." }, { status: 500 });
  }
}
