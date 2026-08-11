/**
 * Owner-only Realtor AI Ops config. Single DB row id "default".
 * Secrets are stored in DB but returned masked; blank/•••• on save keeps existing.
 * Swap test → live by updating these fields (and flipping mode) — no rewrite.
 */

import { prisma } from "@/lib/db";

export const REALTOR_OS_CONFIG_ID = "default";

export type RealtorOsMode = "test" | "live";

export type RealtorOsConfig = {
  clientName: string;
  mode: RealtorOsMode;
  /** When true, email drafts require human approve before send */
  approveBeforeSend: boolean;
  notes: string;
  email: {
    provider: "gmail" | "outlook" | "other";
    address: string;
    /** App password / OAuth refresh — stored, never shown full */
    secret: string;
  };
  phone: {
    provider: "twilio" | "other";
    number: string;
    accountSid: string;
    authToken: string;
  };
  calendar: {
    provider: "google" | "outlook" | "other";
    calendarId: string;
    /** OAuth / service account hint — stored masked */
    secret: string;
  };
  /** Optional booking link shown in auto-replies while wiring calendar */
  bookingLink: string;
};

export type RealtorOsConfigPublic = Omit<RealtorOsConfig, "email" | "phone" | "calendar"> & {
  email: { provider: RealtorOsConfig["email"]["provider"]; address: string; secretSet: boolean; secretMasked: string };
  phone: {
    provider: RealtorOsConfig["phone"]["provider"];
    number: string;
    accountSidSet: boolean;
    accountSidMasked: string;
    authTokenSet: boolean;
    authTokenMasked: string;
  };
  calendar: {
    provider: RealtorOsConfig["calendar"]["provider"];
    calendarId: string;
    secretSet: boolean;
    secretMasked: string;
  };
  updatedAt: string | null;
  connectionStatus: {
    email: "empty" | "configured";
    phone: "empty" | "configured";
    calendar: "empty" | "configured";
  };
};

export const DEFAULT_REALTOR_OS_CONFIG: RealtorOsConfig = {
  clientName: "",
  mode: "test",
  approveBeforeSend: true,
  notes: "Use a real Gmail + App Password for demos. Sync inbox → AI draft → Send. Flip mode to live when showing the client.",
  email: { provider: "gmail", address: "", secret: "" },
  phone: { provider: "twilio", number: "", accountSid: "", authToken: "" },
  calendar: { provider: "google", calendarId: "", secret: "" },
  bookingLink: "",
};

const KEEP = new Set(["", "••••", "****", "(unchanged)"]);

function maskSecret(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 4) return "••••";
  return `••••${v.slice(-4)}`;
}

function isKeep(value: unknown): boolean {
  return typeof value !== "string" || KEEP.has(value.trim()) || value.trim().startsWith("••••");
}

function asProvider<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function normalizeRealtorOsConfig(raw: unknown): RealtorOsConfig {
  const d = DEFAULT_REALTOR_OS_CONFIG;
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const email = o.email && typeof o.email === "object" ? (o.email as Record<string, unknown>) : {};
  const phone = o.phone && typeof o.phone === "object" ? (o.phone as Record<string, unknown>) : {};
  const calendar = o.calendar && typeof o.calendar === "object" ? (o.calendar as Record<string, unknown>) : {};
  return {
    clientName: typeof o.clientName === "string" ? o.clientName.trim().slice(0, 120) : d.clientName,
    mode: o.mode === "live" ? "live" : "test",
    approveBeforeSend: o.approveBeforeSend !== false,
    notes: typeof o.notes === "string" ? o.notes.trim().slice(0, 2000) : d.notes,
    email: {
      provider: asProvider(email.provider, ["gmail", "outlook", "other"] as const, "gmail"),
      address: typeof email.address === "string" ? email.address.trim().slice(0, 200) : "",
      secret: typeof email.secret === "string" ? email.secret.trim().slice(0, 2000) : "",
    },
    phone: {
      provider: asProvider(phone.provider, ["twilio", "other"] as const, "twilio"),
      number: typeof phone.number === "string" ? phone.number.trim().slice(0, 40) : "",
      accountSid: typeof phone.accountSid === "string" ? phone.accountSid.trim().slice(0, 200) : "",
      authToken: typeof phone.authToken === "string" ? phone.authToken.trim().slice(0, 200) : "",
    },
    calendar: {
      provider: asProvider(calendar.provider, ["google", "outlook", "other"] as const, "google"),
      calendarId: typeof calendar.calendarId === "string" ? calendar.calendarId.trim().slice(0, 300) : "",
      secret: typeof calendar.secret === "string" ? calendar.secret.trim().slice(0, 4000) : "",
    },
    bookingLink: typeof o.bookingLink === "string" ? o.bookingLink.trim().slice(0, 500) : "",
  };
}

