import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { syncRealtorInbox, verifyRealtorMailbox } from "@/lib/realtor-os/desk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { action: "test" | "sync", limit?: number, autoDraft?: boolean } */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const action = body.action === "test" ? "test" : "sync";

    if (action === "test") {
      const result = await verifyRealtorMailbox();
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, ok: true });
    }

    const result = await syncRealtorInbox({
      limit: typeof body.limit === "number" ? body.limit : 15,
      autoDraft: body.autoDraft !== false,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("realtor-os sync:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Sync failed." },
      { status: 500 }
    );
  }
}
