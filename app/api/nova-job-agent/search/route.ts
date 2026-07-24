import { NextResponse } from "next/server";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentOwner } from "@/lib/nova-job-agent/access";
import { searchRemotiveJobs } from "@/lib/nova-job-agent/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireJobAgentOwner();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const profile = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
  const titles = asStringArray(profile?.jobTitles);
  if (titles.length === 0) {
    return NextResponse.json(
      { success: false, error: "Save at least one job title in preferences first." },
      { status: 400 }
    );
  }

  try {
    const jobs = await searchRemotiveJobs({
      jobTitles: titles,
      city: profile?.city,
      country: profile?.country,
      region: profile?.region,
      remoteOk: profile?.remoteOk ?? true,
      limit: 25,
    });
    return NextResponse.json({ success: true, jobs });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Job search failed." },
      { status: 502 }
    );
  }
}