export function toPublicRealtorOsConfig(config: RealtorOsConfig, updatedAt: Date | null): RealtorOsConfigPublic {
  return {
    clientName: config.clientName,
    mode: config.mode,
    approveBeforeSend: config.approveBeforeSend,
    notes: config.notes,
    bookingLink: config.bookingLink,
    email: {
      provider: config.email.provider,
      address: config.email.address,
      secretSet: !!config.email.secret,
      secretMasked: maskSecret(config.email.secret),
    },
    phone: {
      provider: config.phone.provider,
      number: config.phone.number,
      accountSidSet: !!config.phone.accountSid,
      accountSidMasked: maskSecret(config.phone.accountSid),
      authTokenSet: !!config.phone.authToken,
      authTokenMasked: maskSecret(config.phone.authToken),
    },
    calendar: {
      provider: config.calendar.provider,
      calendarId: config.calendar.calendarId,
      secretSet: !!config.calendar.secret,
      secretMasked: maskSecret(config.calendar.secret),
    },
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    connectionStatus: {
      email: config.email.address && config.email.secret ? "configured" : "empty",
      phone: config.phone.number && config.phone.accountSid && config.phone.authToken ? "configured" : "empty",
      calendar: config.calendar.calendarId ? "configured" : "empty",
    },
  };
}

type PrismaWithRealtorOs = typeof prisma & {
  realtorOsConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<{ config: unknown; updatedAt: Date } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; config: RealtorOsConfig };
      update: { config: RealtorOsConfig };
    }) => Promise<{ config: unknown; updatedAt: Date }>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithRealtorOs).realtorOsConfig ?? null;
}

export async function getRealtorOsConfig(): Promise<{ config: RealtorOsConfig; updatedAt: Date | null }> {
  const cfgDb = db();
  if (!cfgDb) return { config: { ...DEFAULT_REALTOR_OS_CONFIG }, updatedAt: null };
  try {
    const row = await cfgDb.findUnique({ where: { id: REALTOR_OS_CONFIG_ID } });
    if (!row) return { config: { ...DEFAULT_REALTOR_OS_CONFIG }, updatedAt: null };
    return { config: normalizeRealtorOsConfig(row.config), updatedAt: row.updatedAt };
  } catch {
    return { config: { ...DEFAULT_REALTOR_OS_CONFIG }, updatedAt: null };
  }
}

export async function getRealtorOsConfigPublic(): Promise<RealtorOsConfigPublic> {
  const { config, updatedAt } = await getRealtorOsConfig();
  return toPublicRealtorOsConfig(config, updatedAt);
}

/** Merge patch; masked/blank secrets keep previous values. */
export async function setRealtorOsConfig(patch: Partial<RealtorOsConfig> & Record<string, unknown>): Promise<RealtorOsConfigPublic> {
  const cfgDb = db();
  if (!cfgDb) throw new Error("Realtor OS config table unavailable. Run prisma generate / db push.");

  const { config: prev } = await getRealtorOsConfig();
  const incoming = normalizeRealtorOsConfig({
    ...prev,
    ...patch,
    email: { ...prev.email, ...(patch.email ?? {}) },
    phone: { ...prev.phone, ...(patch.phone ?? {}) },
    calendar: { ...prev.calendar, ...(patch.calendar ?? {}) },
  });

  const next: RealtorOsConfig = {
    ...incoming,
    email: {
      ...incoming.email,
      secret: isKeep((patch.email as { secret?: string } | undefined)?.secret) ? prev.email.secret : incoming.email.secret,
    },
    phone: {
      ...incoming.phone,
      accountSid: isKeep((patch.phone as { accountSid?: string } | undefined)?.accountSid)
        ? prev.phone.accountSid
        : incoming.phone.accountSid,
      authToken: isKeep((patch.phone as { authToken?: string } | undefined)?.authToken)
        ? prev.phone.authToken
        : incoming.phone.authToken,
    },
    calendar: {
      ...incoming.calendar,
      secret: isKeep((patch.calendar as { secret?: string } | undefined)?.secret)
        ? prev.calendar.secret
        : incoming.calendar.secret,
    },
  };

  const row = await cfgDb.upsert({
    where: { id: REALTOR_OS_CONFIG_ID },
    create: { id: REALTOR_OS_CONFIG_ID, config: next },
    update: { config: next },
  });
  return toPublicRealtorOsConfig(normalizeRealtorOsConfig(row.config), row.updatedAt);
}

export async function resetRealtorOsConfig(): Promise<RealtorOsConfigPublic> {
  const cfgDb = db();
  if (!cfgDb) throw new Error("Realtor OS config table unavailable. Run prisma generate / db push.");
  const row = await cfgDb.upsert({
    where: { id: REALTOR_OS_CONFIG_ID },
    create: { id: REALTOR_OS_CONFIG_ID, config: DEFAULT_REALTOR_OS_CONFIG },
    update: { config: DEFAULT_REALTOR_OS_CONFIG },
  });
  return toPublicRealtorOsConfig(DEFAULT_REALTOR_OS_CONFIG, row.updatedAt);
}
