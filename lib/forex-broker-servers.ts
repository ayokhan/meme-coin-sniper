/**
 * Suggested MT4/MT5 server names per forex broker (shown as picker hints; users can
 * still type their own — broker server lists change over time / by account type).
 */
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";

export const VANTAGE_MT_SERVERS: string[] = [
  "VantageInternational-Demo",
  "VantageInternational-Live",
  "VantageInternational-Live 2",
  "VantageInternational-Live 3",
  "VantageInternational-Live 4",
  "VantageInternational-Live 5",
];

export const TIOMARKETS_MT_SERVERS: string[] = [
  "TIOmarkets-Demo",
  "TIOmarkets-Live",
  "TIOmarkets-Live 2",
  "TIOmarkets-Live 3",
  "TIOmarkets-MT5-Demo",
  "TIOmarkets-MT5-Live",
];

/** Placeholders — users should paste the exact server from their Assexmarkets welcome email / MT terminal. */
export const ASSEXMARKETS_MT_SERVERS: string[] = [
  "AssexMarkets-Demo",
  "AssexMarkets-Live",
  "AssexMarkets-MT5-Demo",
  "AssexMarkets-MT5-Live",
];

export function suggestedServersForBroker(broker: ForexBrokerId): string[] {
  if (broker === "vantage") return VANTAGE_MT_SERVERS;
  if (broker === "tiomarkets") return TIOMARKETS_MT_SERVERS;
  if (broker === "assexmarkets") return ASSEXMARKETS_MT_SERVERS;
  return [];
}
