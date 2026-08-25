import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/send-email";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { upsertTodaysFuturesDailyWrap } from "@/lib/futures-daily-wrap";
import { futuresWrapDb } from "@/lib/futures-daily-wrap-db";
import {
  buildMorningFuturesBriefEmailHtml,
  morningFuturesBriefSubject,
} from "@/lib/futures-daily-wrap-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dedicated lightweight cron: Daily Futures Wrap + optional Daily Futures Brief emails.
 * Independent of master /api/cron (keep master OFF for CPU; keep this ON for the wrap).
 * Auth: Bearer CRON_SECRET.
 * Flag: futures_daily_wrap_cron (Admin → Feature flags).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wrapCronEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.FUTURES_DAILY_WRAP_CRON);
  if (!wrapCronEnabled) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message:
        "Daily Futures Wrap cron disabled in Admin → Feature flags → Daily Futures Wrap cron.",
    });
  }

  try {
    const wrapRow = await upsertTodaysFuturesDailyWrap();
    const stored = await futuresWrapDb.futuresDailyWrap.findUnique({
      where: { dateKey: wrapRow.dateKey },
      select: {
        telegramHtml: true,
        hotTopics: true,
        marketUpdates: true,
        emailTeaser: true,
        title: true,
        publishedAt: true,
      },
    });

    const telegramText =
      stored?.telegramHtml ??
      `📊 <b>${wrapRow.title}</b>\n\nOpen: https://novastaris.ai/?tab=daily-wrap`;
    const telegramOk = await sendTelegramMessage(telegramText);

    const teaser = (stored?.emailTeaser as typeof wrapRow.emailTeaser) ?? wrapRow.emailTeaser;
    const hotTopics = (stored?.hotTopics as typeof wrapRow.hotTopics) ?? wrapRow.hotTopics;
    const marketUpdates =
      (stored?.marketUpdates as typeof wrapRow.marketUpdates) ?? wrapRow.marketUpdates;
    const title = stored?.title ?? wrapRow.title;
    const publishedAt = stored?.publishedAt ?? new Date(wrapRow.publishedAt);

    const teaserHtml = buildMorningFuturesBriefEmailHtml({
      title,
      publishedAt,
      teaser,
      full: false,
    });
    const fullHtml = buildMorningFuturesBriefEmailHtml({
      title,
      publishedAt,
      teaser,
      full: true,
      hotTopics,
      marketUpdates,
    });
    const subject = morningFuturesBriefSubject(title);

    let emailOk = false;
    const digestEmailTo = process.env.DIGEST_EMAIL_TO?.trim();
    if (digestEmailTo) {
      const toAddresses = digestEmailTo.split(",").map((e) => e.trim()).filter(Boolean);
      for (const to of toAddresses) {
        const sent = await sendEmail(to, subject, fullHtml);
        if (sent) emailOk = true;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const sendToSubscribers = await getFeatureFlag(FEATURE_FLAG_KEYS.DIGEST_TO_NEWSLETTER_SUBSCRIBERS);
    if (sendToSubscribers) {
      const subscribers = await prisma.user.findMany({
        where: { newsletterOptIn: true, email: { not: null } },
        select: { email: true },
      });
      for (const u of subscribers) {
        const to = u.email!;
        const sent = await sendEmail(to, subject, teaserHtml);
        if (sent) emailOk = true;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: telegramOk,
      emailSent: emailOk,
      dateKey: wrapRow.dateKey,
      wrapId: wrapRow.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp digest failed";
    console.error("Cron perp-digest:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
