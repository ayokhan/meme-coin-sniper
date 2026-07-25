/**
 * NovaStaris community giving — SickKids (Toronto).
 * Amounts are NovaStaris commitments funded from revenue (not an extra checkout fee).
 */

export const SICKKIDS_NAME = "The Hospital for Sick Children (SickKids)";
export const SICKKIDS_SHORT = "SickKids";
export const SICKKIDS_FOUNDATION_URL = "https://www.sickkidsfoundation.com/";

/** USD donated by NovaStaris per merch unit purchased. */
export const STORE_DONATION_PER_ITEM_USD = 2;

/** USD donated by NovaStaris per VIP subscription purchase. */
export const VIP_DONATION_PER_SUBSCRIPTION_USD = 5;

export const STORE_GIVING_HEADLINE = "Giving back with every purchase";

export const STORE_GIVING_BODY =
  `For every item sold in Nova Store, NovaStaris donates $${STORE_DONATION_PER_ITEM_USD} to ${SICKKIDS_NAME} in Toronto — supporting care, research, and hope for kids and families. Your order helps that mission. Shipping remains free from Canada.`;

export const STORE_GIVING_CART_NOTE =
  `$${STORE_DONATION_PER_ITEM_USD} from every item goes to SickKids — funded by NovaStaris, not added to your total.`;

export const STORE_GIVING_SUCCESS =
  `Thank you. We’ll ship your order from Canada soon — and NovaStaris will donate $${STORE_DONATION_PER_ITEM_USD} per item to SickKids on your behalf.`;

export const VIP_GIVING_HEADLINE = "VIP that gives back";

export const VIP_GIVING_BODY =
  `When you subscribe to VIP, NovaStaris donates $${VIP_DONATION_PER_SUBSCRIPTION_USD} to ${SICKKIDS_NAME} in Toronto. You unlock the full platform — and help kids get the care they need.`;
