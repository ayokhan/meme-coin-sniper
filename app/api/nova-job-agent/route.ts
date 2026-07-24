import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentAccess } from "@/lib/nova-job-agent/access";
import { normalizeBoardIds, DEFAULT_ENABLED_BOARDS } from "@/lib/nova-job-agent/boards";
import { normalizeContactEmail } from "@/lib/nova-job-agent/contact";

export const dynamic = "force-dynamic";

function serializeProfile(row: {
  id: string;
  jobTitles: unknown;
  city: string | null;
  country: string | null;
  region: string | null;
  remoteOk: boolean;
  workTypes: unknown;
  enabledBoards?: unknown;
  autoApplyEnabled: boolean;
  targetApplicationsPerDay: number;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes: string | null;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    jobTitles: asStringArray(row.jobTitles),
    city: row.city,
    country: row.country,
    region: row.region,
    remoteOk: row.remoteOk,
    workTypes: asStringArray(row.workTypes),
    enabledBoards: normalizeBoardIds(row.enabledBoards),
    autoApplyEnabled: row.autoApplyEnabled,
    targetApplicationsPerDay: row.targetApplicationsPerDay,
    contactEmail: row.contactEmail ?? null,
    contactName: row.contactName ?? null,
    contactPhone: row.contactPhone ?? null,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return Response.json({ success: false, error: gate.error }, { status: gate.status });

  const [profile, resume, apps] = await Promise.all([
    prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } }),
    prisma.jobAgentResume.findFirst({
      where: { userId: gate.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jobAgentApplication.findMany({
      where: { userId: gate.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const grouped = await prisma.jobAgentApplication.groupBy({
    by: ["status"],
    where: { userId: gate.userId },
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  let totalAll = 0;
  for (const g of grouped as Array<{ status: string; _count: { _all: number } }>) {
    byStatus[g.status] = g._count._all;
    totalAll += g._count._all;
  }

  return Response.json({
    success: true,
    profile: profile
      ? serializeProfile(profile)
      : {
          id: null,
          jobTitles: [] as string[],
          city: null,
          country: null,
          region: null,
          remoteOk: true,
          workTypes: ["full_time"],
          enabledBoards: [...DEFAULT_ENABLED_BOARDS],
          autoApplyEnabled: false,
          targetApplicationsPerDay: 10,
          contactEmail: null,
          contactName: null,
          contactPhone: null,
          notes: null,
          updatedAt: null,
        },
    resume: resume
      ? {
          id: resume.id,
          fileName: resume.fileName,
          fileUrl: resume.fileUrl,
          contentText: resume.contentText,
          version: resume.version,
          createdAt: resume.createdAt.toISOString(),
        }
      : null,
    dashboard: {
      total: totalAll,
      applied: byStatus.applied ?? 0,
      prepared: byStatus.prepared ?? 0,
      queued: byStatus.queued ?? 0,
      failed: byStatus.failed ?? 0,
      skipped: byStatus.skipped ?? 0,
      recent: (apps as any[]).slice(0, 20).map((a) => ({
        id: a.id,
        jobTitle: a.jobTitle,
        company: a.company,
        location: a.location,
        workType: a.workType,
        jobUrl: a.jobUrl,
        source: a.source,
        status: a.status,
        appliedAt: a.appliedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(request: Request) {
  const gate = await requireJobAgentAccess();
  if (!gate.ok) return Response.json({ success: false, error: gate.error }, { status: gate.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const jobTitles = body.jobTitles !== undefined ? asStringArray(body.jobTitles) : undefined;
  const workTypes = body.workTypes !== undefined ? asStringArray(body.workTypes) : undefined;
  const enabledBoards = body.enabledBoards !== undefined ? normalizeBoardIds(body.enabledBoards) : undefined;

  const data: Record<string, unknown> = {};
  if (jobTitles) data.jobTitles = jobTitles;
  if (workTypes) data.workTypes = workTypes.length ? workTypes : ["full_time"];
  if (enabledBoards) data.enabledBoards = enabledBoards;
  if (typeof body.city === "string" || body.city === null)
    data.city = body.city === null ? null : String(body.city).trim() || null;
  if (typeof body.country === "string" || body.country === null)
    data.country = body.country === null ? null : String(body.country).trim() || null;
  if (typeof body.region === "string" || body.region === null)
    data.region = body.region === null ? null : String(body.region).trim() || null;
  if (typeof body.remoteOk === "boolean") data.remoteOk = body.remoteOk;
  if (typeof body.autoApplyEnabled === "boolean") data.autoApplyEnabled = body.autoApplyEnabled;
  if (typeof body.targetApplicationsPerDay === "number") {
    data.targetApplicationsPerDay = Math.min(50, Math.max(1, Math.round(body.targetApplicationsPerDay)));
  }
  if (typeof body.notes === "string" || body.notes === null)
    data.notes = body.notes === null ? null : String(body.notes).slice(0, 4000);
  if (body.contactEmail !== undefined) {
    if (body.contactEmail === null || body.contactEmail === "") data.contactEmail = null;
    else {
      const email = normalizeContactEmail(body.contactEmail);
      if (!email) {
        return Response.json({ success: false, error: "Enter a valid contact email." }, { status: 400 });
      }
      data.contactEmail = email;
    }
  }
  if (typeof body.contactName === "string" || body.contactName === null)
    data.contactName = body.contactName === null ? null : String(body.contactName).trim().slice(0, 120) || null;
  if (typeof body.contactPhone === "string" || body.contactPhone === null)
    data.contactPhone = body.contactPhone === null ? null : String(body.contactPhone).trim().slice(0, 40) || null;

  const existing = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
  const row = existing
    ? await prisma.jobAgentProfile.update({ where: { userId: gate.userId }, data })
    : await prisma.jobAgentProfile.create({
        data: {
          userId: gate.userId,
          jobTitles: (data.jobTitles as string[]) ?? [],
          workTypes: (data.workTypes as string[]) ?? ["full_time"],
          enabledBoards: (data.enabledBoards as string[]) ?? [...DEFAULT_ENABLED_BOARDS],
          city: (data.city as string | null) ?? null,
          country: (data.country as string | null) ?? null,
          region: (data.region as string | null) ?? null,
          remoteOk: (data.remoteOk as boolean) ?? true,
          autoApplyEnabled: (data.autoApplyEnabled as boolean) ?? false,
          targetApplicationsPerDay: (data.targetApplicationsPerDay as number) ?? 10,
          contactEmail: (data.contactEmail as string | null) ?? null,
          contactName: (data.contactName as string | null) ?? null,
          contactPhone: (data.contactPhone as string | null) ?? null,
          notes: (data.notes as string | null) ?? null,
        },
      });

  return Response.json({ success: true, profile: serializeProfile(row) });
}
