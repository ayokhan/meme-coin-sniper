import { prisma } from "@/lib/db";
import { getRealtorOsConfig } from "@/lib/realtor-os-config";
import { draftRealtorReply } from "@/lib/realtor-os/draft";
import { fetchInboxMessages, sendRealtorReply, testMailboxLogin } from "@/lib/realtor-os/mail";

type PrismaRealtor = typeof prisma & {
  realtorOsLead?: {
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    upsert: (args: unknown) => Promise<{ id: string; email: string; name: string | null }>;
    update: (args: unknown) => Promise<unknown>;
  };
  realtorOsMessage?: {
    findUnique: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
};

function db() {
  return prisma as unknown as PrismaRealtor;
}

function ownEmail(address: string, deskEmail: string) {
  return address.trim().toLowerCase() === deskEmail.trim().toLowerCase();
}

export async function verifyRealtorMailbox() {
  const { config } = await getRealtorOsConfig();
  return testMailboxLogin(config);
}

export async function syncRealtorInbox(opts?: { limit?: number; autoDraft?: boolean }) {
  const { config } = await getRealtorOsConfig();
  const messages = await fetchInboxMessages(config, { limit: opts?.limit ?? 20 });
  const leadDb = db().realtorOsLead;
  const msgDb = db().realtorOsMessage;
  if (!leadDb || !msgDb) throw new Error("Realtor OS tables missing — run prisma db push.");

  let imported = 0;
  let skipped = 0;
  let drafted = 0;

  for (const m of messages) {
    if (ownEmail(m.fromAddress, config.email.address)) {
      skipped += 1;
      continue;
    }
    if (m.internetMessageId) {
      const existing = (await msgDb.findUnique({
        where: { internetMessageId: m.internetMessageId },
      })) as { id: string } | null;
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    const lead = await leadDb.upsert({
      where: { email: m.fromAddress },
      create: {
        email: m.fromAddress,
        name: m.fromName,
        status: "new",
        notes: null,
      },
      update: {
        name: m.fromName || undefined,
        updatedAt: new Date(),
      },
    });

    const created = (await msgDb.create({
      data: {
        leadId: lead.id,
        internetMessageId: m.internetMessageId,
        direction: "inbound",
        fromAddress: m.fromAddress,
        toAddress: m.toAddress,
        subject: m.subject,
        bodyText: m.bodyText,
        receivedAt: m.receivedAt,
        draftStatus: "none",
      },
    })) as { id: string };

    imported += 1;

    if (opts?.autoDraft !== false) {
      try {
        const draft = await draftRealtorReply({
          config,
          fromName: m.fromName,
          fromAddress: m.fromAddress,
          subject: m.subject,
          bodyText: m.bodyText,
        });
        await msgDb.update({
          where: { id: created.id },
          data: { draftBody: draft.draftBody, draftStatus: "draft" },
        });
        await leadDb.update({
          where: { id: lead.id },
          data: {
            intent: draft.intent,
            area: draft.area,
            notes: draft.summary,
            status: "new",
          },
        });
        drafted += 1;
      } catch (e) {
        console.warn("realtor draft failed:", e);
      }
    }
  }

  return { imported, skipped, drafted, fetched: messages.length };
}

export async function listRealtorDesk() {
  const leadDb = db().realtorOsLead;
  const msgDb = db().realtorOsMessage;
  if (!leadDb || !msgDb) throw new Error("Realtor OS tables missing — run prisma db push.");

  const leads = (await leadDb.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  })) as Array<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    intent: string | null;
    area: string | null;
    status: string;
    notes: string | null;
    updatedAt: Date;
  }>;

  const messages = (await msgDb.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
  })) as Array<{
    id: string;
    leadId: string | null;
    direction: string;
    fromAddress: string;
    toAddress: string;
    subject: string;
    bodyText: string;
    receivedAt: Date | null;
    draftBody: string | null;
    draftStatus: string;
    sentAt: Date | null;
    internetMessageId: string | null;
    createdAt: Date;
  }>;

  return {
    leads: leads.map((l) => ({
      ...l,
      updatedAt: l.updatedAt.toISOString(),
    })),
    messages: messages.map((m) => ({
      ...m,
      receivedAt: m.receivedAt?.toISOString() ?? null,
      sentAt: m.sentAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      bodyPreview: m.bodyText.slice(0, 280),
    })),
  };
}

