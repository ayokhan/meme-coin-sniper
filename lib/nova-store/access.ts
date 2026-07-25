import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export async function isNovaStoreEnabled(): Promise<boolean> {
  return getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_STORE);
}
