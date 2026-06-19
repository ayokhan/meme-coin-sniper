/**
 * Permanently delete a user and associated app data (Google Play / self-service account deletion).
 * Caller must enforce auth, feature flag, and owner lockout before invoking.
 */
import { prisma } from "@/lib/db";

type Db = {
  novaConnectMessage: { updateMany: (args: unknown) => Promise<unknown> };
  userMemeCoinAlert: { deleteMany: (args: unknown) => Promise<unknown> };
  novaScalperConfig: { deleteMany: (args: unknown) => Promise<unknown> };
  aiAnalysisEmbedding: { deleteMany: (args: unknown) => Promise<unknown> };
  analyticsEvent: { deleteMany: (args: unknown) => Promise<unknown> };
  leverageAlert: { deleteMany: (args: unknown) => Promise<unknown> };
  user: { delete: (args: unknown) => Promise<unknown> };
};

export async function deleteUserAccount(userId: string): Promise<void> {
  const db = prisma as unknown as Db;

  // DMs addressed to this user — keep message history for sender, drop recipient link.
  await db.novaConnectMessage.updateMany({
    where: { toUserId: userId },
    data: { toUserId: null },
  });

  await db.userMemeCoinAlert.deleteMany({ where: { userId } });
  await db.novaScalperConfig.deleteMany({ where: { userId } });
  await db.aiAnalysisEmbedding.deleteMany({ where: { userId } });
  await db.analyticsEvent.deleteMany({ where: { userId } });
  await db.leverageAlert.deleteMany({ where: { userId } });

  // Cascades: subscriptions, pins, wallets, OAuth accounts, NovaConnect, configs, etc.
  await db.user.delete({ where: { id: userId } });
}
