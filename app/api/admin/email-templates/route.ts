import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getAdminEmailPreset } from "@/lib/admin-email-presets";
import {
  archiveBuiltInPreset,
  archiveCustomTemplate,
  deleteAdminEmailTemplatePermanently,
  listAdminEmailTemplates,
  restoreAdminEmailTemplate,
  saveAdminEmailTemplate,
} from "@/lib/admin-email-templates";
import { parseAnnouncementEmailTemplate } from "@/lib/announcement-email";
import type { PartnerBrandEmail } from "@/lib/partner-logos-email";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const data = await listAdminEmailTemplates();
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    console.error("admin/email-templates GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action as string | undefined;

    if (action === "archive-preset") {
      const presetId = String(body.presetId ?? "");
      const preset = getAdminEmailPreset(presetId);
      if (!preset) {
        return NextResponse.json({ success: false, error: "Unknown preset." }, { status: 400 });
      }
      const template = await archiveBuiltInPreset(session?.user?.id ?? null, preset);
      return NextResponse.json({ success: true, template });
    }

    if (action === "archive") {
      const id = String(body.id ?? "");
      if (!id) return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
      const template = await archiveCustomTemplate(id);
      return NextResponse.json({ success: true, template });
    }

    if (action === "restore") {
      const id = String(body.id ?? "");
      if (!id) return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
      const result = await restoreAdminEmailTemplate(id);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "delete") {
      const id = String(body.id ?? "");
      if (!id) return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
      await deleteAdminEmailTemplatePermanently(id);
      return NextResponse.json({ success: true });
    }

    const template = await saveAdminEmailTemplate(session?.user?.id ?? null, {
      label: String(body.label ?? "Saved template"),
      subject: String(body.subject ?? ""),
      body: String(body.body ?? ""),
      template: parseAnnouncementEmailTemplate(String(body.template ?? "nova-branded")),
      format: body.format === "plain" ? "plain" : "rich",
      includePartnerLogos: !!body.includePartnerLogos,
      partnerBrand: (body.partnerBrand as PartnerBrandEmail) ?? "blofin",
      ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : null,
      ctaUrl: typeof body.ctaUrl === "string" ? body.ctaUrl : null,
    });
    return NextResponse.json({ success: true, template });
  } catch (e) {
    console.error("admin/email-templates POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 400 }
    );
  }
}
