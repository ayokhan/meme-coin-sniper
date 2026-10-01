import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { getSubscriptionTier } from "@/lib/subscription";

export type StrongRunnerAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; locked?: boolean };

/** VIP (or coach / owner) only. */
export async function getStrongRunnerAccess(session: Session | null): Promise<StrongRunnerAccess> {
  if (!session?.user?.id) return { ok: false, status: 401, error: "Sign in required." };
  if (isOwnerSession(session)) return { ok: true, userId: session.user.id, isOwner: true };

  const tier = await getSubscriptionTier(session.user.id);
  const isCoach = (session.user as { isCoachUser?: boolean })?.isCoachUser === true;
  if (tier !== "vip" && !isCoach) {
    return { ok: false, status: 403, error: "Strong Runners is a VIP feature.", locked: true };
  }
  return { ok: true, userId: session.user.id, isOwner: false };
}
