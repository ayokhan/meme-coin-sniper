import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deletePolymarketConfigForUser,
  getPolymarketConfigForUser,
  savePolymarketConfigForUser,
} from "@/lib/polymarket-user-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const config = await getPolymarketConfigForUser(session.user.id);
    return NextResponse.json({ success: true, configured: !!config, address: config?.address ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to check Polymarket config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim();
    const apiKey = String(body.apiKey ?? "").trim();
    const passphrase = String(body.passphrase ?? "").trim();
    const secret = String(body.secret ?? "").trim();
    if (!address || !apiKey || !passphrase || !secret) {
      return NextResponse.json({ success: false, error: "address, apiKey, passphrase, and secret are required." }, { status: 400 });
    }
    await savePolymarketConfigForUser(session.user.id, { address, apiKey, passphrase, secret });
    return NextResponse.json({ success: true, configured: true, address });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save Polymarket config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await deletePolymarketConfigForUser(session.user.id);
    return NextResponse.json({ success: true, configured: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear Polymarket config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

