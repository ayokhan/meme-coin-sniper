import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getConfig } from "@/lib/blofin";
import { getBlofinConfigForUser, saveBlofinConfigForUser, deleteBlofinConfigForUser, updateBlofinDemoModeForUser } from "@/lib/blofin-user-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET: whether current user has Blofin keys configured (no keys returned). Owners may use server BLOFIN_* env. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const saved = await getBlofinConfigForUser(session.user.id);
    if (saved) {
      return NextResponse.json({
        success: true,
        configured: true,
        credentialSource: "saved",
        demoMode: saved.demo,
      });
    }
    const isOwner = isOwnerSession(session);
    const serverConfig = isOwner ? getConfig() : null;
    if (serverConfig) {
      return NextResponse.json({
        success: true,
        configured: true,
        credentialSource: "server",
        demoMode: serverConfig.demo,
      });
    }
    return NextResponse.json({ success: true, configured: false, credentialSource: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to check config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST: save Blofin API keys for current user. Body: { apiKey, secretKey, passphrase, demoMode?, brokerId? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const apiKey = String(body.apiKey ?? "").trim();
    const secretKey = String(body.secretKey ?? "").trim();
    const passphrase = String(body.passphrase ?? "").trim();
    if (!apiKey || !secretKey || !passphrase) {
      return NextResponse.json({ success: false, error: "apiKey, secretKey, and passphrase are required." }, { status: 400 });
    }
    await saveBlofinConfigForUser(session.user.id, {
      apiKey,
      secretKey,
      passphrase,
      demo: body.demoMode !== false,
      brokerId: body.brokerId != null ? String(body.brokerId).trim() || undefined : undefined,
    });
    return NextResponse.json({ success: true, configured: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE: remove saved Blofin keys for current user. */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    await deleteBlofinConfigForUser(session.user.id);
    return NextResponse.json({ success: true, configured: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH: update demo/live mode on saved keys. Body: { demoMode: boolean }. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (typeof body.demoMode !== "boolean") {
      return NextResponse.json({ success: false, error: "demoMode (boolean) is required." }, { status: 400 });
    }
    const updated = await updateBlofinDemoModeForUser(session.user.id, body.demoMode);
    if (!updated && !isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Save Blofin API keys first." }, { status: 400 });
    }
    return NextResponse.json({ success: true, demoMode: body.demoMode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update demo mode";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
