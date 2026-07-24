/** Pull first plausible email from resume/plain text. */
export function extractEmailFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m?.[0]?.toLowerCase() ?? null;
}

export function normalizeContactEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v.slice(0, 200);
}

/**
 * Email that should appear on employer-facing materials.
 * Priority: profile contactEmail → resume text → account email.
 */
export function resolveApplicantEmail(args: {
  contactEmail?: string | null;
  resumeText?: string | null;
  accountEmail?: string | null;
}): string | null {
  return (
    normalizeContactEmail(args.contactEmail) ||
    extractEmailFromText(args.resumeText) ||
    normalizeContactEmail(args.accountEmail)
  );
}
