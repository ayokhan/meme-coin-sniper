/**
 * Suggested MT4/MT5 server names per forex broker (shown as picker hints; users can
 * still type their own — broker server lists change over time / by account type).
 * Exact spelling must match MetaAPI's known servers (or use a provisioning profile).
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

/**
 * TIOmarkets — include Live1 and common casing variants.
 * Copy the exact name from MT5 (Navigator → account) or your welcome email if MetaAPI still rejects it.
 */
export const TIOMARKETS_MT_SERVERS: string[] = [
  "TIOMarkets-Live1",
  "TIOMarkets-Live",
  "TIOMarkets-Live 2",
  "TIOMarkets-Live 3",
  "TIOMarkets-Demo",
  "TIOMarkets-MT5-Live",
  "TIOMarkets-MT5-Demo",
  "TIOmarkets-Live1",
  "TIOmarkets-Live",
  "TIOmarkets-Live 2",
  "TIOmarkets-Live 3",
  "TIOmarkets-Demo",
  "TIOmarkets-MT5-Live",
  "TIOmarkets-MT5-Demo",
  "TIOMarkets-Practice",
  "TIOmarkets-Practice",
];

/** Placeholders — users should paste the exact server from their Assexmarkets welcome email / MT terminal. */
export const ASSEXMARKETS_MT_SERVERS: string[] = [
  "AssexMarkets-Demo",
  "AssexMarkets-Live",
  "AssexMarkets-MT5-Demo",
  "AssexMarkets-MT5-Live",
  "Assexmarkets-Demo",
  "Assexmarkets-Live",
];

export function suggestedServersForBroker(broker: ForexBrokerId): string[] {
  if (broker === "vantage") return VANTAGE_MT_SERVERS;
  if (broker === "tiomarkets") return TIOMARKETS_MT_SERVERS;
  if (broker === "assexmarkets") return ASSEXMARKETS_MT_SERVERS;
  return [];
}

/** Default search query for MetaAPI known-server lookup. */
export function metaApiServerSearchQuery(broker: ForexBrokerId): string {
  if (broker === "vantage") return "vantage";
  if (broker === "tiomarkets") return "tio";
  if (broker === "assexmarkets") return "assex";
  return broker;
}
