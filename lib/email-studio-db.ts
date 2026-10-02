import { prisma } from "@/lib/db";

export type StudioCampaignRecord = {
  id: string;
  angle: string;
  subject: string;
  segment: string;
  html: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  cappedCount: number;
  createdByUserId: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

export type StudioRecipientRecord = {
  id: string;
  campaignId: string;
  email: string;
  status: string;
  error: string | null;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  clicks: number;
  createdAt: Date;
};

type GroupCount<K extends string> = Array<Record<K, string> & { _count: { _all: number } }>;

/** Typed access to the Email Studio tables (the repo's @prisma/client type shim doesn't declare them). */
export function studioDb() {
  return prisma as unknown as {
    emailStudioCampaign: {
      create: (args: unknown) => Promise<StudioCampaignRecord>;
      update: (args: unknown) => Promise<StudioCampaignRecord>;
      findMany: (args?: unknown) => Promise<StudioCampaignRecord[]>;
    };
    emailStudioRecipient: {
      createMany: (args: unknown) => Promise<{ count: number }>;
      findMany: (args?: unknown) => Promise<Pick<StudioRecipientRecord, "id" | "email">[]>;
      update: (args: unknown) => Promise<StudioRecipientRecord>;
      updateMany: (args: unknown) => Promise<{ count: number }>;
      groupBy: <K extends "email" | "campaignId">(args: { by: K[] } & Record<string, unknown>) => Promise<GroupCount<K>>;
    };
    strongRunnerPick: {
      findMany: (args?: unknown) => Promise<
        Array<{
          chain: string;
          tokenAddress: string;
          symbol: string;
          narrative: string | null;
          mcapAtFlag: number;
          peakMcap: number | null;
          lastMcap: number | null;
          flaggedAt: Date;
        }>
      >;
    };
    user: { updateMany: (args: unknown) => Promise<{ count: number }> };
  };
}
