import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { requireJobAgentAccess } from "@/lib/nova-job-agent/access";
import { improveResumeText } from "@/lib/nova-job-agent/ai";
import { asStringArray } from "@/lib/nova-job-agent/access";
import { extractResumeText } from "@/lib/nova-job-agent/parse-resume";

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

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    improve = form.get("improve") === "1" || form.get("improve") === "true";
    const pasted = String(form.get("contentText") ?? "");
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
      // Keep original PDF/DOCX in blob storage when possible
      if (/\.(pdf|docx)$/i.test(fileName)) {
        try {
          const blob = await put(`nova-job-agent/${gate.userId}/${Date.now()}-${fileName}`, buf, {
            access: "public",
            contentType: f.type || "application/octet-stream",
          });
          fileUrl = blob.url;
        } catch (e) {
          console.error("job agent resume blob:", e);
          // Text extract still works without blob storage
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
    const profile = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
    contentText = await improveResumeText({
      resumeText: contentText,
      jobTitles: asStringArray(profile?.jobTitles),
      notes: profile?.notes ?? undefined,
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
    },
  });
}
