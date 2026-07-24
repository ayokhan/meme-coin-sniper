import { NextResponse } from "next/server";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentOwner } from "@/lib/nova-job-agent/access";
import { generateCoverLetter } from "@/lib/nova-job-agent/ai";
import { searchRemotiveJobs } from "@/lib/nova-job-agent/search";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Auto-apply pipeline (owner MVP):
 * 1) Find matching Remotive jobs
 * 2) Create application rows
 * 3) Generate cover letters
 * 4) Mark as prepared (or applied if autoApplyEnabled)
 *
 * True one-click submission to LinkedIn/Indeed is not wired — materials + tracking are ready;
 * open jobUrl to submit, or mark applied from the dashboard.
 */
export async function POST() {
  const gate = await requireJobAgentOwner();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const profile = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
  const resume = await prisma.jobAgentResume.findFirst({
    where: { userId: gate.userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!profile || asStringArray(profile.jobTitles).length === 0) {
    return NextResponse.json({ success: false, error: "Save job titles in preferences first." }, { status: 400 });
  }
  if (!resume?.contentText) {
    return NextResponse.json({ success: false, error: "Upload an active resume first." }, { status: 400 });
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const appliedToday = await prisma.jobAgentApplication.count({
    where: {
      userId: gate.userId,
      status: { in: ["applied", "prepared"] },
      createdAt: { gte: startOfDay },
    },
  });
  const remaining = Math.max(0, profile.targetApplicationsPerDay - appliedToday);
  if (remaining === 0) {
    return NextResponse.json({
      success: true,
      message: `Daily target reached (${profile.targetApplicationsPerDay}).`,
      created: [],
    });
  }

  let jobs;
  try {
    jobs = await searchRemotiveJobs({
      jobTitles: asStringArray(profile.jobTitles),
      city: profile.city,
      country: profile.country,
      region: profile.region,
      remoteOk: profile.remoteOk,
      limit: remaining,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Search failed." },
      { status: 502 }
    );
  }

  const created: Array<{ id: string; company: string; jobTitle: string; status: string; jobUrl: string | null }> =
    [];

  for (const job of jobs) {
    const existing = await prisma.jobAgentApplication.findFirst({
      where: { userId: gate.userId, externalId: job.externalId },
    });
    if (existing) continue;

    let app = await prisma.jobAgentApplication.create({
      data: {
        userId: gate.userId,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        workType: job.workType,
        jobUrl: job.url,
        source: job.source,
        externalId: job.externalId,
        status: "queued",
        resumeSnapshot: resume.contentText.slice(0, 20000),
        notes: job.descriptionSnippet,
      },
    });

    try {
      const coverLetter = await generateCoverLetter({
        resumeText: resume.contentText,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        jobDescription: job.descriptionSnippet,
      });
      const status = profile.autoApplyEnabled ? "applied" : "prepared";
      app = await prisma.jobAgentApplication.update({
        where: { id: app.id },
        data: {
          coverLetter,
          status,
          appliedAt: status === "applied" ? new Date() : null,
          notes:
            status === "applied"
              ? "Auto-prepared + marked applied. Open job URL to confirm board submission."
              : "Cover letter prepared. Open job URL to submit, then mark Applied.",
        },
      });
    } catch (e) {
      app = await prisma.jobAgentApplication.update({
        where: { id: app.id },
        data: {
          status: "failed",
          notes: e instanceof Error ? e.message : "Cover letter failed",
        },
      });
    }

    created.push({
      id: app.id,
      company: app.company,
      jobTitle: app.jobTitle,
      status: app.status,
      jobUrl: app.jobUrl,
    });

    if (created.length >= remaining) break;
  }

  return NextResponse.json({
    success: true,
    created,
    message:
      created.length === 0
        ? "No new matching jobs found (or all already tracked)."
        : `Prepared ${created.length} application(s).`,
  });
}
