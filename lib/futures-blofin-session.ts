import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { getConfig, type BlofinConfig } from "@/lib/blofin";
import { normalizeMetalBase } from "@/lib/blofin-metals";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import type { Tier } from "@/lib/subscription";

export type FuturesBlofinResolveResult =
  | { ok: true; config: BlofinConfig; credentialSource: "saved" | "server" }
  | { ok: false; status: number; error: string; configured: false };

/** Map Blofin instId (e.g. BTC-USDT-SWAP) to Liquidation Map symbol (BTC, XAU, …). */
export function instIdToMapSymbol(instId: string): string {
  const upper = String(instId ?? "").trim().toUpperCase();
  const base = upper.split("-")[0] ?? upper;
  return normalizeMetalBase(base) || base;
}

/**
 * Blofin credentials for VIP futures tools (Liquidation Map positions, etc.).
 * - Per-user encrypted keys when present.
 * - Server env keys only for owners (never for other VIP users).
 */
export async function resolveBlofinConfigForFuturesSession(
  session: Session | null,
  tier: Tier | null
): Promise<FuturesBlofinResolveResult> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required.", configured: false };
  }
  const isOwner = isOwnerSession(session);
  if (!(isOwner || tier === "vip")) {
    return { ok: false, status: 403, error: "VIP required.", configured: false };
  }

  const saved = await getBlofinConfigForUser(session.user.id);
  let config = saved;
  let credentialSource: "saved" | "server" = saved ? "saved" : "server";
  if (!config && isOwner) {
    config = getConfig();
    credentialSource = "server";
  }
  if (!config) {
    return {
      ok: false,
      status: 400,
      configured: false,
      error: isOwner
        ? "Blofin API keys not configured. Save keys in Trading Bot settings or set BLOFIN_* in server env."
        : "Save your Blofin API keys in Trading Bot settings to import open positions.",
    };
  }
  return { ok: true, config, credentialSource };
}
