import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Server-side gate for Nova Ultimate Jupiter proxy routes (VIP + on-demand or owner). */
export async function assertNovaUltimateApiAccess(): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const { session, userId, tier } = await getSessionAndSubscription();
  if (!userId) return { ok: false, status: 401, error: "Sign in required." };
  if (session?.user?.email && isOwnerEmail(session.user.email)) return { ok: true, userId };
  if (tier !== "vip") return { ok: false, status: 403, error: "VIP subscription required for Nova Ultimate." };
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!(u as { novaUltimateOnDemand?: boolean } | null)?.novaUltimateOnDemand) {
    return { ok: false, status: 403, error: "Nova Ultimate is not enabled for your account. Ask an admin to turn it on." };
  }
  return { ok: true, userId };
}
