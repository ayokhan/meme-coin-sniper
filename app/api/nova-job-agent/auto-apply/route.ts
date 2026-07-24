import { NextResponse } from "next/server";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentAccess } from "@/lib/nova-job-agent/access";
import { generateCoverLetter, tuneResumeForJob } from "@/lib/nova-job-agent/ai";
import { searchJobsAcrossBoards, type MatchedJob } from "@/lib/nova-job-agent/search";
import { resolveApplicantEmail } from "@/lib/nova-job-agent/contact";
import { prisma as basePrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type JobPayload = {
  externalId?: string;
  title?: string;
  company?: string;
  location?: string;
  workType?: string;
  url?: string;
  source?: string;
  descriptionSnippet?: string;
};

/**
 * Auto-apply pipeline for selected (or freshly searched) jobs:
 * 1) Tune resume to each job description
 * 2) Generate cover letter
 * 3) Mark prepared (or applied if autoApplyEnabled)
 */
export async function POST(request: Request) {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  let body: { jobs?: JobPayload[]; externalIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const [profile, resume, account] = await Promise.all([
    prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } }),
    prisma.jobAgentResume.findFirst({
      where: { userId: gate.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    basePrisma.user.findUnique({
      where: { id: gate.userId },
      select: { email: true, name: true },
    }),
  ]);
  if (!profile || asStringArray(profile.jobTitles).length === 0) {
    return NextResponse.json({ success: false, error: "Save job titles in preferences first." }, { status: 400 });
  }
  if (!resume?.contentText) {
    return NextResponse.json({ success: false, error: "Upload an active resume first." }, { status: 400 });
  }

  const contactEmail = resolveApplicantEmail({
    contactEmail: profile.contactEmail,
    resumeText: resume.contentText,
    accountEmail: account?.email,
  });
  const contactName = (profile.contactName || account?.name || "").trim() || null;
  const contactPhone = (profile.contactPhone || "").trim() || null;

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

  let jobs: MatchedJob[] = [];
  const selectedPayloads = Array.isArray(body.jobs) ? body.jobs : [];
  if (selectedPayloads.length > 0) {
    jobs = selectedPayloads
      .filter((j) => j && j.title && j.company && (j.url || j.externalId))
      .map((j) => ({
        externalId: String(j.externalId || `manual-${j.url || Date.now()}`),
        title: String(j.title),
        company: String(j.company),
        location: String(j.location || ""),
        workType: String(j.workType || "full_time"),
        url: String(j.url || ""),
        source: (j.source as MatchedJob["source"]) || "remotive",
        descriptionSnippet: String(j.descriptionSnippet || ""),
        score: 1,
      }))
      .slice(0, remaining);
  } else {
    try {
      jobs = await searchJobsAcrossBoards({
        jobTitles: asStringArray(profile.jobTitles),
        city: profile.city,
        country: profile.country,
        region: profile.region,
        remoteOk: profile.remoteOk,
        enabledBoards: profile.enabledBoards,
        limit: remaining,
      });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "Search failed." },
        { status: 502 }
      );
    }
  }

  const created: Array<{
    id: string;
    company: string;
    jobTitle: string;
    status: string;
    jobUrl: string | null;
  }> = [];

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
      const tunedResume = await tuneResumeForJob({
        resumeText: resume.contentText,
        jobTitle: job.title,
        company: job.company,
        jobDescription: job.descriptionSnippet,
        notes: profile.notes ?? undefined,
        contactEmail,
        contactName,
        contactPhone,
      });
      const coverLetter = await generateCoverLetter({
        resumeText: tunedResume,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        jobDescription: job.descriptionSnippet,
        contactEmail,
        contactName,
        contactPhone,
      });
      const status = profile.autoApplyEnabled ? "applied" : "prepared";
      app = await prisma.jobAgentApplication.update({
        where: { id: app.id },
        data: {
          coverLetter,
          resumeSnapshot: tunedResume.slice(0, 20000),
          status,
          appliedAt: status === "applied" ? new Date() : null,
          notes:
            status === "applied"
              ? "JD-tuned resume + cover letter ready. Open job URL to confirm board submission."
              : "JD-tuned resume + cover letter prepared. Open job URL to submit, then mark Applied.",
        },
      });
    } catch (e) {
      app = await prisma.jobAgentApplication.update({
        where: { id: app.id },
        data: {
          status: "failed",
          notes: e instanceof Error ? e.message : "Prepare failed",
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
    contactEmail,
    message:
      created.length === 0
        ? "No selected/new matching jobs to prepare (or all already tracked)."
        : `Prepared ${created.length} application(s) with JD-tuned resumes.`,
  });
}
