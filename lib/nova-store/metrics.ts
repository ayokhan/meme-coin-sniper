import {
  STORE_DONATION_PER_ITEM_USD,
  VIP_DONATION_PER_SUBSCRIPTION_USD,
} from "@/lib/nova-store/giving";
import type { StoreOrderItemSnapshot } from "@/lib/nova-store/constants";

export const CHARITY_PURPOSE_STORE = "sickkids_store";
export const CHARITY_PURPOSE_VIP = "sickkids_vip";

export const STORE_DONATION_PER_ITEM_CENTS = STORE_DONATION_PER_ITEM_USD * 100;
export const VIP_DONATION_PER_SUB_CENTS = VIP_DONATION_PER_SUBSCRIPTION_USD * 100;

const PAID_ORDER_STATUSES = new Set(["paid", "fulfilled"]);

export function parseOrderItems(itemsJson: unknown): StoreOrderItemSnapshot[] {
  if (!Array.isArray(itemsJson)) return [];
  const out: StoreOrderItemSnapshot[] = [];
  for (const raw of itemsJson) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0));
    const unitPriceCents = Math.max(0, Math.round(Number(row.unitPriceCents) || 0));
    if (quantity < 1) continue;
    out.push({
      productId: String(row.productId ?? ""),
      variantId: String(row.variantId ?? ""),
      productName: String(row.productName ?? "Item"),
      variantLabel: String(row.variantLabel ?? ""),
      quantity,
      unitPriceCents,
      imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : null,
    });
  }
  return out;
}

export function countItemsInOrder(itemsJson: unknown): number {
  return parseOrderItems(itemsJson).reduce((s, i) => s + i.quantity, 0);
}

export function isPaidStoreOrder(status: string): boolean {
  return PAID_ORDER_STATUSES.has(status);
}

export type StoreSalesSummary = {
  paidOrders: number;
  itemsSold: number;
  revenueCents: number;
  sickKidsOwedCents: number;
  sickKidsRemittedCents: number;
  sickKidsOutstandingCents: number;
};

export function summarizeStoreOrders(
  orders: {
    status: string;
    totalCents: number;
    itemsJson: unknown;
    paidAt?: Date | string | null;
    createdAt?: Date | string | null;
  }[],
  remittedCents: number,
  storeStartsAt?: Date | null
): StoreSalesSummary {
  let paidOrders = 0;
  let itemsSold = 0;
  let revenueCents = 0;
  for (const o of orders) {
    if (!isPaidStoreOrder(o.status)) continue;
    if (storeStartsAt) {
      const t = o.paidAt ? new Date(o.paidAt) : o.createdAt ? new Date(o.createdAt) : null;
      if (!t || Number.isNaN(t.getTime()) || t < storeStartsAt) continue;
    }
    paidOrders += 1;
    itemsSold += countItemsInOrder(o.itemsJson);
    revenueCents += Math.max(0, o.totalCents);
  }
  const sickKidsOwedCents = itemsSold * STORE_DONATION_PER_ITEM_CENTS;
  const sickKidsRemittedCents = Math.max(0, remittedCents);
  return {
    paidOrders,
    itemsSold,
    revenueCents,
    sickKidsOwedCents,
    sickKidsRemittedCents,
    sickKidsOutstandingCents: Math.max(0, sickKidsOwedCents - sickKidsRemittedCents),
  };
}
