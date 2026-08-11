import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import type { RealtorOsConfig } from "@/lib/realtor-os-config";

export type MailEndpoints = {
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
};

export function mailEndpointsFor(provider: RealtorOsConfig["email"]["provider"]): MailEndpoints {
  if (provider === "outlook") {
    return {
      imap: { host: "outlook.office365.com", port: 993, secure: true },
      smtp: { host: "smtp.office365.com", port: 587, secure: false },
    };
  }
  // gmail + other default to Gmail-compatible hosts (user can still use app password on Gmail)
  return {
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
  };
}

export type FetchedMail = {
  internetMessageId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
};

function extractAddress(value: unknown): { address: string; name: string | null } {
  if (!value) return { address: "", name: null };
  if (typeof value === "object" && value !== null && "value" in value) {
    const arr = (value as { value?: Array<{ address?: string; name?: string }> }).value;
    const first = arr?.[0];
    return { address: (first?.address ?? "").toLowerCase(), name: first?.name?.trim() || null };
  }
  if (typeof value === "string") {
    const m = value.match(/<([^>]+)>/);
    return { address: (m?.[1] ?? value).trim().toLowerCase(), name: null };
  }
  return { address: "", name: null };
}

export async function testMailboxLogin(config: RealtorOsConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!config.email.address || !config.email.secret) {
    return { ok: false, error: "Email address and app password / secret are required." };
  }
  const endpoints = mailEndpointsFor(config.email.provider);
  const client = new ImapFlow({
    host: endpoints.imap.host,
    port: endpoints.imap.port,
    secure: endpoints.imap.secure,
    auth: { user: config.email.address, pass: config.email.secret },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "IMAP login failed";
    return { ok: false, error: message };
  } finally {
    try {
      if (client.usable) await client.logout();
    } catch {
      /* ignore */
    }
  }
}

/** Fetch newest inbox messages (on-demand sync for demo). */
export async function fetchInboxMessages(
  config: RealtorOsConfig,
  opts?: { limit?: number }
): Promise<FetchedMail[]> {
  if (!config.email.address || !config.email.secret) {
    throw new Error("Email address and app password / secret are required.");
  }
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const endpoints = mailEndpointsFor(config.email.provider);
  const client = new ImapFlow({
    host: endpoints.imap.host,
    port: endpoints.imap.port,
    secure: endpoints.imap.secure,
    auth: { user: config.email.address, pass: config.email.secret },
    logger: false,
  });

  const out: FetchedMail[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = client.mailbox && typeof client.mailbox.exists === "number" ? client.mailbox.exists : 0;
      if (total < 1) return out;
      const start = Math.max(1, total - limit + 1);
      for await (const msg of client.fetch(`${start}:*`, { source: true, envelope: true, uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const from = extractAddress(parsed.from);
        const to = extractAddress(parsed.to);
        const bodyText =
          (parsed.text && parsed.text.trim()) ||
          (typeof parsed.html === "string"
            ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : "") ||
          "";
        out.push({
          internetMessageId: parsed.messageId?.trim() || null,
          fromAddress: from.address || "unknown",
          fromName: from.name,
          toAddress: to.address || config.email.address.toLowerCase(),
          subject: (parsed.subject || "(no subject)").slice(0, 500),
          bodyText: bodyText.slice(0, 20000),
          receivedAt: parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  out.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  return out.slice(0, limit);
}

export async function sendRealtorReply(opts: {
  config: RealtorOsConfig;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}): Promise<void> {
  const { config, to, subject, body, inReplyTo } = opts;
  if (!config.email.address || !config.email.secret) {
    throw new Error("Email address and app password / secret are required.");
  }
  const endpoints = mailEndpointsFor(config.email.provider);
  const transporter = nodemailer.createTransport({
    host: endpoints.smtp.host,
    port: endpoints.smtp.port,
    secure: endpoints.smtp.secure,
    auth: { user: config.email.address, pass: config.email.secret },
  });

  const fromName = config.clientName?.trim() || "Realty desk";
  await transporter.sendMail({
    from: `"${fromName}" <${config.email.address}>`,
    to,
    subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
    text: body,
    headers: inReplyTo ? { "In-Reply-To": inReplyTo, References: inReplyTo } : undefined,
  });
}
