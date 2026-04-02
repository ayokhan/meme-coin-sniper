import type { Session } from "next-auth";
import { canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { getConfig, type BlofinConfig } from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";

export type TradingBotBlofinResolveResult =
  | { ok: true; config: BlofinConfig }
  | { ok: false; status: number; error: string };

/**
 * Resolve Blofin credentials for Trading Bot UI and Blofin-backed actions.
 * - Per-user encrypted keys when present.
 * - Server env keys only for owners (never for VIP / on-demand users).
 * Prevents VIP sessions from reading or trading on the owner's Blofin account.
 */
export async function resolveBlofinConfigForTradingBotSession(
  session: Session | null
): Promise<TradingBotBlofinResolveResult> {
  if (!canAccessTradingBot(session)) {
    return { ok: false, status: 403, error: "Not authorized." };
  }
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  let config = await getBlofinConfigForUser(userId);
  if (!config && isOwnerSession(session)) {
    config = getConfig();
  }
  if (!config) {
    return {
      ok: false,
      status: 400,
      error: isOwnerSession(session)
        ? "Blofin API keys not configured. Set BLOFIN_* in server env or save keys in Trading Bot settings."
        : "Add your Blofin API keys in Trading Bot settings. Your account only uses your keys—not the server’s.",
    };
  }
  return { ok: true, config };
}