export async function createDraftForMessage(messageId: string) {
  const { config } = await getRealtorOsConfig();
  const msgDb = db().realtorOsMessage;
  const leadDb = db().realtorOsLead;
  if (!msgDb || !leadDb) throw new Error("Realtor OS tables missing.");

  const message = (await msgDb.findUnique({ where: { id: messageId } })) as {
    id: string;
    leadId: string | null;
    fromAddress: string;
    subject: string;
    bodyText: string;
    direction: string;
  } | null;
  if (!message || message.direction !== "inbound") throw new Error("Inbound message not found.");

  let fromName: string | null = null;
  if (message.leadId) {
    const lead = (await leadDb.findUnique({ where: { id: message.leadId } })) as { name: string | null } | null;
    fromName = lead?.name ?? null;
  }

  const draft = await draftRealtorReply({
    config,
    fromName,
    fromAddress: message.fromAddress,
    subject: message.subject,
    bodyText: message.bodyText,
  });

  await msgDb.update({
    where: { id: message.id },
    data: { draftBody: draft.draftBody, draftStatus: "draft" },
  });
  if (message.leadId) {
    await leadDb.update({
      where: { id: message.leadId },
      data: { intent: draft.intent, area: draft.area, notes: draft.summary },
    });
  }
  return draft;
}

export async function saveDraftBody(messageId: string, draftBody: string) {
  const msgDb = db().realtorOsMessage;
  if (!msgDb) throw new Error("Realtor OS tables missing.");
  await msgDb.update({
    where: { id: messageId },
    data: { draftBody: draftBody.trim().slice(0, 8000), draftStatus: "draft" },
  });
}

export async function sendDraft(messageId: string, draftBody?: string) {
  const { config } = await getRealtorOsConfig();
  const msgDb = db().realtorOsMessage;
  const leadDb = db().realtorOsLead;
  if (!msgDb || !leadDb) throw new Error("Realtor OS tables missing.");

  const message = (await msgDb.findUnique({ where: { id: messageId } })) as {
    id: string;
    leadId: string | null;
    fromAddress: string;
    subject: string;
    draftBody: string | null;
    internetMessageId: string | null;
    direction: string;
  } | null;
  if (!message || message.direction !== "inbound") throw new Error("Inbound message not found.");

  const body = (draftBody ?? message.draftBody ?? "").trim();
  if (!body) throw new Error("Draft is empty.");

  await sendRealtorReply({
    config,
    to: message.fromAddress,
    subject: message.subject,
    body,
    inReplyTo: message.internetMessageId,
  });

  await msgDb.update({
    where: { id: message.id },
    data: { draftBody: body, draftStatus: "sent", sentAt: new Date() },
  });

  await msgDb.create({
    data: {
      leadId: message.leadId,
      direction: "outbound",
      fromAddress: config.email.address.toLowerCase(),
      toAddress: message.fromAddress,
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      bodyText: body,
      draftStatus: "sent",
      sentAt: new Date(),
      receivedAt: new Date(),
    },
  });

  if (message.leadId) {
    await leadDb.update({
      where: { id: message.leadId },
      data: { status: "contacted" },
    });
  }
}

export async function skipMessage(messageId: string) {
  const msgDb = db().realtorOsMessage;
  if (!msgDb) throw new Error("Realtor OS tables missing.");
  await msgDb.update({
    where: { id: messageId },
    data: { draftStatus: "skipped" },
  });
}

export async function updateLeadStatus(leadId: string, status: string) {
  const allowed = new Set(["new", "contacted", "booked", "closed", "spam"]);
  if (!allowed.has(status)) throw new Error("Invalid status.");
  const leadDb = db().realtorOsLead;
  if (!leadDb) throw new Error("Realtor OS tables missing.");
  await leadDb.update({ where: { id: leadId }, data: { status } });
}
