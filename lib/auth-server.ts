import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveSubscription } from '@/lib/subscription';

export async function getSessionAndSubscription() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const isPaid = userId ? await getActiveSubscription(userId) : false;
  return { session, userId, isPaid };
}
