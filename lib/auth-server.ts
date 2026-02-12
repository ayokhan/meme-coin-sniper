import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { getActiveSubscription, getSubscriptionTier, type Tier } from '@/lib/subscription';

export async function getSessionAndSubscription() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  let isPaid = userId ? await getActiveSubscription(userId) : false;
  let tier: Tier | null = userId ? await getSubscriptionTier(userId) : null;
  if (session?.user?.email && isOwnerEmail(session.user.email)) {
    isPaid = true;
    tier = 'vip';
  }
  return { session, userId, isPaid, tier };
}
