/** Email Studio sending: segments, suppression, weekly cap, tracked links, batched delivery, stats (server only). */
import { getAnnouncementEmailStats } from "@/lib/announcement-email";
import { studioDb } from "@/lib/email-studio-db";
import { filterSuppressedEmails, getSuppressedEmailSet } from "@/lib/email-suppression";
import {
  marketingHeaders,
  normalizeEmailAddress,
  openPixelUrl,
  trackedClickUrl,
  unsubscribePageUrl,
} from "@/lib/email-links";
import { sendEmailBatch, sendEmailDetailed } from "@/lib/send-email";
import {
  STUDIO_WEEKLY_CAP,
  renderStudioEmail,
  studioPlainText,
  type StudioDraft,
  type StudioSegment,
} from "@/lib/email-studio-types";

const WEEK_MS = 7 * 86_400_000;
const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 600;

export function parseStudioSegment(raw: unknown): StudioSegment {
  return raw === "vip" || raw === "free" || raw === "inactive7d" || raw === "all" ? raw : "newsletter";
}

export async function getStudioSegmentCounts(): Promise<Record<StudioSegment, number>> {
  const s = await getAnnouncementEmailStats();
  return {
    newsletter: s.newsletterEmails.length,
    vip: s.vipEmails.length,
    free: s.freeEmails.length,
    inactive7d: s.inactive7dEmails.length,
    all: s.allEmails.length,
  };
}

async function segmentEmails(segment: StudioSegment): Promise<string[]> {
  const s = await getAnnouncementEmailStats();
  const list =
    segment === "vip"
      ? s.vipEmails
      : segment === "free"
        ? s.freeEmails
        : segment === "inactive7d"
          ? s.inactive7dEmails
          : segment === "all"
            ? s.allEmails
            : s.newsletterEmails;
  return [...new Set(list.map(normalizeEmailAddress).filter((e) => e.includes("@")))];
}

async function cappedEmails(emails: string[]): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const rows = await studioDb().emailStudioRecipient.groupBy({
    by: ["email"],
    where: { status: "sent", sentAt: { gte: new Date(Date.now() - WEEK_MS) } },
    _count: { _all: true },
  });
  return new Set(rows.filter((r) => r._count._all >= STUDIO_WEEKLY_CAP).map((r) => r.email));
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** Hand-picked addresses from the admin UI: normalized, valid, deduped. */
export function parsePickedEmails(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return [
    ...new Set(
      raw
        .filter((e): e is string => typeof e === "string")
        .map(normalizeEmailAddress)
        .filter((e) => EMAIL_RE.test(e))
    ),
  ].slice(0, 20_000);
}

/**
 * Who would receive a send right now, after suppressions and the weekly cap.
 * With `picked`, only those addresses are considered (they still pass the same filters).
 */
export async function previewStudioAudience(segment: StudioSegment, picked?: string[] | null) {
  const base = picked ?? (await segmentEmails(segment));
  const suppressedSet = await getSuppressedEmailSet();
  const afterSuppression = filterSuppressedEmails(base, suppressedSet);
  const afterSet = new Set(afterSuppression);
  const capped = await cappedEmails(afterSuppression);
  const recipients = afterSuppression.filter((e) => !capped.has(e));
  return {
    recipients,
    suppressed: base.filter((e) => !afterSet.has(e)),
    capped: afterSuppression.filter((e) => capped.has(e)),
    segmentCount: base.length,
    suppressedCount: base.length - afterSuppression.length,
    cappedCount: afterSuppression.length - recipients.length,
  };
}

function draftUrls(draft: StudioDraft): string[] {
  const urls = new Set<string>();
  renderStudioEmail(draft, {
    link: (u) => {
      urls.add(u);
      return u;
    },
  });
  return [...urls];
}

async function personalize(draft: StudioDraft, email: string, recipientId: string | null) {
  const urls = draftUrls(draft);
  const tracked = new Map<string, string>();
  if (recipientId) {
    await Promise.all(urls.map(async (u) => tracked.set(u, await trackedClickUrl(recipientId, u))));
  }
  const html = renderStudioEmail(draft, {
    link: (u) => tracked.get(u) ?? u,
    unsubscribeUrl: await unsubscribePageUrl(email),
    pixelUrl: recipientId ? openPixelUrl(recipientId) : null,
  });
  return { html, text: studioPlainText(draft), headers: await marketingHeaders(email) };
}

