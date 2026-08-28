/** Browser visitor id for guest quotas (persists across sessions in same browser). */
export const VISITOR_ID_KEY = "novastaris_visitor_id";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function normalizeVisitorId(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim().slice(0, 64);
  return id.length >= 8 ? id : null;
}
