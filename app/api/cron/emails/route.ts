import { NextResponse } from "next/server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { runVipExpiryEmails } from "@/lib/vip-expiry-email";
import { runVipTrialReminderEmails } from "@/lib/vip-trial";
import { logSystemException } from "@/lib/system-error-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dedicated daily email-notifications cron (Vercel).
 * Independent of master /api/cron so auto emails stay ON when heavy jobs are OFF.
 * Auth: Bearer CRON_SECRET.
 * Flag: email_notifications_cron (Admin → Feature flags).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.EMAIL_NOTIFICATIONS_CRON);
  if (!cronEnabled) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message:
        "Email notifications cron disabled in Admin → Feature flags → Email notifications cron.",
    });
  }

  const results: {
    vipExpiryEmails?: {
      ok: boolean;
      preSent?: number;
      postSent?: number;
      message?: string;
    };
    vipTrialEmails?: {
      ok: boolean;
      scanned?: number;
      sent?: number;
      failed?: number;
      message?: string;
      skipped?: boolean;
    };
  } = {};

  try {
    const expiry = await runVipExpiryEmails();
    results.vipExpiryEmails = {
      ok: expiry.ok,
      preSent: expiry.preSent,
      postSent: expiry.postSent,
      message: expiry.message,
    };
  } catch (e) {
    results.vipExpiryEmails = {
      ok: false,
      message: e instanceof Error ? e.message : "VIP expiry emails failed",
    };
    await logSystemException("cron.emails.vipExpiry", e);
  }

  try {
    const trialEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.VIP_TRIAL_REMINDER_EMAILS);
    if (!trialEnabled) {
      results.vipTrialEmails = {
        ok: true,
        skipped: true,
        message: "VIP trial reminder emails disabled (vip_trial_reminder_emails).",
      };
    } else {
      const trial = await runVipTrialReminderEmails();
      results.vipTrialEmails = {
        ok: true,
        scanned: trial.scanned,
        sent: trial.sent,
        failed: trial.failed,
        message: `scanned ${trial.scanned}, sent ${trial.sent}, failed ${trial.failed}`,
      };
    }
  } catch (e) {
    results.vipTrialEmails = {
      ok: false,
      message: e instanceof Error ? e.message : "VIP trial reminder emails failed",
    };
    await logSystemException("cron.emails.vipTrial", e);
  }

  const anyFailed =
    results.vipExpiryEmails?.ok === false || results.vipTrialEmails?.ok === false;

  return NextResponse.json({
    success: !anyFailed,
    emails: results,
  });
}
