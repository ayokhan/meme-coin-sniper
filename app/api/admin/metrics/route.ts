import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getUsageReportForAdmin, type UsageReportPeriod } from "@/lib/usage";

export const dynamic = "force-dynamic";

/** GET - usage report for all users. Owner only. Query: period=month|day, month=YYYY-MM, day=YYYY-MM-DD */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period: UsageReportPeriod | undefined =
      periodParam === "day" ? "day" : periodParam === "month" ? "month" : undefined;
    const month = searchParams.get("month") ?? undefined;
    const day = searchParams.get("day") ?? undefined;

    const report = await getUsageReportForAdmin({ period, month, day });
    return NextResponse.json(report);
  } catch (e) {
    console.error("Admin metrics:", e);
    return NextResponse.json({ error: "Failed to load metrics." }, { status: 500 });
  }
}
