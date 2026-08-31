import { prisma } from "@/lib/db";

export type EmailSuppressionRow = {
  id: string;
  email: string;
  reason: string | null;
  note: string | null;
  createdAt: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function suppressionDb() {
  return prisma as unknown as {
    emailSuppression: {
      findMany: (args?: unknown) => Promise<
        Array<{
          id: string;
          email: string;
          reason: string | null;
          note: string | null;
          createdAt: Date;
        }>
      >;
      findUnique: (args: unknown) => Promise<{ id: string; email: string } | null>;
      create: (args: unknown) => Promise<{ id: string; email: string }>;
      delete: (args: unknown) => Promise<unknown>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  };
}

export async function listEmailSuppressions(): Promise<EmailSuppressionRow[]> {
  try {
    const rows = await suppressionDb().emailSuppression.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      reason: r.reason,
      note: r.note,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  } catch {
    return [];
  }
}

export async function getSuppressedEmailSet(): Promise<Set<string>> {
  const rows = await listEmailSuppressions();
  return new Set(rows.map((r) => r.email));
}

export function filterSuppressedEmails(emails: string[], suppressed: Set<string>): string[] {
  if (suppressed.size === 0) return emails;
  return emails.filter((e) => !suppressed.has(normalizeEmail(e)));
}

export async function addEmailSuppressions(
  emails: string[],
  opts?: { reason?: string; note?: string; createdByUserId?: string | null }
): Promise<{ added: string[]; skipped: string[] }> {
  const added: string[] = [];
  const skipped: string[] = [];
  const reason = opts?.reason ?? "manual";

  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || !email.includes("@")) continue;
    try {
      const existing = await suppressionDb().emailSuppression.findUnique({ where: { email } });
      if (existing) {
        skipped.push(email);
        continue;
      }
      await suppressionDb().emailSuppression.create({
        data: {
          email,
          reason,
          note: opts?.note ?? null,
          createdByUserId: opts?.createdByUserId ?? null,
        },
      });
      added.push(email);
    } catch {
      skipped.push(email);
    }
  }

  return { added, skipped };
}

export async function removeEmailSuppression(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  try {
    await suppressionDb().emailSuppression.delete({ where: { email: normalized } });
    return true;
  } catch {
    return false;
  }
}

export async function removeEmailSuppressions(emails: string[]): Promise<number> {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (normalized.length === 0) return 0;
  try {
    const result = await suppressionDb().emailSuppression.deleteMany({
      where: { email: { in: normalized } },
    });
    return result.count;
  } catch {
    return 0;
  }
}
