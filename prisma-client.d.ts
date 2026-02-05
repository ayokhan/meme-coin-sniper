declare module '@prisma/client' {
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
      findUnique: (args: { where: { email?: string; id?: string; walletAddress?: string } }) => Promise<{ id: string; email: string | null; hashedPassword: string | null; name: string | null } | null>;
      create: (args: { data: { email: string; hashedPassword: string; name?: string } }) => Promise<unknown>;
      update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
    };
    account: {
      findMany: (args?: { where?: { userId: string } }) => Promise<unknown[]>;
      create: (args: { data: unknown }) => Promise<unknown>;
      upsert: (args: { where: unknown; create: unknown; update: unknown }) => Promise<unknown>;
    };
    subscription: {
      findMany: (args?: { where?: { userId: string }; orderBy?: unknown }) => Promise<unknown[]>;
      findFirst: (args?: { where: { userId?: string; txSignature?: string }; orderBy?: unknown }) => Promise<unknown>;
      create: (args: { data: unknown }) => Promise<unknown>;
    };
  }
}
