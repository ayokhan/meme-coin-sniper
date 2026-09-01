import { prisma } from "@/lib/db";
import type { AdminEmailPreset } from "@/lib/admin-email-presets";
import type { AnnouncementEmailTemplate } from "@/lib/announcement-email";
import type { PartnerBrandEmail } from "@/lib/partner-logos-email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type AdminEmailTemplateStatus = "active" | "archived" | "deleted";

export type AdminEmailTemplateRow = {
  id: string;
  label: string;
  subject: string;
  body: string;
  template: string;
  format: string;
  includePartnerLogos: boolean;
  partnerBrand: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sourcePresetId: string | null;
  status: AdminEmailTemplateStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
};

function toRow(r: Record<string, unknown>): AdminEmailTemplateRow {
  return {
    id: r.id as string,
    label: r.label as string,
    subject: r.subject as string,
    body: r.body as string,
    template: r.template as string,
    format: r.format as string,
    includePartnerLogos: !!r.includePartnerLogos,
    partnerBrand: (r.partnerBrand as string | null) ?? null,
    ctaLabel: (r.ctaLabel as string | null) ?? null,
    ctaUrl: (r.ctaUrl as string | null) ?? null,
    sourcePresetId: (r.sourcePresetId as string | null) ?? null,
    status: r.status as AdminEmailTemplateStatus,
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
    archivedAt: r.archivedAt ? (r.archivedAt as Date).toISOString() : null,
    deletedAt: r.deletedAt ? (r.deletedAt as Date).toISOString() : null,
  };
}

export async function listAdminEmailTemplates(): Promise<{
  active: AdminEmailTemplateRow[];
  archived: AdminEmailTemplateRow[];
  archivedPresetIds: string[];
}> {
  const rows = await db.adminEmailTemplate.findMany({
    where: { status: { in: ["active", "archived"] } },
    orderBy: { updatedAt: "desc" },
  });
  const mapped = rows.map(toRow);
  const archivedPresetIds = mapped
    .filter((r) => r.status === "archived" && r.sourcePresetId)
    .map((r) => r.sourcePresetId as string);
  return {
    active: mapped.filter((r) => r.status === "active" && !r.sourcePresetId),
    archived: mapped.filter((r) => r.status === "archived"),
    archivedPresetIds,
  };
}

export async function saveAdminEmailTemplate(
  userId: string | null,
  data: {
    label: string;
    subject: string;
    body: string;
    template: AnnouncementEmailTemplate;
    format: "rich" | "plain";
    includePartnerLogos: boolean;
    partnerBrand: PartnerBrandEmail;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
  }
) {
  const row = await db.adminEmailTemplate.create({
    data: {
      label: data.label.trim().slice(0, 120) || "Saved template",
      subject: data.subject.trim(),
      body: data.body,
      template: data.template,
      format: data.format,
      includePartnerLogos: data.includePartnerLogos,
      partnerBrand: data.partnerBrand,
      ctaLabel: data.ctaLabel?.trim() || null,
      ctaUrl: data.ctaUrl?.trim() || null,
      status: "active",
      createdByUserId: userId,
    },
  });
  return toRow(row);
}

export async function archiveBuiltInPreset(userId: string | null, preset: AdminEmailPreset) {
  const existing = await db.adminEmailTemplate.findFirst({
    where: { sourcePresetId: preset.id, status: { in: ["active", "archived"] } },
  });
  if (existing) {
    const row = await db.adminEmailTemplate.update({
      where: { id: existing.id },
      data: { status: "archived", archivedAt: new Date(), deletedAt: null },
    });
    return toRow(row);
  }
  const row = await db.adminEmailTemplate.create({
    data: {
      label: preset.label,
      subject: preset.subject,
      body: preset.body,
      template: preset.template,
      format: "rich",
      includePartnerLogos: preset.includePartnerLogos,
      partnerBrand: preset.partnerBrand,
      ctaLabel: preset.ctaLabel,
      ctaUrl: preset.ctaUrl,
      sourcePresetId: preset.id,
      status: "archived",
      archivedAt: new Date(),
      createdByUserId: userId,
    },
  });
  return toRow(row);
}

export async function archiveCustomTemplate(id: string) {
  const row = await db.adminEmailTemplate.update({
    where: { id },
    data: { status: "archived", archivedAt: new Date() },
  });
  return toRow(row);
}

export async function restoreAdminEmailTemplate(id: string) {
  const row = await db.adminEmailTemplate.findUnique({ where: { id } });
  if (!row) throw new Error("Template not found.");
  if (row.sourcePresetId) {
    await db.adminEmailTemplate.delete({ where: { id } });
    return { restored: true, deletedArchiveRow: true, sourcePresetId: row.sourcePresetId as string };
  }
  const updated = await db.adminEmailTemplate.update({
    where: { id },
    data: { status: "active", archivedAt: null },
  });
  return { restored: true, template: toRow(updated) };
}

export async function deleteAdminEmailTemplatePermanently(id: string) {
  const row = await db.adminEmailTemplate.findUnique({ where: { id } });
  if (!row) throw new Error("Template not found.");
  await db.adminEmailTemplate.update({
    where: { id },
    data: { status: "deleted", deletedAt: new Date() },
  });
  return { deleted: true };
}
