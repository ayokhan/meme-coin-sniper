import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";

export async function requireJobAgentAccess(): Promise<
  { ok: true; userId: string; isOwner: boolean } | { ok: false; status: number; error: string }
> {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_JOB_AGENT);
  if (!enabled) {
    return { ok: false, status: 403, error: "Nova Jobs Agent is disabled." };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const isOwner = isOwnerEmail(session.user.email ?? null);
  if (isOwner) return { ok: true, userId: session.user.id, isOwner: true };

  const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_JOB_AGENT_OWNER_ONLY);

  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { novaJobAgentOnDemand: true },
  })) as { novaJobAgentOnDemand?: boolean } | null;

  // Admin-granted early access always works (even while Owner-only testing).
  if (user?.novaJobAgentOnDemand) {
    return { ok: true, userId: session.user.id, isOwner: false };
  }

  if (ownerOnly) {
    return {
      ok: false,
      status: 403,
      error: "Nova Jobs Agent is in owner testing mode. Ask an admin to enable it for your account.",
    };
  }

  // All VIP mode
  const tier = (session.user as { tier?: string }).tier;
  if (tier === "vip") {
    return { ok: true, userId: session.user.id, isOwner: false };
  }

  return {
    ok: false,
    status: 403,
    error: "Nova Jobs Agent is available to VIP members. Upgrade or ask an admin for access.",
  };
}

/** @deprecated use requireJobAgentAccess */
export async function requireJobAgentOwner() {
  return requireJobAgentAccess();
}

export function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}
