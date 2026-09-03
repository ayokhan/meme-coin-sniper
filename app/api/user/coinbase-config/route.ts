import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getConfig, validateCoinbasePrivateKey } from "@/lib/coinbase";
import {
  getCoinbaseConfigForUser,
  saveCoinbaseConfigForUser,
  deleteCoinbaseConfigForUser,
  updateCoinbaseDemoModeForUser,
} from "@/lib/coinbase-user-config";
import { isCoinbaseTradingEnabled } from "@/lib/trading-bot-coinbase-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET: whether current user has Coinbase keys configured (no secrets returned). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const enabled = await isCoinbaseTradingEnabled(session);
    if (!enabled) {
      return NextResponse.json({ success: true, configured: false, featureDisabled: true });
    }
    const saved = await getCoinbaseConfigForUser(session.user.id);
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

/** POST: save Coinbase API keys. Body: { apiKeyName, apiSecret, demoMode? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const enabled = await isCoinbaseTradingEnabled(session);
    if (!enabled) {
      return NextResponse.json({ success: false, error: "Coinbase trading is disabled." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const apiKeyName = String(body.apiKeyName ?? "").trim();
    const apiSecretRaw = String(body.apiSecret ?? "").trim();
    if (!apiKeyName || !apiSecretRaw) {
      return NextResponse.json({ success: false, error: "apiKeyName and apiSecret are required." }, { status: 400 });
    }
    const keyCheck = validateCoinbasePrivateKey(apiSecretRaw);
    if (!keyCheck.ok) {
      return NextResponse.json({ success: false, error: keyCheck.error }, { status: 400 });
    }
    await saveCoinbaseConfigForUser(session.user.id, {
      apiKeyName,
      apiSecret: keyCheck.pem,
      demo: body.demoMode === true,
    });
    return NextResponse.json({ success: true, configured: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE: remove saved Coinbase keys. */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    await deleteCoinbaseConfigForUser(session.user.id);
    return NextResponse.json({ success: true, configured: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH: update demo/live mode. Body: { demoMode: boolean }. */
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
    const updated = await updateCoinbaseDemoModeForUser(session.user.id, body.demoMode);
    if (!updated && !isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Save Coinbase API keys first." }, { status: 400 });
    }
    return NextResponse.json({ success: true, demoMode: body.demoMode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update demo mode";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
