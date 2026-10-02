import { addEmailSuppressions } from "@/lib/email-suppression";
import { normalizeEmailAddress } from "@/lib/email-links";
import { studioDb } from "@/lib/email-studio-db";

/** Opt-out from marketing: suppression list (all blasts) + newsletter flag off. */
export async function unsubscribeEmail(rawEmail: string): Promise<void> {
  const email = normalizeEmailAddress(rawEmail);
  await addEmailSuppressions([email], { reason: "user_opt_out", note: "Unsubscribe link" });
  await studioDb()
    .user.updateMany({ where: { email: { equals: email, mode: "insensitive" } }, data: { newsletterOptIn: false } })
    .catch(() => null);
}
