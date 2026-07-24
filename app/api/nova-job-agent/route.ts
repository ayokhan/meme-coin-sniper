import { NextResponse } from "next/server";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";
import { asStringArray, requireJobAgentOwner } from "@/lib/nova-job-agent/access";

export const dynamic = "force-dynamic";

function serializeProfile(row: {
  id: string;
  jobTitles: unknown;
  city: string | null;
  country: string | null;
  region: string | null;
  remoteOk: boolean;
  workTypes: unknown;
  autoApplyEnabled: boolean;
  targetApplicationsPerDay: number;
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
    autoApplyEnabled: row.autoApplyEnabled,
    targetApplicationsPerDay: row.targetApplicationsPerDay,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const gate = await requireJobAgentOwner();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

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

  const counts = {
    total: apps.length,
    applied: apps.filter((a) => a.status === "applied").length,
    prepared: apps.filter((a) => a.status === "prepared").length,
    queued: apps.filter((a) => a.status === "queued").length,
    failed: apps.filter((a) => a.status === "failed").length,
    skipped: apps.filter((a) => a.status === "skipped").length,
  };

  // Recount from DB for accurate totals beyond last 100
  const grouped = await prisma.jobAgentApplication.groupBy({
    by: ["status"],
    where: { userId: gate.userId },
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  let totalAll = 0;
  for (const g of grouped) {
    byStatus[g.status] = g._count._all;
    totalAll += g._count._all;
  }

  return NextResponse.json({
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
          autoApplyEnabled: false,
          targetApplicationsPerDay: 10,
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
      recent: apps.slice(0, 20).map((a) => ({
        id: a.id,
        jobTitle: a.jobTitle,
        company: a.company,
        location: a.location,
        workType: a.workType,
        jobUrl: a.jobUrl,
        status: a.status,
        appliedAt: a.appliedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      // keep small local counts for UI that only looked at recent page
      recentWindow: counts,
    },
  });
}

export async function PATCH(request: Request) {
  const gate = await requireJobAgentOwner();
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const jobTitles = body.jobTitles !== undefined ? asStringArray(body.jobTitles) : undefined;
  const workTypes = body.workTypes !== undefined ? asStringArray(body.workTypes) : undefined;

  const data: {
    jobTitles?: string[];
    workTypes?: string[];
    city?: string | null;
    country?: string | null;
    region?: string | null;
    remoteOk?: boolean;
    autoApplyEnabled?: boolean;
    targetApplicationsPerDay?: number;
    notes?: string | null;
  } = {};

  if (jobTitles) data.jobTitles = jobTitles;
  if (workTypes) data.workTypes = workTypes.length ? workTypes : ["full_time"];
  if (typeof body.city === "string" || body.city === null) data.city = body.city === null ? null : String(body.city).trim() || null;
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

  const existing = await prisma.jobAgentProfile.findUnique({ where: { userId: gate.userId } });
  const row = existing
    ? await prisma.jobAgentProfile.update({
        where: { userId: gate.userId },
        data: {
          ...(data.jobTitles ? { jobTitles: data.jobTitles } : {}),
          ...(data.workTypes ? { workTypes: data.workTypes } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.country !== undefined ? { country: data.country } : {}),
          ...(data.region !== undefined ? { region: data.region } : {}),
          ...(data.remoteOk !== undefined ? { remoteOk: data.remoteOk } : {}),
          ...(data.autoApplyEnabled !== undefined ? { autoApplyEnabled: data.autoApplyEnabled } : {}),
          ...(data.targetApplicationsPerDay !== undefined
            ? { targetApplicationsPerDay: data.targetApplicationsPerDay }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      })
    : await prisma.jobAgentProfile.create({
        data: {
          userId: gate.userId,
          jobTitles: data.jobTitles ?? [],
          workTypes: data.workTypes ?? ["full_time"],
          city: data.city ?? null,
          country: data.country ?? null,
          region: data.region ?? null,
          remoteOk: data.remoteOk ?? true,
          autoApplyEnabled: data.autoApplyEnabled ?? false,
          targetApplicationsPerDay: data.targetApplicationsPerDay ?? 10,
          notes: data.notes ?? null,
        },
      });

  return NextResponse.json({ success: true, profile: serializeProfile(row) });
}
