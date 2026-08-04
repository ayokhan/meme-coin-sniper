import { PublicKey } from "@solana/web3.js";
import { FOREX_PARTNER_BROKER_IDS, FOREX_BROKER_LABELS } from "@/lib/forex-broker-user-config";
import type { ForexPartnerBrokerId } from "@/lib/forex-broker-user-config";

export const REBATE_BROKERS = [...FOREX_PARTNER_BROKER_IDS, "other"] as const;
export type RebateBrokerId = (typeof REBATE_BROKERS)[number];

/**
 * Brokers that run the NovaStaris customer $2/lot USDC rebate program.
 * Other partners may still be connectable without a rebate offer.
 */
export const FOREX_REBATE_OFFER_BROKERS = ["tiomarkets"] as const;
export type ForexRebateOfferBrokerId = (typeof FOREX_REBATE_OFFER_BROKERS)[number];

export function brokerOffersPartnerRebate(broker: string | null | undefined): boolean {
  if (!broker) return false;
  return (FOREX_REBATE_OFFER_BROKERS as readonly string[]).includes(broker);
}

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

/** Default customer rebate share from IB commission. */
export const DEFAULT_REBATE_REWARD_TYPE: RebateRewardType = "per_lot";
export const DEFAULT_REBATE_REWARD_VALUE = 2;

export function isRebateBrokerId(v: unknown): v is RebateBrokerId {
  return typeof v === "string" && (REBATE_BROKERS as readonly string[]).includes(v);
}

export function isRebatePartnerBrokerId(v: unknown): v is ForexPartnerBrokerId {
  return typeof v === "string" && (FOREX_PARTNER_BROKER_IDS as readonly string[]).includes(v);
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidRebateEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Solana address check for USDC payout wallets. */
export function isValidSolanaUsdcWallet(address: string): boolean {
  const a = address.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return false;
  try {
    // eslint-disable-next-line no-new
    new PublicKey(a);
    return true;
  } catch {
    return false;
  }
}

export function shortenWallet(address: string, head = 4, tail = 4): string {
  const a = address.trim();
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}
