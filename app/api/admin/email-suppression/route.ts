import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  addEmailSuppressions,
  listEmailSuppressions,
  removeEmailSuppression,
} from "@/lib/email-suppression";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const suppressions = await listEmailSuppressions();
    return NextResponse.json({ success: true, suppressions });
  } catch (e) {
    console.error("admin email-suppression GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load do-not-send list." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { emails?: string[]; note?: string };
    const emails = Array.isArray(body.emails) ? body.emails : [];
    if (emails.length === 0) {
      return NextResponse.json({ success: false, error: "Provide at least one email." }, { status: 400 });
    }
    const result = await addEmailSuppressions(emails, {
      reason: "manual",
      note: typeof body.note === "string" ? body.note : undefined,
      createdByUserId: session?.user?.id ?? null,
    });
    const suppressions = await listEmailSuppressions();
    return NextResponse.json({ success: true, ...result, suppressions });
  } catch (e) {
    console.error("admin email-suppression POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to add emails." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }
    const removed = await removeEmailSuppression(email);
    const suppressions = await listEmailSuppressions();
    return NextResponse.json({ success: true, removed, suppressions });
  } catch (e) {
    console.error("admin email-suppression DELETE:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to remove email." },
      { status: 400 }
    );
  }
}
