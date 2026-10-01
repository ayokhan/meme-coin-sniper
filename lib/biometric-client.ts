"use client";

import { isCapacitorNative } from "@/lib/capacitor-native";

const KEYSTORE_SERVER = "novastaris.ai";
const LOCAL_KEY = "novastaris_biometric_v1";
export const BIOMETRIC_PROMPT_DISMISSED_KEY = "novastaris_biometric_prompt_dismissed_v1";

/** Non-secret metadata so the UI knows fingerprint is set up without triggering a prompt. */
export type BiometricEnrollment = {
  credentialId: string;
  userId: string;
  label: string;
};

export type BiometricAvailability =
  | { status: "unsupported" }
  | { status: "update-required" }
  | { status: "not-enrolled-on-device" }
  | { status: "available" };

const ERR_USER_CANCEL = "16";
const ERR_NO_PROTECTED_CREDENTIALS = "21";

export class BiometricCancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

function errorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  return code == null ? "" : String(code);
}

function isPluginAvailable(): boolean {
  if (!isCapacitorNative()) return false;
  const w = window as Window & { Capacitor?: { isPluginAvailable?: (name: string) => boolean } };
  return !!w.Capacitor?.isPluginAvailable?.("NativeBiometric");
}

async function plugin() {
  return import("@capgo/capacitor-native-biometric");
}

export function getLocalEnrollment(): BiometricEnrollment | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BiometricEnrollment>;
    if (!parsed.credentialId || !parsed.userId) return null;
    return { credentialId: parsed.credentialId, userId: parsed.userId, label: parsed.label ?? "" };
  } catch {
    return null;
  }
}

function setLocalEnrollment(e: BiometricEnrollment | null) {
  try {
    if (e) localStorage.setItem(LOCAL_KEY, JSON.stringify(e));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function deleteKeystoreCredential() {
  try {
    const { NativeBiometric } = await plugin();
    await NativeBiometric.deleteCredentials({ server: KEYSTORE_SERVER });
  } catch {
    /* nothing stored */
  }
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isCapacitorNative()) return { status: "unsupported" };
  if (!isPluginAvailable()) return { status: "update-required" };
  try {
    const { NativeBiometric } = await plugin();
    const res = await NativeBiometric.isAvailable();
    if (!res.isAvailable || !res.strongBiometryIsAvailable) return { status: "not-enrolled-on-device" };
    return { status: "available" };
  } catch {
    return { status: "not-enrolled-on-device" };
  }
}

/** Creates a server device token and stores it in the Android Keystore behind the fingerprint. */
export async function enableBiometricSignIn(user: { id: string; label: string }): Promise<void> {
  const { NativeBiometric, AccessControl } = await plugin();
  const previous = getLocalEnrollment();

  const res = await fetch("/api/account/biometric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      deviceLabel: "Android app",
      replaceCredentialId: previous?.userId === user.id ? previous.credentialId : undefined,
    }),
  });
  const data = (await res.json()) as { success?: boolean; credentialId?: string; deviceToken?: string; error?: string };
  if (!res.ok || !data.success || !data.credentialId || !data.deviceToken) {
    throw new Error(data.error ?? "Could not enable fingerprint sign-in.");
  }

  try {
    await deleteKeystoreCredential();
    await NativeBiometric.setCredentials({
      server: KEYSTORE_SERVER,
      username: user.id,
      password: data.deviceToken,
      accessControl: AccessControl.BIOMETRY_CURRENT_SET,
      title: "Enable fingerprint sign-in",
      negativeButtonText: "Cancel",
    });
  } catch (e) {
    void fetch("/api/account/biometric", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credentialId: data.credentialId }),
    });
    if (errorCode(e) === ERR_USER_CANCEL) throw new BiometricCancelledError();
    throw new Error("Fingerprint could not be saved on this device.");
  }

  setLocalEnrollment({ credentialId: data.credentialId, userId: user.id, label: user.label });
}

/** Removes the fingerprint credential from this device and revokes it server-side when signed in. */
export async function disableBiometricSignIn(): Promise<void> {
  const local = getLocalEnrollment();
  await deleteKeystoreCredential();
  setLocalEnrollment(null);
  if (local) {
    try {
      await fetch("/api/account/biometric", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credentialId: local.credentialId }),
      });
    } catch {
      /* offline: the token is already gone from the device */
    }
  }
}

/** Shows the fingerprint prompt and exchanges the Keystore token for a session cookie. */
export async function signInWithBiometric(): Promise<void> {
  const { NativeBiometric } = await plugin();
  let deviceToken: string;
  try {
    const creds = await NativeBiometric.getSecureCredentials({
      server: KEYSTORE_SERVER,
      title: "Sign in to NovaStaris",
      subtitle: "Use your fingerprint",
      negativeButtonText: "Use password",
    });
    deviceToken = creds.password;
  } catch (e) {
    const code = errorCode(e);
    if (code === ERR_USER_CANCEL) throw new BiometricCancelledError();
    if (code === ERR_NO_PROTECTED_CREDENTIALS) {
      setLocalEnrollment(null);
      throw new Error("Your fingerprints changed on this device. Sign in with your password, then turn fingerprint sign-in back on in Account.");
    }
    throw new Error("Fingerprint not recognized. Try again or sign in with your password.");
  }

  const res = await fetch("/api/auth/biometric-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ deviceToken }),
  });
  const data = (await res.json()) as { success?: boolean; error?: string; revoked?: boolean };
  if (!res.ok || !data.success) {
    if (data.revoked) {
      await deleteKeystoreCredential();
      setLocalEnrollment(null);
    }
    throw new Error(data.error ?? "Fingerprint sign-in failed. Sign in with your password.");
  }
}
