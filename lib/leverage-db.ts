import { prisma } from "@/lib/db";

/** Typed access for LeverageWallet and LeverageWalletSnapshot (avoids PrismaClient type resolution issues in some builds). */
export const leverageDb = prisma as unknown as {
  leverageWallet: {
    findMany: (args?: { where?: { active?: boolean; alertEnabled?: boolean }; orderBy?: { createdAt: string } }) => Promise<Array<{ id: string; address: string; nickname: string | null; active: boolean; alertEnabled: boolean; createdAt: Date }>>;
    findUnique: (args: { where: { address: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: { address: string; nickname?: string | null; active?: boolean; alertEnabled?: boolean } }) => Promise<unknown>;
    updateMany: (args: { where: { address: string }; data: { nickname?: string | null; active?: boolean; alertEnabled?: boolean } }) => Promise<unknown>;
    deleteMany: (args: { where: { address: string } }) => Promise<{ count: number }>;
    count: (args?: { where?: { active?: boolean } }) => Promise<number>;
    upsert: (args: { where: { address: string }; create: { address: string; active?: boolean; alertEnabled?: boolean }; update: object }) => Promise<unknown>;
  };
  leverageWalletSnapshot: {
    findUnique: (args: { where: { walletAddress: string } }) => Promise<{ positionsJson: string } | null>;
    upsert: (args: { where: { walletAddress: string }; create: { walletAddress: string; positionsJson: string }; update: { positionsJson: string } }) => Promise<unknown>;
  };
};
