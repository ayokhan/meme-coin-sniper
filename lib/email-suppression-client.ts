/** Client-safe suppression filter (no server imports). */
export function applyEmailSuppression(emails: string[], suppressed: Set<string> | string[]): string[] {
  const set = suppressed instanceof Set ? suppressed : new Set(suppressed);
  if (set.size === 0) return emails;
  return emails.filter((e) => !set.has(e.trim().toLowerCase()));
}
