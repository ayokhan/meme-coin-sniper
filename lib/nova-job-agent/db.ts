import { prisma as basePrisma } from "@/lib/db";

/** Typed accessors for Nova Job Agent models (avoids stale PrismaClient type caches). */
export type JobAgentPrisma = typeof basePrisma & {
  jobAgentProfile: {
    findUnique: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    count: (args?: unknown) => Promise<number>;
  };
  jobAgentResume: {
    findFirst: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    updateMany: (args: unknown) => Promise<any>;
    count: (args?: unknown) => Promise<number>;
    groupBy: (args: unknown) => Promise<any[]>;
  };
  jobAgentApplication: {
    findMany: (args: unknown) => Promise<any[]>;
    findFirst: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    count: (args: unknown) => Promise<number>;
    groupBy: (args: unknown) => Promise<any[]>;
  };
};

export const jobAgentDb = basePrisma as unknown as JobAgentPrisma;
