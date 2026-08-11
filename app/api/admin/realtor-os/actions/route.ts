import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  createDraftForMessage,
  saveDraftBody,
  sendDraft,
  skipMessage,
  updateLeadStatus,
} from "@/lib/realtor-os/desk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PATCH body:
 * { action: "draft" | "save_draft" | "send" | "skip" | "lead_status", messageId?, leadId?, draftBody?, status? }
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "draft") {
      if (!body.messageId) return NextResponse.json({ success: false, error: "messageId required." }, { status: 400 });
      const draft = await createDraftForMessage(String(body.messageId));
      return NextResponse.json({ success: true, draft });
    }
    if (action === "save_draft") {
      if (!body.messageId) return NextResponse.json({ success: false, error: "messageId required." }, { status: 400 });
      await saveDraftBody(String(body.messageId), String(body.draftBody ?? ""));
      return NextResponse.json({ success: true });
    }
    if (action === "send") {
      if (!body.messageId) return NextResponse.json({ success: false, error: "messageId required." }, { status: 400 });
      await sendDraft(String(body.messageId), typeof body.draftBody === "string" ? body.draftBody : undefined);
      return NextResponse.json({ success: true });
    }
    if (action === "skip") {
      if (!body.messageId) return NextResponse.json({ success: false, error: "messageId required." }, { status: 400 });
      await skipMessage(String(body.messageId));
      return NextResponse.json({ success: true });
    }
    if (action === "lead_status") {
      if (!body.leadId || !body.status) {
        return NextResponse.json({ success: false, error: "leadId and status required." }, { status: 400 });
      }
      await updateLeadStatus(String(body.leadId), String(body.status));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("realtor-os actions:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Action failed." },
      { status: 500 }
    );
  }
}
