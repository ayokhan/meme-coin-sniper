/**
 * Resolve a user's forex broker (MT4/MT5) connection for Nova Forex bots.
 * VIP/owner sessions only ever use their own saved keys — no server env fallback for forex.
 */
import {
  getForexBrokerConfigForUser,
  listForexBrokerConfigsForUser,
  FOREX_BROKER_IDS,
  type ForexBrokerId,
  type UserForexBrokerConnection,
} from "@/lib/forex-broker-user-config";

/**
 * Resolve the forex broker connection to use for a user session.
 * If `broker` is given, looks up that specific broker; otherwise returns the
 * first connected broker found (most users connect exactly one).
 * `isOwner` is accepted for parity with other session resolvers but does not
 * unlock any server-side fallback — forex credentials are always per-user.
 */
export async function resolveForexBrokerForSession(
  userId: string,
  isOwner: boolean,
  broker?: ForexBrokerId
): Promise<UserForexBrokerConnection | null> {
  void isOwner;
  if (!userId) return null;

  if (broker) {
    return getForexBrokerConfigForUser(userId, broker);
  }

  for (const id of FOREX_BROKER_IDS) {
    const config = await getForexBrokerConfigForUser(userId, id);
    if (config) return config;
  }
  return null;
}

/** All forex broker connections a user has saved (for "choose broker" UI). */
export async function listForexBrokersForSession(userId: string): Promise<UserForexBrokerConnection[]> {
  if (!userId) return [];
  return listForexBrokerConfigsForUser(userId);
}
