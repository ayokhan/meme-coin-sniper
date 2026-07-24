import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentAccess } from "@/lib/nova-job-agent/access";
import { searchJobsAcrossBoards } from "@/lib/nova-job-agent/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return Response.json({ success: false, error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  const profile = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
  const titles = asStringArray(profile?.jobTitles);
  if (titles.length === 0 && !q) {
    return Response.json(
      { success: false, error: "Enter a search term or save at least one job title in preferences." },
      { status: 400 }
    );
  }

  try {
    const jobs = await searchJobsAcrossBoards({
      jobTitles: titles.length ? titles : q ? [q] : [],
      query: q || null,
      city: profile?.city,
      country: profile?.country,
      region: profile?.region,
      remoteOk: profile?.remoteOk ?? true,
      enabledBoards: profile?.enabledBoards,
      limit: 30,
    });
    return Response.json({ success: true, jobs, query: q || null });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Job search failed." },
      { status: 502 }
    );
  }
}
