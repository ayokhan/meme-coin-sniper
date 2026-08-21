import { prisma as basePrisma } from "@/lib/db";

type FuturesDailyWrapRow = {
  id: string;
  dateKey: string;
  title: string;
  publishedAt: Date;
  hotTopics: unknown;
  marketUpdates: unknown;
  emailTeaser: unknown;
  telegramHtml: string | null;
  createdAt?: Date;
};

/** Typed accessors (avoids stale PrismaClient stubs in prisma-client.d.ts). */
export type FuturesWrapPrisma = typeof basePrisma & {
  knownPerpSymbol: {
    findMany: (args?: unknown) => Promise<{ symbol: string }[]>;
  };
  futuresDailyWrap: {
    findUnique: (args: unknown) => Promise<FuturesDailyWrapRow | null>;
    findFirst: (args?: unknown) => Promise<FuturesDailyWrapRow | null>;
    findMany: (args?: unknown) => Promise<
      | FuturesDailyWrapRow[]
      | { dateKey: string; title: string; publishedAt: Date }[]
    >;
    upsert: (args: unknown) => Promise<FuturesDailyWrapRow>;
  };
};

export const futuresWrapDb = basePrisma as unknown as FuturesWrapPrisma;
