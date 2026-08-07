import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getStrategyCallConfig, setStrategyCallConfig } from "@/lib/strategy-call";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const config = await getStrategyCallConfig();
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("admin strategy-call GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load strategy call config." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { enabled?: boolean; bookingUrl?: string };
    const config = await setStrategyCallConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      bookingUrl: typeof body.bookingUrl === "string" ? body.bookingUrl : undefined,
    });
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("admin strategy-call PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 400 }
    );
  }
}
