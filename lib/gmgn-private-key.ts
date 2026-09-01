import crypto from "node:crypto";

export type GmgnPrivateKeyValidation =
  | { ok: true; pem: string; algorithm: "Ed25519" | "RSA-SHA256" }
  | { ok: false; error: string };

/** Normalize pasted PEM (newlines, whitespace). */
export function normalizeGmgnPrivateKeyPem(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  let pem = raw.trim().replace(/\\n/g, "\n");
  if (!pem.includes("\n") && pem.includes("-----BEGIN")) {
    pem = pem
      .replace(/-----BEGIN/g, "\n-----BEGIN")
      .replace(/-----END/g, "\n-----END")
      .replace(/\n+/g, "\n")
      .trim();
  }
  return pem;
}

function friendlyCryptoError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("DECODER") || msg.includes("unsupported")) {
    return "Could not read this key. Use the PRIVATE PEM (-----BEGIN PRIVATE KEY-----), not the public key.";
  }
  return msg;
}

export function validateGmgnPrivateKey(raw: string): GmgnPrivateKeyValidation {
  const pem = normalizeGmgnPrivateKeyPem(raw);
  if (!pem) return { ok: false, error: "Private key is required for live trades." };
  if (/BEGIN\s+PUBLIC\s+KEY/i.test(pem)) {
    return {
      ok: false,
      error:
        "That is a PUBLIC key. Paste the matching PRIVATE key file from when you generated the key pair (-----BEGIN PRIVATE KEY-----).",
    };
  }
  if (!/BEGIN\s+.*PRIVATE\s+KEY/i.test(pem)) {
    return {
      ok: false,
      error: "Private key must be PEM text including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----.",
    };
  }
  try {
    const key = crypto.createPrivateKey(pem);
    if (key.asymmetricKeyType === "ed25519") {
      crypto.sign(null, Buffer.from("gmgn-test"), pem);
      return { ok: true, pem, algorithm: "Ed25519" };
    }
    if (key.asymmetricKeyType === "rsa") {
      crypto.sign("sha256", Buffer.from("gmgn-test"), {
        key: pem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      });
      return { ok: true, pem, algorithm: "RSA-SHA256" };
    }
    return { ok: false, error: `Unsupported key type: ${key.asymmetricKeyType ?? "unknown"}. Use Ed25519 or RSA.` };
  } catch (e) {
    return { ok: false, error: friendlyCryptoError(e) };
  }
}

export function detectGmgnSignAlgorithm(pem: string): "Ed25519" | "RSA-SHA256" {
  const check = validateGmgnPrivateKey(pem);
  if (!check.ok) throw new Error(check.error);
  return check.algorithm;
}

export function signGmgnMessage(message: string, privateKeyPem: string, algorithm: "Ed25519" | "RSA-SHA256"): string {
  const msgBuf = Buffer.from(message, "utf-8");
  if (algorithm === "Ed25519") {
    return crypto.sign(null, msgBuf, privateKeyPem).toString("base64");
  }
  return crypto
    .sign("sha256", msgBuf, {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    })
    .toString("base64");
}
