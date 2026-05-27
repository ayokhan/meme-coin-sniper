import type { Session } from "next-auth";
import { canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { getConfig, type BlofinConfig } from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { prisma } from "@/lib/db";

export type TradingBotBlofinResolveResult =
  | { ok: true; config: BlofinConfig; credentialSource: "saved" | "server" }
  | { ok: false; status: number; error: string };

export type TradingBotBlofinMeta = {
  blofinDemo: boolean;
  credentialSource: "saved" | "server";
  /** When server env demo flag disagrees with bot mode — common after aligning UI to bot mode. */
  modeMismatchHint?: string;
};

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
  const saved = await getBlofinConfigForUser(userId);
  let config = saved;
  let credentialSource: "saved" | "server" = saved ? "saved" : "server";
  if (!config && isOwnerSession(session)) {
    config = getConfig();
    credentialSource = "server";
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
  return { ok: true, config, credentialSource };
}

/** Demo/live + credential source for Blofin panel APIs. */
export async function getTradingBotBlofinMeta(
  config: BlofinConfig,
  credentialSource: "saved" | "server"
): Promise<TradingBotBlofinMeta> {
  const blofinDemo = await getTradingBotBlofinDemoFlag(config.demo);
  const envDemo = process.env.BLOFIN_DEMO_MODE === "true";
  let modeMismatchHint: string | undefined;
  if (credentialSource === "server" && blofinDemo !== envDemo) {
    modeMismatchHint =
      `Panels query Blofin ${blofinDemo ? "Demo" : "Live"} (bot Config mode). Vercel BLOFIN_DEMO_MODE is ${envDemo ? "true" : "false"} — before a recent fix, lists may have shown the other environment. Set Config → Mode to match where you trade, or align BLOFIN_DEMO_MODE.`;
  }
  return { blofinDemo, credentialSource, modeMismatchHint };
}

/** Demo vs live for Blofin API — matches bot config mode (same as Run bot), not only key demo flag. */
export async function getTradingBotBlofinDemoFlag(fallbackFromKeys: boolean): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bot = await (prisma as any).tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    if (bot?.mode === "live") return false;
    if (bot?.mode === "demo") return true;
  } catch {
    /* use fallback */
  }
  return fallbackFromKeys;
}
