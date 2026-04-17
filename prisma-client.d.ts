declare module '@prisma/client' {
  export interface CoachCallRow {
    id: string;
    title: string | null;
    content: string;
    createdAt: Date;
  }

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
    $transaction: (args: unknown[]) => Promise<unknown[]>;
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
      delete: (args: { where: { id: string } }) => Promise<PrismaUser>;
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
    supportTicket: {
      findUnique: (args: { where: { supportNumber?: string; id?: string } }) => Promise<unknown>;
      findMany: (args?: { orderBy?: unknown }) => Promise<unknown[]>;
      create: (args: { data: unknown }) => Promise<unknown>;
      update: (args: { where: { id: string }; data: { status?: string } }) => Promise<unknown>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
    };
    agentPresence: {
      findUnique: (args: { where: { id: string } }) => Promise<{ id: string; lastSeenAt: Date } | null>;
      upsert: (args: { where: { id: string }; create: unknown; update: unknown }) => Promise<{ id: string; lastSeenAt: Date }>;
    };
    chatSession: {
      findUnique: (args: { where: { id: string }; include?: unknown }) => Promise<unknown>;
      findMany: (args?: { where?: unknown; orderBy?: unknown; include?: unknown }) => Promise<unknown[]>;
      create: (args: { data: unknown; include?: unknown }) => Promise<unknown>;
      update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
    };
    chatMessage: {
      findMany: (args?: { where?: unknown; orderBy?: unknown }) => Promise<unknown[]>;
      create: (args: { data: unknown }) => Promise<unknown>;
    };
    coachCall: {
      findMany: (args?: { orderBy?: unknown }) => Promise<CoachCallRow[]>;
      create: (args: { data: { title?: string; content: string } }) => Promise<{ id: string; title: string | null; content: string; createdAt: Date }>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
    };
    userTelegram: {
      findUnique: (args: { where: { userId: string } }) => Promise<{ telegramId: string } | null>;
      findMany: (args?: { include?: unknown; orderBy?: unknown }) => Promise<unknown[]>;
      upsert: (args: { where: { userId: string }; create: { userId: string; telegramId: string }; update: { telegramId: string } }) => Promise<unknown>;
    };
    analyticsEvent: {
      create: (args: { data: { path: string; country?: string | null; city?: string | null; deviceType?: string | null; browser?: string | null; os?: string | null; userId?: string | null } }) => Promise<unknown>;
      findMany: (args?: { where?: unknown; orderBy?: unknown; take?: number }) => Promise<unknown[]>;
    };
    aiAnalysisFeedback: {
      create: (args: { data: { contractAddress: string; outcome: string; note?: string | null; score?: number | null; signal?: string | null; userId?: string | null } }) => Promise<unknown>;
      findMany: (args?: { where?: unknown; orderBy?: unknown; take?: number }) => Promise<unknown[]>;
    };
    usageThisMonth: {
      findUnique: (args: { where: { userId_monthKey: { userId: string; monthKey: string } }; select?: { aiAnalyses: true } }) => Promise<{ aiAnalyses: number } | null>;
      findMany: (args?: { where?: { monthKey?: string }; select?: { userId: true; aiAnalyses: true; user: { select: { email: true; name: true } } } }) => Promise<Array<{ userId: string; aiAnalyses: number; user: { email: string | null; name: string | null } }>>;
      upsert: (args: {
        where: { userId_monthKey: { userId: string; monthKey: string } };
        create: { userId: string; monthKey: string; aiAnalyses: number };
        update: { aiAnalyses: { increment: number } };
      }) => Promise<unknown>;
    };
    userMemeCoinAlert: {
      count: (args: { where: { userId: string; createdAt: { gte: Date } } }) => Promise<number>;
      groupBy: (args: { by: ["userId"]; where?: { createdAt: { gte: Date } }; _count: { id: true } }) => Promise<Array<{ userId: string; _count: { id: number } }>>;
    };
    leverageAlert: {
      count: (args: { where: { userId: string; createdAt: { gte: Date } } }) => Promise<number>;
      groupBy: (args: { by: ["userId"]; where?: { createdAt: { gte: Date }; userId?: { not: null } }; _count: { id: true } }) => Promise<Array<{ userId: string | null; _count: { id: number } }>>;
    };
    polymarketTrackedWallet: {
      findMany: (args?: unknown) => Promise<
        Array<{
          id: string;
          address: string;
          nickname: string | null;
          active: boolean;
          global: boolean;
          createdAt: Date;
        }>
      >;
      findFirst: (args: unknown) => Promise<{ id: string; address: string; nickname: string | null; active: boolean; global: boolean } | null>;
      findUnique: (args: { where: { address: string } }) => Promise<{ id: string; address: string } | null>;
      create: (args: { data: { address: string; nickname?: string | null; active?: boolean; global?: boolean } }) => Promise<unknown>;
      updateMany: (args: { where: { address: string }; data: unknown }) => Promise<unknown>;
      deleteMany: (args: { where: { address: string } }) => Promise<unknown>;
    };
    userPolymarketTrackedWallet: {
      findMany: (args?: unknown) => Promise<Array<{ id: string; userId: string; address: string; nickname: string | null; createdAt: Date }>>;
      findUnique: (args: { where: { userId_address: { userId: string; address: string } } }) => Promise<{ id: string } | null>;
      upsert: (args: unknown) => Promise<unknown>;
      deleteMany: (args: { where: { userId: string; address: string } }) => Promise<unknown>;
    };
  }
}
