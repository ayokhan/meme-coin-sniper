import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  clearSystemErrorLogsOlderThan,
  listSystemErrorLogs,
} from "@/lib/system-error-log";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !isOwnerEmail(email)) return null;
  return session;
}

/** GET — list system / ops errors (owner). ?q=source filter & limit= */
export async function GET(request: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim() || undefined;
  const limit = Number(url.searchParams.get("limit") || 100);

  const rows = await listSystemErrorLogs(limit, q);
  return NextResponse.json({
    success: true,
    errors: rows.map((e) => ({
      id: e.id,
      source: e.source,
      message: e.message,
      detail: e.detail,
      meta: e.meta,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

/** DELETE — clear errors older than N days (default 30). */
export async function DELETE(request: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const deleted = await clearSystemErrorLogsOlderThan(days);
  return NextResponse.json({ success: true, deleted, days });
}
