/** Shared Nova Store constants (apparel sizes, categories, free shipping). */

export const NOVA_STORE_APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

export type NovaStoreApparelSize = (typeof NOVA_STORE_APPAREL_SIZES)[number];

export const NOVA_STORE_CATEGORIES = [
  { value: "apparel", label: "Apparel" },
  { value: "drinkware", label: "Drinkware" },
  { value: "accessory", label: "Accessories" },
  { value: "other", label: "Other" },
] as const;

export type NovaStoreCategory = (typeof NOVA_STORE_CATEGORIES)[number]["value"];

/** Free shipping for v1 (ships from Canada). */
export const NOVA_STORE_SHIPPING_CENTS = 0;

export const NOVA_STORE_CURRENCY = "usd";

export type StoreOrderItemSnapshot = {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
  imageUrl?: string | null;
};

export function formatStoreMoney(cents: number, currency = NOVA_STORE_CURRENCY): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function slugifyStoreName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
