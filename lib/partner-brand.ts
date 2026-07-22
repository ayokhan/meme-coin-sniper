/** Shared partner brand ids for logos (in-app banners + email). */
export type PartnerBrand = "blofin" | "vantage" | "tiomarkets";

export function normalizePartnerBrand(raw: unknown): PartnerBrand {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "vantage") return "vantage";
  if (s === "tiomarkets") return "tiomarkets";
  return "blofin";
}
