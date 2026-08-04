/**
 * Auto-send welcome email after signup (noreply — do not invite email replies).
 */

import { WELCOME_EMAIL } from "@/lib/welcome-email";
import { buildAnnouncementEmailHtml } from "@/lib/announcement-email";
import { sendEmailDetailed } from "@/lib/send-email";

const START_HERE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai"
).replace(/\/$/, "") + "/start-here";

/** Fire-and-forget safe; never throws to callers. */
export async function sendWelcomeEmailToUser(email: string | null | undefined): Promise<void> {
  const to = (email ?? "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
  try {
    const html = buildAnnouncementEmailHtml({
      body: WELCOME_EMAIL.body,
      template: "welcome",
      format: "rich",
      ctaLabel: "Open Start here",
      ctaUrl: START_HERE_URL,
    });
    const result = await sendEmailDetailed(to, WELCOME_EMAIL.subject, html);
    if (!result.ok) {
      console.warn("Welcome email failed:", to, result.error);
    }
  } catch (e) {
    console.error("sendWelcomeEmailToUser:", e);
  }
}
