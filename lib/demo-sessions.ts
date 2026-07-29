/** Demo session registration helpers. */

export const DEMO_EXPERIENCE_LEVELS = [
  { value: "none", label: "None / just starting" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export type DemoExperienceLevel = (typeof DEMO_EXPERIENCE_LEVELS)[number]["value"];

export const DEMO_SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "direct", label: "Direct link" },
  { value: "other", label: "Other" },
] as const;

export const DEMO_PAYMENT_STATUSES = ["free", "pending", "paid", "waived"] as const;
export type DemoPaymentStatus = (typeof DEMO_PAYMENT_STATUSES)[number];

export const DEFAULT_DEMO_PAGE_EYEBROW = "Session registration";
export const DEFAULT_DEMO_SUBMIT_LABEL = "Complete registration";

export function slugifyDemoTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `demo-${Date.now()}`;
}

export function isValidDemoExperience(v: unknown): v is DemoExperienceLevel {
  return typeof v === "string" && DEMO_EXPERIENCE_LEVELS.some((x) => x.value === v);
}

export function publicDemoUrl(slug: string): string {
  return `https://novastaris.ai/demo/${encodeURIComponent(slug)}`;
}

export function shareTextForDemo(title: string, slug: string, sessionAt?: Date | null): string {
  const when = sessionAt
    ? ` — ${sessionAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
    : "";
  return `Join this NovaStaris session: ${title}${when}\n${publicDemoUrl(slug)}`;
}

export function isPaidDemoSession(priceUsdCents: number | null | undefined): boolean {
  return typeof priceUsdCents === "number" && priceUsdCents > 0;
}

export function formatDemoPriceUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

