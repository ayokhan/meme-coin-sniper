import { FOREX_PARTNER_BROKER_IDS, FOREX_BROKER_LABELS } from "@/lib/forex-broker-user-config";
import type { ForexPartnerBrokerId } from "@/lib/forex-broker-user-config";

export const REBATE_BROKERS = [...FOREX_PARTNER_BROKER_IDS, "other"] as const;
export type RebateBrokerId = (typeof REBATE_BROKERS)[number];

export const REBATE_REWARD_TYPES = [
  { value: "percent", label: "% of your IB commission" },
  { value: "usd", label: "Flat $ amount" },
  { value: "per_lot", label: "$ per lot" },
] as const;

export type RebateRewardType = (typeof REBATE_REWARD_TYPES)[number]["value"];

export const REBATE_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
] as const;

export type RebateStatus = (typeof REBATE_STATUSES)[number]["value"];

export function isRebateBrokerId(v: unknown): v is RebateBrokerId {
  return typeof v === "string" && (REBATE_BROKERS as readonly string[]).includes(v);
}

export function isRebateRewardType(v: unknown): v is RebateRewardType {
  return typeof v === "string" && REBATE_REWARD_TYPES.some((x) => x.value === v);
}

export function isRebateStatus(v: unknown): v is RebateStatus {
  return typeof v === "string" && REBATE_STATUSES.some((x) => x.value === v);
}

export function rebateBrokerLabel(broker: string): string {
  if (broker === "other") return "Other";
  if ((FOREX_PARTNER_BROKER_IDS as readonly string[]).includes(broker)) {
    return FOREX_BROKER_LABELS[broker as ForexPartnerBrokerId];
  }
  return broker;
}

export function formatRebateReward(type: string, value: number): string {
  if (type === "percent") return `${value}% of IB commission`;
  if (type === "per_lot") return `$${value}/lot`;
  return `$${value}`;
}
