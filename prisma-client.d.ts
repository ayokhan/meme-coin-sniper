declare module '@prisma/client' {
  export interface PrismaUser {
    id: string;
    email: string | null;
    emailVerified: Date | null;
    name: string | null;
    image: string | null;
    hashedPassword: string | null;
    walletAddress: string | null;
    phone: string | null;
    country: string | null;
    experienceTradingCrypto: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  export class PrismaClient {
    constructor(options?: unknown);
    token: {
      findUnique: (args: { where: { contractAddress: string } }) => Promise<{ lastUpdatedAt: Date } | null>;
      findMany: (args?: { where?: unknown; orderBy?: unknown; take?: number }) => Promise<unknown[]>;
      upsert: (args: { where: { contractAddress: string }; create: unknown; update: unknown }) => Promise<unknown>;
    };
    scanLog: {
      create: (args: { data: { chain: string; tokensFound: number } }) => Promise<unknown>;
    };
    user: {
      findUnique: (args: { where: { email?: string; id?: string; walletAddress?: string } }) => Promise<PrismaUser | null>;
      findMany: (args?: { include?: { subscriptions?: boolean }; orderBy?: unknown }) => Promise<(PrismaUser & { subscriptions?: Array<{ id: string; plan: string; amountUsd: number; expiresAt: Date }> })[]>;
      create: (args: {
        data: { email?: string; hashedPassword?: string; name?: string; image?: string; walletAddress?: string; phone?: string; country?: string; experienceTradingCrypto?: string };
      }) => Promise<PrismaUser>;
      update: (args: { where: { id: string }; data: unknown }) => Promise<PrismaUser>;
    };
    account: {
      findMany: (args?: { where?: { userId: string } }) => Promise<unknown[]>;
      create: (args: { data: unknown }) => Promise<unknown>;
      upsert: (args: { where: unknown; create: unknown; update: unknown }) => Promise<unknown>;
    };
    subscription: {
      findMany: (args?: { where?: { userId?: string; expiresAt?: { gt: Date } }; orderBy?: unknown }) => Promise<unknown[]>;
      findFirst: (args?: {
        where?: { userId?: string; txSignature?: string; expiresAt?: { gt: Date } };
        orderBy?: { expiresAt?: 'asc' | 'desc' };
      }) => Promise<{ expiresAt: Date } | null>;
      create: (args: { data: unknown }) => Promise<unknown>;
    };
  }
}
