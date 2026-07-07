"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { readReferralCookie } from "@/components/ReferralCapture";

/** After OAuth / wallet signup, attach referral from cookie if still within attribution window. */
function ReferralClaimOnAuthInner() {
  const { status } = useSession();
  const claimedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || claimedRef.current) return;
    const code = readReferralCookie();
    if (!code) return;
    claimedRef.current = true;
    void fetch("/api/affiliate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: code }),
    }).catch(() => {
      claimedRef.current = false;
    });
  }, [status]);

  return null;
}

export default function ReferralClaimOnAuth() {
  return <ReferralClaimOnAuthInner />;
}
