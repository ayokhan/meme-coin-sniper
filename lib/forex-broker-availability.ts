/**
 * Which forex brokers users can connect / pick for Nova Forex bots.
 * Controlled by Admin → Feature flags (forex_broker_*).
 */
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import {
  FOREX_BROKER_IDS,
  type ForexBrokerId,
} from "@/lib/forex-broker-user-config";

export const FOREX_BROKER_FEATURE_FLAG: Record<ForexBrokerId, string> = {
  vantage: FEATURE_FLAG_KEYS.FOREX_BROKER_VANTAGE,
  tiomarkets: FEATURE_FLAG_KEYS.FOREX_BROKER_TIOMARKETS,
  assexmarkets: FEATURE_FLAG_KEYS.FOREX_BROKER_ASSEXMARKETS,
};

/** Brokers currently enabled for connect UI + bot broker pickers. */
export async function getEnabledForexBrokerIds(): Promise<ForexBrokerId[]> {
  const out: ForexBrokerId[] = [];
  for (const id of FOREX_BROKER_IDS) {
    const on = await getFeatureFlag(FOREX_BROKER_FEATURE_FLAG[id]);
    if (on) out.push(id);
  }
  return out;
}

export async function isForexBrokerEnabled(broker: ForexBrokerId): Promise<boolean> {
  return getFeatureFlag(FOREX_BROKER_FEATURE_FLAG[broker]);
}
