/**
 * Owner-managed Discovery call completion log (manual data entry).
 */

import { prisma } from "@/lib/db";

export type DiscoveryCallCompletionRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  userId: string | null;
  completedAt: string;
  notes: string;
  createdAt: string;
};

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  userId: string | null;
  completedAt: Date;
  notes: string;
  createdAt: Date;
};

type Db = {
  findMany: (args: {
    orderBy: { completedAt: "desc" };
    take?: number;
  }) => Promise<Row[]>;
  create: (args: {
    data: {
      name: string;
      email?: string | null;
      phone?: string | null;
      userId?: string | null;
      completedAt?: Date;
      notes?: string;
    };
  }) => Promise<Row>;
  update: (args: {
    where: { id: string };
    data: Partial<{
      name: string;
      email: string | null;
      phone: string | null;
      userId: string | null;
      completedAt: Date;
      notes: string;
    }>;
  }) => Promise<Row>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function store(): Db | null {
  return (prisma as unknown as { discoveryCallCompletion?: Db }).discoveryCallCompletion ?? null;
}

function toRow(r: Row): DiscoveryCallCompletionRow {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    userId: r.userId,
    completedAt: r.completedAt.toISOString(),
    notes: r.notes ?? "",
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listDiscoveryCallCompletions(take = 200): Promise<DiscoveryCallCompletionRow[]> {
  const db = store();
  if (!db) return [];
  try {
    const rows = await db.findMany({ orderBy: { completedAt: "desc" }, take });
    return rows.map(toRow);
  } catch {
    return [];
  }
}

export async function createDiscoveryCallCompletion(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}): Promise<DiscoveryCallCompletionRow> {
  const db = store();
  if (!db) throw new Error("Discovery call log unavailable.");
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
  if (Number.isNaN(completedAt.getTime())) throw new Error("Invalid completed date.");
  const row = await db.create({
    data: {
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      userId: input.userId?.trim() || null,
      completedAt,
      notes: (input.notes ?? "").trim(),
    },
  });
  return toRow(row);
}

export async function updateDiscoveryCallCompletion(
  id: string,
  patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    userId?: string | null;
    completedAt?: string | null;
    notes?: string | null;
  }
): Promise<DiscoveryCallCompletionRow> {
  const db = store();
  if (!db) throw new Error("Discovery call log unavailable.");
  const data: Parameters<Db["update"]>[0]["data"] = {};
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required.");
    data.name = name;
  }
  if (patch.email !== undefined) data.email = patch.email?.trim() || null;
  if (patch.phone !== undefined) data.phone = patch.phone?.trim() || null;
  if (patch.userId !== undefined) data.userId = patch.userId?.trim() || null;
  if (patch.notes !== undefined) data.notes = (patch.notes ?? "").trim();
  if (patch.completedAt) {
    const d = new Date(patch.completedAt);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid completed date.");
    data.completedAt = d;
  }
  const row = await db.update({ where: { id }, data });
  return toRow(row);
}

export async function deleteDiscoveryCallCompletion(id: string): Promise<void> {
  const db = store();
  if (!db) throw new Error("Discovery call log unavailable.");
  await db.delete({ where: { id } });
}
