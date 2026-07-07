"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { REFERRAL_COOKIE_MAX_AGE_DAYS, REFERRAL_COOKIE_NAME, normalizeReferralCode } from "@/lib/referral-program";

/** Persist ?ref=CODE in a cookie so signup (email, Google, wallet) attributes the referral. */
export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    const code = normalizeReferralCode(ref);
    if (!code) return;
    const maxAge = REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, [searchParams]);

  return null;
}

export function readReferralCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REFERRAL_COOKIE_NAME}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(REFERRAL_COOKIE_NAME.length + 1));
  return normalizeReferralCode(raw);
}
