import crypto from "crypto";

const TOKEN_TTL_MS = 5 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createCapacitorAuthToken(userId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${exp}`;
  const sig = signPayload(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyCapacitorAuthToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const sig = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const expColon = payload.lastIndexOf(":");
    if (expColon <= 0) return null;
    const userId = payload.slice(0, expColon);
    const expStr = payload.slice(expColon + 1);
    const exp = parseInt(expStr, 10);
    if (!userId || !Number.isFinite(exp)) return null;
    if (Date.now() > exp) return null;
    if (sig !== signPayload(payload)) return null;
    return userId;
  } catch {
    return null;
  }
}
