import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentAccess } from "@/lib/nova-job-agent/access";
import { searchJobsAcrossBoards } from "@/lib/nova-job-agent/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return Response.json({ success: false, error: gate.error }, { status: gate.status });

  const profile = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
  const titles = asStringArray(profile?.jobTitles);
  if (titles.length === 0) {
    return Response.json(
      { success: false, error: "Save at least one job title in preferences first." },
      { status: 400 }
    );
  }

  try {
    const jobs = await searchJobsAcrossBoards({
      jobTitles: titles,
      city: profile?.city,
      country: profile?.country,
      region: profile?.region,
      remoteOk: profile?.remoteOk ?? true,
      enabledBoards: profile?.enabledBoards,
      limit: 30,
    });
    return Response.json({ success: true, jobs });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Job search failed." },
      { status: 502 }
    );
  }
}
