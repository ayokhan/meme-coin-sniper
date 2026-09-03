/** Shared partner brand ids for logos (in-app banners + email). */
export type PartnerBrand = "blofin" | "coinbase" | "vantage" | "tiomarkets" | "assexmarkets";

export function normalizePartnerBrand(raw: unknown): PartnerBrand {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "coinbase") return "coinbase";
  if (s === "vantage") return "vantage";
  if (s === "tiomarkets") return "tiomarkets";
  if (s === "assexmarkets" || s === "myaccessmarkets") return "assexmarkets";
  return "blofin";
}
