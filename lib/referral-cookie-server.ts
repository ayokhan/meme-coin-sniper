import { cookies } from "next/headers";
import { REFERRAL_COOKIE_NAME, normalizeReferralCode } from "@/lib/referral-program";

export async function readReferralCodeFromCookies(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(REFERRAL_COOKIE_NAME)?.value;
  return normalizeReferralCode(raw ? decodeURIComponent(raw) : null);
}
