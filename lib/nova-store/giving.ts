/**
 * NovaStaris community giving — SickKids (Toronto).
 * Amounts are NovaStaris commitments funded from revenue (not an extra checkout fee).
 * Keep store UI product-first; giving copy stays quiet and secondary.
 */

export const SICKKIDS_NAME = "The Hospital for Sick Children (SickKids)";
export const SICKKIDS_SHORT = "SickKids";
export const SICKKIDS_FOUNDATION_URL = "https://www.sickkidsfoundation.com/";

/** USD donated by NovaStaris per merch unit purchased. */
export const STORE_DONATION_PER_ITEM_USD = 2;

/** USD donated by NovaStaris per VIP subscription purchase. */
export const VIP_DONATION_PER_SUBSCRIPTION_USD = 5;

/** Quiet store footer — one line, no banner. */
export const STORE_GIVING_FOOTER =
  `A quiet note: NovaStaris sets aside $${STORE_DONATION_PER_ITEM_USD} from each store item for ${SICKKIDS_SHORT} in Toronto.`;

export const STORE_GIVING_CART_NOTE =
  `Includes our $${STORE_DONATION_PER_ITEM_USD} SickKids set-aside (not added to your total).`;

export const STORE_GIVING_SUCCESS =
  `Thank you — your order is confirmed. We’ll ship from Canada shortly.`;

/** Secondary VIP note — keep shorter than the plan pitch. */
export const VIP_GIVING_HEADLINE = "A note from NovaStaris";

export const VIP_GIVING_BODY =
  `Part of every VIP subscription includes a $${VIP_DONATION_PER_SUBSCRIPTION_USD} contribution from NovaStaris to ${SICKKIDS_NAME} in Toronto.`;
