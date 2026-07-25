import { prisma as basePrisma } from "@/lib/db";

/** Typed accessors for Nova Store models (avoids stale PrismaClient type caches). */
export type StorePrisma = typeof basePrisma & {
  storeProduct: {
    findMany: (args?: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    delete: (args: unknown) => Promise<any>;
  };
  storeProductVariant: {
    findMany: (args?: unknown) => Promise<any[]>;
    create: (args: unknown) => Promise<any>;
    updateMany: (args: unknown) => Promise<any>;
    deleteMany: (args: unknown) => Promise<any>;
  };
  storeOrder: {
    findMany: (args?: unknown) => Promise<any[]>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    updateMany: (args: unknown) => Promise<any>;
  };
};

export const storeDb = basePrisma as unknown as StorePrisma;
