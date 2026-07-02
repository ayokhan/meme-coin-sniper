import type { Session } from "next-auth";
import { canAccessPropFirmBot, isOwnerSession } from "@/lib/auth";
import { getConfig, type BlofinConfig } from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";

export type PropFirmBlofinResolveResult =
  | { ok: true; config: BlofinConfig; credentialSource: "saved" | "server" }
  | { ok: false; status: number; error: string; configured: false };

export type PropFirmBlofinMeta = {
  blofinDemo: boolean;
  credentialSource: "saved" | "server";
};

/** Blofin credentials for Nova Prop Firm Bot — per-user keys; server env owner-only. */
export async function resolveBlofinConfigForPropFirmSession(
  session: Session | null
): Promise<PropFirmBlofinResolveResult> {
  if (!canAccessPropFirmBot(session)) {
    return { ok: false, status: 403, error: "Nova Prop Firm Bot access required.", configured: false };
  }
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required.", configured: false };
  }

  const saved = await getBlofinConfigForUser(session.user.id);
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
      configured: false,
      error: isOwnerSession(session)
        ? "Connect Blofin: save API keys below or set BLOFIN_* in server env."
        : "Connect Blofin: save your API keys below (Trading Bot → Blofin settings, or here).",
    };
  }
  return { ok: true, config, credentialSource };
}

export function getPropFirmBlofinMeta(
  config: BlofinConfig,
  credentialSource: "saved" | "server"
): PropFirmBlofinMeta {
  return { blofinDemo: config.demo, credentialSource };
}
