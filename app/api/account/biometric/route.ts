import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createBiometricCredential,
  listActiveBiometricCredentials,
  revokeAllBiometricCredentials,
  revokeBiometricCredential,
} from "@/lib/biometric-credential";

async function sessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const devices = await listActiveBiometricCredentials(userId);
  return NextResponse.json({ success: true, devices });
}

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  let body: { deviceLabel?: string; replaceCredentialId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  try {
    if (body.replaceCredentialId) {
      await revokeBiometricCredential(userId, body.replaceCredentialId);
    }
    const { credentialId, deviceToken } = await createBiometricCredential(
      userId,
      typeof body.deviceLabel === "string" ? body.deviceLabel : null
    );
    return NextResponse.json({ success: true, credentialId, deviceToken });
  } catch (e) {
    console.error("account biometric POST:", e);
    return NextResponse.json({ success: false, error: "Could not enable biometric sign-in." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  let body: { credentialId?: string; all?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }

  if (body.all) {
    const revoked = await revokeAllBiometricCredentials(userId);
    return NextResponse.json({ success: true, revoked });
  }
  if (!body.credentialId) {
    return NextResponse.json({ success: false, error: "credentialId required." }, { status: 400 });
  }
  await revokeBiometricCredential(userId, body.credentialId);
  return NextResponse.json({ success: true });
}
