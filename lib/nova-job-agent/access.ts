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

  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { novaJobAgentOnDemand: true },
  })) as { novaJobAgentOnDemand?: boolean } | null;
  if (!user?.novaJobAgentOnDemand) {
    return {
      ok: false,
      status: 403,
      error: "Nova Jobs Agent access required. Ask an admin to enable it for your account.",
    };
  }

  return { ok: true, userId: session.user.id, isOwner: false };
}

/** @deprecated use requireJobAgentAccess */
export async function requireJobAgentOwner() {
  return requireJobAgentAccess();
}

export function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}
