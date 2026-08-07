import { VIP_PLANS } from "@/lib/subscription";

export const ADMIN_VIP_GRANTS = [
  { id: "5min", label: "5 min", minutes: 5 },
  { id: "1day", label: "1 day", days: 1 },
  { id: "3day", label: "3 days", days: 3 },
  { id: "1week", label: "1 week Free", days: 7 },
  { id: "1month", label: "1 month", months: 1, planId: "1month" as const },
  { id: "3month", label: "3 months", months: 3 },
  { id: "6month", label: "6 months", months: 6, planId: "6month" as const },
  { id: "12month", label: "12 months", months: 12, planId: "12month" as const },
] as const;

export type AdminVipGrantId = (typeof ADMIN_VIP_GRANTS)[number]["id"];

/** Quick-grant buttons on the Customers table row (owner). */
export const ADMIN_VIP_QUICK_GRANTS: readonly AdminVipGrantId[] = ["3day", "1week", "1month"];

export function isAdminVipGrantId(value: string): value is AdminVipGrantId {
  return ADMIN_VIP_GRANTS.some((g) => g.id === value);
}

export function addAdminVipGrantDuration(base: Date, grantId: AdminVipGrantId): Date {
  const grant = ADMIN_VIP_GRANTS.find((g) => g.id === grantId);
  if (!grant) throw new Error("Invalid grant");
  const result = new Date(base);
  if ("minutes" in grant && grant.minutes) {
    result.setMinutes(result.getMinutes() + grant.minutes);
    return result;
  }
  if ("days" in grant && grant.days) {
    result.setDate(result.getDate() + grant.days);
    return result;
  }
  const months = "months" in grant ? grant.months : 1;
  result.setMonth(result.getMonth() + months);
  return result;
}

export function planIdForAdminGrant(grantId: AdminVipGrantId): string {
  const grant = ADMIN_VIP_GRANTS.find((g) => g.id === grantId);
  if (!grant) return "1month";
  if ("planId" in grant && grant.planId) return grant.planId;
  return `admin-${grantId}`;
}

export function listPriceForAdminGrantPlan(planId: string): number {
  const plan = VIP_PLANS.find((p) => p.id === planId);
  return plan?.priceUsd ?? 0;
}

export function grantLabel(grantId: AdminVipGrantId): string {
  return ADMIN_VIP_GRANTS.find((g) => g.id === grantId)?.label ?? grantId;
}
