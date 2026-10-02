import { NextResponse } from "next/server";
import { studioDb } from "@/lib/email-studio-db";
import { verifyClick } from "@/lib/email-links";

export const dynamic = "force-dynamic";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

/** Email Studio click redirect. The target URL is HMAC-signed, so this can't be used as an open redirect. */
export async function GET(request: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const url = new URL(request.url);
  const target = url.searchParams.get("u") ?? "";
  const sig = url.searchParams.get("s") ?? "";
  if (!/^https?:\/\//i.test(target) || !(await verifyClick(rid, target, sig))) {
    return NextResponse.redirect(APP_ORIGIN, 302);
  }
  const now = new Date();
  const recipients = studioDb().emailStudioRecipient;
  await recipients
    .update({ where: { id: rid }, data: { clicks: { increment: 1 } } })
    .then(() =>
      Promise.all([
        recipients.updateMany({ where: { id: rid, clickedAt: null }, data: { clickedAt: now } }),
        recipients.updateMany({ where: { id: rid, openedAt: null }, data: { openedAt: now } }),
      ])
    )
    .catch(() => null);
  return NextResponse.redirect(target, 302);
}
