import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Cast so build passes when deploy cache has Prisma client without NovaSmartFeedback in types
const novaSmartFeedback = (prisma as unknown as { novaSmartFeedback: { findMany: (a: object) => Promise<unknown[]>; create: (a: object) => Promise<unknown> } }).novaSmartFeedback;

/** GET - List NovaSmart feedback (owner-only). Query: worked=true|false, limit=number. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }
    const url = new URL(req.url);
    const workedParam = url.searchParams.get("worked");
    const worked = workedParam === "true" ? true : workedParam === "false" ? false : undefined;
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
    const where = worked === true || worked === false ? { worked } : {};
    const list = await novaSmartFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ success: true, feedback: list });
  } catch (e) {
    console.error("NovaSmart feedback list error:", e);
    return NextResponse.json({ success: false, error: "Failed to load feedback." }, { status: 500 });
  }
}

/** POST - Submit feedback on a NovaSmart result (owner-only). Body: { symbol, strategy, worked: boolean, note?: string }. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase().slice(0, 20) : "";
    const strategy = typeof body.strategy === "string" ? body.strategy.trim().toLowerCase().slice(0, 20) : "";
    const worked = body.worked === true || body.worked === false ? body.worked : null;

    if (!symbol || !strategy || worked === null) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid symbol, strategy, and worked (true/false)." },
        { status: 400 }
      );
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    const userId = (session?.user as { id?: string })?.id ?? null;

    await novaSmartFeedback.create({
      data: { symbol, strategy, worked, note, userId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("NovaSmart feedback error:", e);
    return NextResponse.json({ success: false, error: "Failed to save feedback." }, { status: 500 });
  }
}
