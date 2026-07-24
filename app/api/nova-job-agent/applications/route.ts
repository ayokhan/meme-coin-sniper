import { NextResponse } from "next/server";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { requireJobAgentAccess } from "@/lib/nova-job-agent/access";
import { generateCoverLetter, tuneResumeForJob } from "@/lib/nova-job-agent/ai";
import { resolveApplicantEmail } from "@/lib/nova-job-agent/contact";
import { prisma as basePrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Prepare JD-tuned resume + cover letter for a job application. */
export async function POST(request: Request) {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  let body: {
    applicationId?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    jobUrl?: string;
    workType?: string;
    source?: string;
    externalId?: string;
    jobDescription?: string;
    markApplied?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const [resume, profile, account] = await Promise.all([
    prisma.jobAgentResume.findFirst({
      where: { userId: gate.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } }),
    basePrisma.user.findUnique({
      where: { id: gate.userId },
      select: { email: true, name: true },
    }),
  ]);
  if (!resume?.contentText) {
    return NextResponse.json({ success: false, error: "Upload an active resume first." }, { status: 400 });
  }

  const contactEmail = resolveApplicantEmail({
    contactEmail: profile?.contactEmail,
    resumeText: resume.contentText,
    accountEmail: account?.email,
  });
  const contactName = (profile?.contactName || account?.name || "").trim() || null;
  const contactPhone = (profile?.contactPhone || "").trim() || null;

  let app = body.applicationId
    ? await prisma.jobAgentApplication.findFirst({
        where: { id: body.applicationId, userId: gate.userId },
      })
    : null;

  if (!app) {
    const jobTitle = String(body.jobTitle ?? "").trim();
    const company = String(body.company ?? "").trim();
    if (!jobTitle || !company) {
      return NextResponse.json({ success: false, error: "jobTitle and company are required." }, { status: 400 });
    }
    const externalId =
      typeof body.externalId === "string" && body.externalId.trim()
        ? body.externalId.trim()
        : `manual-${Date.now()}`;
    try {
      app = await prisma.jobAgentApplication.create({
        data: {
          userId: gate.userId,
          jobTitle,
          company,
          location: body.location?.trim() || null,
          workType: body.workType?.trim() || null,
          jobUrl: body.jobUrl?.trim() || null,
          source: body.source?.trim() || "manual",
          externalId,
          status: "queued",
          resumeSnapshot: resume.contentText.slice(0, 20000),
        },
      });
    } catch {
      app = await prisma.jobAgentApplication.findFirst({
        where: { userId: gate.userId, externalId },
      });
      if (!app) {
        return NextResponse.json({ success: false, error: "Could not create application." }, { status: 500 });
      }
    }
  }

  const jobDescription = body.jobDescription ?? app.notes ?? "";

  try {
    const tunedResume = await tuneResumeForJob({
      resumeText: resume.contentText,
      jobTitle: app.jobTitle,
      company: app.company,
      jobDescription,
      contactEmail,
      contactName,
      contactPhone,
    });
    const coverLetter = await generateCoverLetter({
      resumeText: tunedResume,
      jobTitle: app.jobTitle,
      company: app.company,
      location: app.location,
      jobDescription,
      contactEmail,
      contactName,
      contactPhone,
    });
    const markApplied = body.markApplied === true;
    const updated = await prisma.jobAgentApplication.update({
      where: { id: app.id },
      data: {
        coverLetter,
        resumeSnapshot: tunedResume.slice(0, 20000),
        status: markApplied ? "applied" : "prepared",
        appliedAt: markApplied ? new Date() : app.appliedAt,
        notes: jobDescription.slice(0, 2000) || app.notes,
      },
    });
    return NextResponse.json({
      success: true,
      application: {
        id: updated.id,
        jobTitle: updated.jobTitle,
        company: updated.company,
        status: updated.status,
        coverLetter: updated.coverLetter,
        resumeSnapshot: updated.resumeSnapshot,
        jobUrl: updated.jobUrl,
        appliedAt: updated.appliedAt?.toISOString() ?? null,
        contactEmail,
      },
    });
  } catch (e) {
    await prisma.jobAgentApplication.update({
      where: { id: app.id },
      data: { status: "failed", notes: e instanceof Error ? e.message : "AI failed" },
    });
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Prepare failed." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  let body: { applicationId?: string; status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }
  const id = String(body.applicationId ?? "");
  const status = String(body.status ?? "");
  if (!id || !["queued", "prepared", "applied", "skipped", "failed"].includes(status)) {
    return NextResponse.json({ success: false, error: "Invalid applicationId or status." }, { status: 400 });
  }
  const existing = await prisma.jobAgentApplication.findFirst({
    where: { id, userId: gate.userId },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }
  const updated = await prisma.jobAgentApplication.update({
    where: { id },
    data: {
      status,
      appliedAt: status === "applied" ? new Date() : existing.appliedAt,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : existing.notes,
    },
  });
  return NextResponse.json({
    success: true,
    application: {
      id: updated.id,
      status: updated.status,
      appliedAt: updated.appliedAt?.toISOString() ?? null,
    },
  });
}
