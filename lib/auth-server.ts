import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { getActiveSubscription, getSubscriptionTier, type Tier } from '@/lib/subscription';
import { prisma } from '@/lib/db';

export async function getSessionAndSubscription() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  let isPaid = userId ? await getActiveSubscription(userId) : false;
  let tier: Tier | null = userId ? await getSubscriptionTier(userId) : null;
  let isCoachUser = false;

  // Refresh on-demand flags (and their expirations) from DB on every request.
  // This ensures admin enable/disable changes reflect immediately (no logout required).
  if (userId && session?.user) {
    // Avoid Prisma `select` typing issues by reading the full user record.
    const user = (await prisma.user.findUnique({ where: { id: userId } })) as
      | {
          ctScanOnDemand?: boolean;
          ctScanOnDemandExpiresAt?: Date | null;
          memeCoinsTraderOnDemand?: boolean;
          memeCoinsTraderOnDemandExpiresAt?: Date | null;
          coachUser?: boolean;
        }
      | null;

    session.user.ctScanOnDemand = !!user?.ctScanOnDemand;
    session.user.ctScanOnDemandExpiresAt = user?.ctScanOnDemandExpiresAt ?? null;
    session.user.memeCoinsTraderOnDemand = !!user?.memeCoinsTraderOnDemand;
    session.user.memeCoinsTraderOnDemandExpiresAt = user?.memeCoinsTraderOnDemandExpiresAt ?? null;
    isCoachUser = !!user?.coachUser;
    session.user.isCoachUser = isCoachUser;
  }

  if (session?.user?.email && isOwnerEmail(session.user.email)) {
    isPaid = true;
    tier = 'vip';
  }
  if (isCoachUser) {
    isPaid = true;
    tier = "vip";
  }
  return { session, userId, isPaid, tier };
}
