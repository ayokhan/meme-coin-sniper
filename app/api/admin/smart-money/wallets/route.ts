import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PrismaExt = typeof prisma & {
  smartMoneyWallet?: {
    findMany: (a?: object) => Promise<Array<{ id: string; address: string; label: string | null; active: boolean; source: string | null; createdAt: Date }>>;
    findUnique: (a: object) => Promise<{ id: string } | null>;
    create: (a: object) => Promise<unknown>;
    update: (a: object) => Promise<unknown>;
    delete: (a: object) => Promise<unknown>;
    count: (a?: object) => Promise<number>;
    upsert: (a: object) => Promise<unknown>;
  };
  smartMoneyConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<{ maxWallets: number } | null>;
  };
  memeTraderStats?: {
    findMany: (a: object) => Promise<Array<{ walletAddress: string; label: string | null; totalPnlUsd: number }>>;
  };
};

function requireOwner(email: string | null | undefined) {
  return isOwnerEmail(email ?? null);
}

/** Admin: list / add / toggle / delete Smart Money wallets + import top 20 from leaderboard. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session?.user?.email)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const db = (prisma as unknown as PrismaExt).smartMoneyWallet;
  if (!db) return NextResponse.json({ success: true, wallets: [] });
  const wallets = await db.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, wallets });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session?.user?.email)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const ext = prisma as unknown as PrismaExt;
  const db = ext.smartMoneyWallet;
  if (!db) return NextResponse.json({ success: false, error: "Run prisma db push first." }, { status: 500 });

  if (body.action === "import_top20") {
    const period = typeof body.period === "string" ? body.period : "7d";
    const statsDb = ext.memeTraderStats;
    if (!statsDb) {
      return NextResponse.json({ success: false, error: "Leaderboard stats unavailable." }, { status: 500 });
    }
    const cfg = await ext.smartMoneyConfig?.findUnique({ where: { id: "default" } });
    const maxWallets = cfg?.maxWallets ?? 20;
    const top = await statsDb.findMany({
      where: { periodKey: period },
      orderBy: { totalPnlUsd: "desc" },
      take: maxWallets,
    } as object);
    let added = 0;
    for (const row of top) {
      const address = (row.walletAddress || "").trim();
      if (!address) continue;
      await db.upsert({
        where: { address },
        create: {
          address,
          label: row.label || `LB #${added + 1}`,
          active: true,
          source: "leaderboard",
        },
        update: {
          active: true,
          source: "leaderboard",
          ...(row.label ? { label: row.label } : {}),
        },
      });
      added += 1;
    }
    return NextResponse.json({ success: true, imported: added });
  }

  if (body.action === "add") {
    const address = String(body.address ?? "").trim();
    const label = typeof body.label === "string" ? body.label.trim() || null : null;
    const source = typeof body.source === "string" ? body.source : "manual";
    if (!address || address.length < 32) {
      return NextResponse.json({ success: false, error: "Valid Solana wallet address required." }, { status: 400 });
    }
    const cfg = await ext.smartMoneyConfig?.findUnique({ where: { id: "default" } });
    const maxWallets = cfg?.maxWallets ?? 20;
    const count = await db.count({ where: { active: true } });
    const existing = await db.findUnique({ where: { address } });
    if (!existing && count >= maxWallets) {
      return NextResponse.json(
        { success: false, error: `Max ${maxWallets} active Smart Money wallets (CU cap). Deactivate one first.` },
        { status: 400 }
      );
    }
    await db.upsert({
      where: { address },
      create: { address, label, active: true, source },
      update: { label: label ?? undefined, active: true, source },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "toggle" && body.id) {
    const all = await db.findMany({ where: { id: body.id } } as object);
    const cur = all[0] as { active: boolean } | undefined;
    if (!cur) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    await db.update({
      where: { id: body.id },
      data: { active: !cur.active },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete" && body.id) {
    await db.delete({ where: { id: body.id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
