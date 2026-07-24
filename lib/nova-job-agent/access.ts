import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export async function requireJobAgentOwner(): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_JOB_AGENT);
  if (!enabled) {
    return { ok: false, status: 403, error: "Nova Job Agent is disabled." };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  if (!isOwnerEmail(session.user.email ?? null)) {
    return { ok: false, status: 403, error: "Owner access only." };
  }
  return { ok: true, userId: session.user.id };
}

export function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}
