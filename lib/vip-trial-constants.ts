/** Client-safe VIP trial / cancel survey constants (no server imports). */

export const VIP_CANCEL_SURVEY_REASONS = [
  { id: "too_expensive", label: "Too expensive" },
  { id: "didnt_understand", label: "Didn’t understand the tools enough" },
  { id: "not_enough_time", label: "Not enough time to try" },
  { id: "missing_features", label: "Missing features I need" },
  { id: "prefer_free", label: "Prefer free tools only" },
  { id: "other", label: "Other" },
] as const;

export type VipCancelReasonId = (typeof VIP_CANCEL_SURVEY_REASONS)[number]["id"];
