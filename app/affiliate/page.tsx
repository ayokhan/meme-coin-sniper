"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, Gift, Users, Zap } from "lucide-react";
import { openTelegramShare, sharePnlWithFallback } from "@/lib/pnl-share";
import { downloadAffiliatePostcard, drawAffiliatePostcard } from "@/lib/affiliate-share-image";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";

type CommissionRow = {
  id: string;
  refereeLabel: string;
  refereeRegisteredAt: string;
  subscriptionAmountUsd: number;
  commissionRatePct: number;
  commissionAmountUsd: number;
  status: string;
  statusLabel: string;
  paidAt: string | null;
  createdAt: string;
};

type AffiliateData = {
  referralCode: string;
  referralLink: string;
  commissionRatePct: number;
  stats: {
    totalReferrals: number;
    totalCommissions: number;
    totalEarnedUsd: number;
    pendingUsd: number;
    paidUsd: number;
    thisWeekUsd?: number;
  };
  nextPayoutFriday: string;
  terms: { title: string; bullets: string[]; payoutNote: string };
  commissions: CommissionRow[];
};

function statusBadge(status: string) {
  if (status === "paid") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        Paid
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
      Pending verification
    </span>
  );
}

export default function AffiliatePage() {
  const { status } = useSession();
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [postcardBusy, setPostcardBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (date) params.set("date", date);
      const qs = params.toString();
      const res = await fetch(`/api/affiliate${qs ? `?${qs}` : ""}`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not load affiliate dashboard.");
        setData(null);
        return;
      }
      setData(json as AffiliateData);
    } catch {
      setError("Network error.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, date]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    void load();
  }, [status, load]);

  const copy = async (text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-lg mx-auto py-16 px-6 text-center space-y-4">
        <Gift className="h-10 w-10 mx-auto text-amber-500" />
        <h1 className="text-xl font-semibold">NovaStaris Affiliate Program</h1>
        <p className="text-sm text-muted-foreground">Sign in to get your referral link and track commissions.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/signin?callbackUrl=/affiliate">Sign in</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void downloadAffiliatePostcard(
                undefined,
                `NovaStaris_Affiliate_Ad_${new Date().toISOString().slice(0, 10)}.jpg`
              )
            }
          >
            Download ad postcard
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to app</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Back to app</Link>
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">NovaStaris Affiliate Program</h1>
        <p className="text-sm text-muted-foreground">
          Earn <strong className="text-foreground">{data?.commissionRatePct ?? 10}%</strong> when friends you refer subscribe to VIP.
        </p>
      </div>

      <Card className="border-teal-500/30 bg-teal-500/5 dark:bg-teal-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Social ad postcard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Generic 1080×1080 image for WhatsApp Status, Instagram Stories, or posts — no personal code. Points people to{" "}
            <span className="font-medium text-foreground">novastaris.ai/affiliate</span>.
          </p>
          <Button
            type="button"
            className="bg-teal-500 text-zinc-950 hover:bg-teal-600"
            disabled={postcardBusy}
            onClick={async () => {
              setPostcardBusy(true);
              try {
                await downloadAffiliatePostcard(
                  { commissionRatePct: data?.commissionRatePct ?? 10 },
                  `NovaStaris_Affiliate_Ad_${new Date().toISOString().slice(0, 10)}.jpg`
                );
              } finally {
                setPostcardBusy(false);
              }
            }}
          >
            {postcardBusy ? "Preparing…" : "Download ad postcard"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80 bg-gradient-to-b from-zinc-900/5 to-transparent dark:from-zinc-900/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your referral link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3">
              <p className="text-xs text-muted-foreground mb-1">Commission rate</p>
              <p className="text-2xl font-bold">{data?.commissionRatePct ?? 10}%</p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3">
              <p className="text-xs text-muted-foreground mb-1">Registered via your link</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-500" />
                {data?.stats.totalReferrals ?? (loading ? "…" : 0)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Referral code</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={data?.referralCode ?? ""}
                className="flex-1 font-mono text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!data?.referralCode}
                onClick={() => data?.referralCode && void copy(data.referralCode, "code")}
              >
                {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Referral link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={data?.referralLink ?? ""}
                className="flex-1 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!data?.referralLink}
                onClick={() => data?.referralLink && void copy(data.referralLink, "link")}
              >
                {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {data?.referralLink && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-teal-500 text-zinc-950 hover:bg-teal-600"
                disabled={postcardBusy}
                onClick={async () => {
                  setPostcardBusy(true);
                  try {
                    const blob = await drawAffiliatePostcard({
                      referralCode: data.referralCode,
                      referralLink: data.referralLink,
                      commissionRatePct: data.commissionRatePct,
                    });
                    const caption = `Earn ${data.commissionRatePct}% on VIP referrals with me on NovaStaris\nCode: ${data.referralCode}\n${data.referralLink}`;
                    const result = await sharePnlWithFallback(
                      blob,
                      `NovaStaris_Affiliate_${data.referralCode}.jpg`,
                      caption
                    );
                    if (result === "download" || result === "unsupported") {
                      // sharePnlWithFallback already downloads on fallback
                    }
                  } catch {
                    try {
                      await downloadAffiliatePostcard({
                        referralCode: data.referralCode,
                        referralLink: data.referralLink,
                        commissionRatePct: data.commissionRatePct,
                      });
                    } catch {
                      /* ignore */
                    }
                  } finally {
                    setPostcardBusy(false);
                  }
                }}
              >
                {postcardBusy ? "Preparing…" : "Share postcard"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={postcardBusy}
                onClick={async () => {
                  setPostcardBusy(true);
                  try {
                    await downloadAffiliatePostcard({
                      referralCode: data.referralCode,
                      referralLink: data.referralLink,
                      commissionRatePct: data.commissionRatePct,
                    });
                  } finally {
                    setPostcardBusy(false);
                  }
                }}
              >
                Download my postcard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                asChild
              >
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Earn with me on NovaStaris — ${data.commissionRatePct}% VIP referral\n${data.referralLink}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share WhatsApp
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  openTelegramShare(
                    `Earn with me on NovaStaris — ${data.commissionRatePct}% VIP referral\n${data.referralLink}`,
                    data.referralLink
                  )
                }
              >
                Share Telegram
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 dark:bg-amber-950/40 px-3 py-2.5">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Next weekly payout: {data?.nextPayoutFriday ?? "Friday"}
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">
              Paid after verification — commissions marked pending until then.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">This week</p>
            <p className="text-xl font-bold font-mono">${(data?.stats.thisWeekUsd ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total earned</p>
            <p className="text-xl font-bold font-mono">${(data?.stats.totalEarnedUsd ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pending verification</p>
            <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300">
              ${(data?.stats.pendingUsd ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Paid out</p>
            <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
              ${(data?.stats.paidUsd ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <CardTitle className="text-base">Referral history</CardTitle>
          <div className="flex flex-wrap gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setDate("");
              }}
              className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
            />
            {(month || date) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMonth("");
                  setDate("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.commissions.length ? (
            <p className="text-sm text-muted-foreground">No VIP commissions yet. Share your link to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-3">Invitee</th>
                    <th className="py-2 pr-3">VIP paid</th>
                    <th className="py-2 pr-3">Your commission</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                      <td className="py-2.5 pr-3">{c.refereeLabel}</td>
                      <td className="py-2.5 pr-3 font-mono">${c.subscriptionAmountUsd}</td>
                      <td className="py-2.5 pr-3 font-mono text-cyan-700 dark:text-cyan-300">
                        ${c.commissionAmountUsd.toFixed(2)} ({c.commissionRatePct}%)
                      </td>
                      <td className="py-2.5 pr-3">{statusBadge(c.status)}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.terms && (
        <Card className="border-amber-200/60 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{data.terms.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1.5">
              {data.terms.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="text-xs pt-2 border-t border-zinc-200 dark:border-zinc-700">{data.terms.payoutNote}</p>
          </CardContent>
        </Card>
      )}
      <SiteInstagramFooter />
    </div>
  );
}