export async function sendStudioTest(draft: StudioDraft, to: string) {
  const { html, headers } = await personalize(draft, to, null);
  return sendEmailDetailed(to, `[Test] ${draft.subject}`, html, { headers });
}

export async function sendStudioCampaign(input: {
  draft: StudioDraft;
  segment: StudioSegment;
  picked?: string[] | null;
  createdByUserId: string | null;
}) {
  const { draft, segment, picked } = input;
  const audience = await previewStudioAudience(segment, picked);
  if (!audience.recipients.length) {
    throw new Error(
      audience.cappedCount
        ? "Everyone selected already got 2 Studio emails in the last 7 days."
        : "No one to send to. Select at least one recipient."
    );
  }

  const campaign = await studioDb().emailStudioCampaign.create({
    data: {
      angle: draft.angle,
      subject: draft.subject,
      segment: picked ? `${segment}:picked` : segment,
      html: renderStudioEmail(draft),
      recipientCount: audience.recipients.length,
      cappedCount: audience.cappedCount,
      createdByUserId: input.createdByUserId,
    },
  });
  await studioDb().emailStudioRecipient.createMany({
    data: audience.recipients.map((email) => ({ campaignId: campaign.id, email })),
  });
  const rows = await studioDb().emailStudioRecipient.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, email: true },
  });

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const items = await Promise.all(
      chunk.map(async (r) => ({ to: r.email, subject: draft.subject, ...(await personalize(draft, r.email, r.id)) }))
    );
    const results = await sendEmailBatch(items);
    const now = new Date();
    const okIds = chunk.filter((_, j) => results[j]?.ok).map((r) => r.id);
    const failedByError = new Map<string, string[]>();
    chunk.forEach((r, j) => {
      const res = results[j];
      if (res && !res.ok) failedByError.set(res.error, [...(failedByError.get(res.error) ?? []), r.id]);
    });
    if (okIds.length) {
      await studioDb().emailStudioRecipient.updateMany({ where: { id: { in: okIds } }, data: { status: "sent", sentAt: now } });
    }
    for (const [error, ids] of failedByError) {
      await studioDb().emailStudioRecipient.updateMany({
        where: { id: { in: ids } },
        data: { status: "failed", error: error.slice(0, 500) },
      });
    }
    sent += okIds.length;
    failed += chunk.length - okIds.length;
    await studioDb().emailStudioCampaign.update({ where: { id: campaign.id }, data: { sentCount: sent, failedCount: failed } });
    if (i + BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  }

  await studioDb().emailStudioCampaign.update({
    where: { id: campaign.id },
    data: { status: sent > 0 ? "sent" : "failed", sentAt: new Date(), sentCount: sent, failedCount: failed },
  });
  return {
    campaignId: campaign.id,
    sent,
    failed,
    cappedCount: audience.cappedCount,
    suppressedCount: audience.suppressedCount,
  };
}

export type StudioCampaignRow = {
  id: string;
  angle: string;
  subject: string;
  segment: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  cappedCount: number;
  opened: number;
  clicked: number;
  createdAt: string;
  sentAt: string | null;
};

export async function listStudioCampaigns(limit = 25): Promise<StudioCampaignRow[]> {
  const campaigns = await studioDb().emailStudioCampaign.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  if (!campaigns.length) return [];
  const ids = campaigns.map((c) => c.id);
  const [opened, clicked] = await Promise.all([
    studioDb().emailStudioRecipient.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids }, openedAt: { not: null } },
      _count: { _all: true },
    }),
    studioDb().emailStudioRecipient.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids }, clickedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const openMap = new Map(opened.map((o) => [o.campaignId, o._count._all]));
  const clickMap = new Map(clicked.map((o) => [o.campaignId, o._count._all]));
  return campaigns.map((c) => ({
    id: c.id,
    angle: c.angle,
    subject: c.subject,
    segment: c.segment,
    status: c.status,
    recipientCount: c.recipientCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    cappedCount: c.cappedCount,
    opened: openMap.get(c.id) ?? 0,
    clicked: clickMap.get(c.id) ?? 0,
    createdAt: c.createdAt.toISOString(),
    sentAt: c.sentAt?.toISOString() ?? null,
  }));
}
