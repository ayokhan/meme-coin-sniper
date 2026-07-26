import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma as basePrisma } from "@/lib/db";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { requireJobAgentAccess, asStringArray } from "@/lib/nova-job-agent/access";
import { improveResumeText } from "@/lib/nova-job-agent/ai";
import { extractResumeText } from "@/lib/nova-job-agent/parse-resume";
import { resolveApplicantEmail } from "@/lib/nova-job-agent/contact";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TEXT = 80_000;

export async function POST(request: Request) {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const contentType = request.headers.get("content-type") || "";
  let contentText = "";
  let fileName: string | null = null;
  let fileUrl: string | null = null;
  let improve = false;
  let jobDescription: string | null = null;
  let jobTitle: string | null = null;
  let company: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    improve = form.get("improve") === "1" || form.get("improve") === "true";
    const pasted = String(form.get("contentText") ?? "");
    const jd = String(form.get("jobDescription") ?? "").trim();
    if (jd) jobDescription = jd;
    const jt = String(form.get("jobTitle") ?? "").trim();
    if (jt) jobTitle = jt;
    const co = String(form.get("company") ?? "").trim();
    if (co) company = co;
    const file = form.get("file");
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const f = file as File;
      fileName = f.name || "resume";
      const buf = Buffer.from(await f.arrayBuffer());
      try {
        contentText = await extractResumeText(buf, fileName, f.type);
      } catch (e) {
        return NextResponse.json(
          { success: false, error: e instanceof Error ? e.message : "Could not read resume file." },
          { status: 400 }
        );
      }
      if (/\.(pdf|docx)$/i.test(fileName)) {
        try {
          const blob = await put(`nova-job-agent/${gate.userId}/${Date.now()}-${fileName}`, buf, {
            access: "public",
            contentType: f.type || "application/octet-stream",
          });
          fileUrl = blob.url;
        } catch (e) {
          console.error("job agent resume blob:", e);
        }
      }
    }
    if (pasted.trim()) contentText = pasted.trim();
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
    }
    contentText = String(body.contentText ?? "").trim();
    fileName = typeof body.fileName === "string" ? body.fileName : null;
    improve = body.improve === true;
    if (typeof body.jobDescription === "string" && body.jobDescription.trim()) {
      jobDescription = body.jobDescription.trim();
    }
    if (typeof body.jobTitle === "string" && body.jobTitle.trim()) {
      jobTitle = body.jobTitle.trim();
    }
    if (typeof body.company === "string" && body.company.trim()) {
      company = body.company.trim();
    }
  }

  if (!contentText) {
    return NextResponse.json(
      {
        success: false,
        error: "Upload a .txt, .md, .pdf, or .docx resume, or paste resume text.",
      },
      { status: 400 }
    );
  }
  contentText = contentText.slice(0, MAX_TEXT);

  if (improve) {
    const [profile, account] = await Promise.all([
      prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } }),
      basePrisma.user.findUnique({
        where: { id: gate.userId },
        select: { email: true, name: true },
      }),
    ]);
    const contactEmail = resolveApplicantEmail({
      contactEmail: profile?.contactEmail,
      resumeText: contentText,
      accountEmail: account?.email,
    });
    const contactName = (profile?.contactName || account?.name || "").trim() || null;
    const contactPhone = (profile?.contactPhone || "").trim() || null;

    contentText = await improveResumeText({
      resumeText: contentText,
      jobTitles: asStringArray(profile?.jobTitles),
      notes: profile?.notes ?? undefined,
      jobDescription,
      jobTitle,
      company,
      contactEmail,
      contactName,
      contactPhone,
    });
  }

  const last = await prisma.jobAgentResume.findFirst({
    where: { userId: gate.userId },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;

  await prisma.jobAgentResume.updateMany({
    where: { userId: gate.userId, isActive: true },
    data: { isActive: false },
  });

  const row = await prisma.jobAgentResume.create({
    data: {
      userId: gate.userId,
      fileName,
      fileUrl,
      contentText,
      version,
      isActive: true,
    },
  });

  return NextResponse.json({
    success: true,
    resume: {
      id: row.id,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      contentText: row.contentText,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      improved: improve,
      tailoredToJob: Boolean(jobDescription),
    },
  });
}
