"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PromoBannerAdmin } from "@/lib/promo-banner";
import type { MemeAgentBannerAdmin, MemeAgentTitleFont, MemeAgentTitleSize } from "@/lib/meme-agent-banner";
import {
  MEME_AGENT_TITLE_FONT_OPTIONS,
  MEME_AGENT_TITLE_SIZE_OPTIONS,
} from "@/lib/meme-agent-banner";
import type { MemeTableAnalyzeHintBannerAdmin } from "@/lib/meme-table-analyze-hint-banner";
import type { GuestRegistrationNudgeBannerAdmin } from "@/lib/guest-registration-nudge-banner";
import type { TwoFactorSecurityNudgeBannerAdmin } from "@/lib/two-factor-security-nudge-banner";
import type { SiteAnnouncementBannerAdmin } from "@/lib/site-announcement-banner";
import type { BlofinPartnerPromoAdmin, BlofinPartnerLinkClickRow } from "@/lib/blofin-partner-promo";
import { BLOFIN_PARTNERSHIP_EMAIL } from "@/lib/blofin-partner-promo";
import type { ForexBrokerPartnerPromoAdmin, ForexBrokerPartnerLinkClickRow } from "@/lib/forex-broker-partner-promo";
import { FOREX_PARTNERSHIP_EMAIL, forexBrokerLabel } from "@/lib/forex-broker-partner-promo";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";
import { formatPromoDrawDate } from "@/lib/promo-banner";
import { PromoBannerDisplay } from "@/components/PromoBannerDisplay";
import { BlofinPartnerPromoBanner } from "@/components/BlofinPartnerPromoBanner";
import { ForexBrokerPartnerPromoBanner } from "@/components/ForexBrokerPartnerPromoBanner";
import MemeAgentBannerDisplay from "@/components/MemeAgentBannerDisplay";
import MemeTableAnalyzeHint from "@/components/MemeTableAnalyzeHint";
import { GuestRegistrationBanner } from "@/components/GuestRegistrationNudge";
import { TwoFactorSecurityNudgeModal } from "@/components/TwoFactorSecurityNudgeModal";
import { SiteAnnouncementModal } from "@/components/SiteAnnouncementModal";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

type Props = {
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
};

export default function BannersAdminPanel({ onNotice, onError }: Props) {
  const [promo, setPromo] = useState<PromoBannerAdmin | null>(null);
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoDraft, setPromoDraft] = useState({
    headline: "",
    prizeLabel: "",
    drawAtLocal: "",
    bodyText: "",
    ctaLabel: "",
    ctaHref: "",
    showOnDashboard: true,
    showOnRegister: true,
  });

  const [memeAgentBanner, setMemeAgentBanner] = useState<MemeAgentBannerAdmin | null>(null);
  const [memeAgentBannerLoading, setMemeAgentBannerLoading] = useState(true);
  const [memeAgentBannerSaving, setMemeAgentBannerSaving] = useState(false);
  const [memeAgentBannerDraft, setMemeAgentBannerDraft] = useState({
    title: "",
    message: "",
    titleColor: "#f472b6",
    titleSize: "2xl" as MemeAgentTitleSize,
    titleFont: "display" as MemeAgentTitleFont,
  });

  const [memeTableHint, setMemeTableHint] = useState<MemeTableAnalyzeHintBannerAdmin | null>(null);
  const [memeTableHintLoading, setMemeTableHintLoading] = useState(true);
  const [memeTableHintSaving, setMemeTableHintSaving] = useState(false);
  const [memeTableHintDraft, setMemeTableHintDraft] = useState({
    headline: "",
    guestTitle: "",
    guestBody: "",
    freeTitle: "",
    freeBody: "",
    vipTitle: "",
    vipBody: "",
  });

  const [guestNudge, setGuestNudge] = useState<GuestRegistrationNudgeBannerAdmin | null>(null);
  const [guestNudgeLoading, setGuestNudgeLoading] = useState(true);
  const [guestNudgeSaving, setGuestNudgeSaving] = useState(false);
  const [guestNudgeDraft, setGuestNudgeDraft] = useState({
    title: "",
    titleEngaged: "",
    body: "",
    bodyEngaged: "",
  });

  const [twoFactorNudge, setTwoFactorNudge] = useState<TwoFactorSecurityNudgeBannerAdmin | null>(null);
  const [twoFactorNudgeLoading, setTwoFactorNudgeLoading] = useState(true);
  const [twoFactorNudgeSaving, setTwoFactorNudgeSaving] = useState(false);
  const [twoFactorNudgeDraft, setTwoFactorNudgeDraft] = useState({
    title: "",
    body: "",
    ctaLabel: "",
    registerSuccessMessage: "",
  });
  const [twoFactorNudgePreviewOpen, setTwoFactorNudgePreviewOpen] = useState(false);

  const [siteAnnouncement, setSiteAnnouncement] = useState<SiteAnnouncementBannerAdmin | null>(null);
  const [siteAnnouncementLoading, setSiteAnnouncementLoading] = useState(true);
  const [siteAnnouncementSaving, setSiteAnnouncementSaving] = useState(false);
  const [siteAnnouncementDraft, setSiteAnnouncementDraft] = useState({
    title: "",
    body: "",
    ctaLabel: "",
    ctaHref: "",
  });
  const [siteAnnouncementPreviewOpen, setSiteAnnouncementPreviewOpen] = useState(false);

  const [blofinPartner, setBlofinPartner] = useState<BlofinPartnerPromoAdmin | null>(null);
  const [blofinPartnerClicks, setBlofinPartnerClicks] = useState<BlofinPartnerLinkClickRow[]>([]);
  const [blofinPartnerLoading, setBlofinPartnerLoading] = useState(true);
  const [blofinPartnerSaving, setBlofinPartnerSaving] = useState(false);
  const [blofinPartnerDraft, setBlofinPartnerDraft] = useState({
    registerUrl: "",
    headline: "",
    bodyText: "",
    promoLabel: "",
    ctaLabel: "",
    showLogosInBanner: true,
    includeLogosInEmail: true,
    includeLogosInBroadcast: true,
  });

  const [emailStats, setEmailStats] = useState<{
    newsletterCount: number;
    allEmailCount: number;
    newsletterEmails: string[];
    allEmails: string[];
  } | null>(null);
  const [emailStatsLoading, setEmailStatsLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [emailDraft, setEmailDraft] = useState({
    subject: "",
    body: "",
    audience: "newsletter" as "newsletter" | "all",
    includePartnerLogos: false,
    partnerBrand: "blofin" as "blofin" | "vantage" | "tiomarkets",
  });
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailAddInput, setEmailAddInput] = useState("");
  const [emailConfirm, setEmailConfirm] = useState(false);

  const applyMemeAgentDraft = useCallback((b: MemeAgentBannerAdmin) => {
    setMemeAgentBanner(b);
    setMemeAgentBannerDraft({
      title: b.title,
      message: b.message,
      titleColor: b.titleColor,
      titleSize: b.titleSize,
      titleFont: b.titleFont,
    });
  }, []);

  const applyPromoDraft = useCallback((p: PromoBannerAdmin) => {
    setPromo(p);
    setPromoDraft({
      headline: p.headline,
      prizeLabel: p.prizeLabel,
      drawAtLocal: toDatetimeLocalValue(p.drawAt),
      bodyText: p.bodyText ?? "",
      ctaLabel: p.ctaLabel,
      ctaHref: p.ctaHref,
      showOnDashboard: p.showOnDashboard,
      showOnRegister: p.showOnRegister,
    });
  }, []);

  const load = useCallback(() => {
    setPromoLoading(true);
    setMemeAgentBannerLoading(true);
    setMemeTableHintLoading(true);
    setGuestNudgeLoading(true);
    setTwoFactorNudgeLoading(true);
    setSiteAnnouncementLoading(true);
    setBlofinPartnerLoading(true);
    setEmailStatsLoading(true);
    return Promise.all([
      fetch("/api/admin/promo-banner").then((r) => r.json()),
      fetch("/api/admin/meme-agent-banner").then((r) => r.json()),
      fetch("/api/admin/meme-table-analyze-hint").then((r) => r.json()),
      fetch("/api/admin/guest-registration-nudge-banner").then((r) => r.json()),
      fetch("/api/admin/two-factor-security-nudge-banner").then((r) => r.json()),
      fetch("/api/admin/site-announcement-banner").then((r) => r.json()),
      fetch("/api/admin/blofin-partner-promo").then((r) => r.json()),
      fetch("/api/admin/announcement-email").then((r) => r.json()),
    ])
      .then(([promoData, memeBannerData, memeTableHintData, guestNudgeData, twoFactorNudgeData, siteAnnouncementData, blofinPartnerData, emailStatsData]) => {
        if (promoData.success && promoData.promo) {
          applyPromoDraft(promoData.promo as PromoBannerAdmin);
        } else onError?.(promoData.error ?? "Failed to load promo banner.");
        if (memeBannerData.success && memeBannerData.banner) {
          applyMemeAgentDraft(memeBannerData.banner as MemeAgentBannerAdmin);
        } else onError?.(memeBannerData.error ?? "Failed to load Meme Agent banner.");
        if (memeTableHintData.success && memeTableHintData.banner) {
          const b = memeTableHintData.banner as MemeTableAnalyzeHintBannerAdmin;
          setMemeTableHint(b);
          setMemeTableHintDraft({
            headline: b.headline,
            guestTitle: b.guestTitle,
            guestBody: b.guestBody,
            freeTitle: b.freeTitle,
            freeBody: b.freeBody,
            vipTitle: b.vipTitle,
            vipBody: b.vipBody,
          });
        }
        if (guestNudgeData.success && guestNudgeData.banner) {
          const b = guestNudgeData.banner as GuestRegistrationNudgeBannerAdmin;
          setGuestNudge(b);
          setGuestNudgeDraft({
            title: b.title,
            titleEngaged: b.titleEngaged,
            body: b.body,
            bodyEngaged: b.bodyEngaged,
          });
        }
        if (twoFactorNudgeData.success && twoFactorNudgeData.banner) {
          const b = twoFactorNudgeData.banner as TwoFactorSecurityNudgeBannerAdmin;
          setTwoFactorNudge(b);
          setTwoFactorNudgeDraft({
            title: b.title,
            body: b.body,
            ctaLabel: b.ctaLabel,
            registerSuccessMessage: b.registerSuccessMessage,
          });
        }
        if (siteAnnouncementData.success && siteAnnouncementData.banner) {
          const b = siteAnnouncementData.banner as SiteAnnouncementBannerAdmin;
          setSiteAnnouncement(b);
          setSiteAnnouncementDraft({
            title: b.title,
            body: b.body,
            ctaLabel: b.ctaLabel,
            ctaHref: b.ctaHref,
          });
        }
        if (blofinPartnerData.success && blofinPartnerData.promo) {
          const p = blofinPartnerData.promo as BlofinPartnerPromoAdmin;
          setBlofinPartner(p);
          setBlofinPartnerDraft({
            registerUrl: p.registerUrl,
            headline: p.headline,
            bodyText: p.bodyText,
            promoLabel: p.promoLabel,
            ctaLabel: p.ctaLabel,
            showLogosInBanner: p.showLogosInBanner,
            includeLogosInEmail: p.includeLogosInEmail,
            includeLogosInBroadcast: p.includeLogosInBroadcast,
          });
          setBlofinPartnerClicks((blofinPartnerData.clicks ?? []) as BlofinPartnerLinkClickRow[]);
        }
        if (emailStatsData.success && emailStatsData.stats) {
          setEmailStats(
            emailStatsData.stats as {
              newsletterCount: number;
              allEmailCount: number;
              newsletterEmails: string[];
              allEmails: string[];
            }
          );
        }
      })
      .catch(() => onError?.("Failed to load banners."))
      .finally(() => {
        setPromoLoading(false);
        setMemeAgentBannerLoading(false);
        setMemeTableHintLoading(false);
        setGuestNudgeLoading(false);
        setTwoFactorNudgeLoading(false);
        setSiteAnnouncementLoading(false);
        setBlofinPartnerLoading(false);
        setEmailStatsLoading(false);
      });
  }, [applyPromoDraft, applyMemeAgentDraft, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!emailStats) return;
    const list = emailDraft.audience === "newsletter" ? emailStats.newsletterEmails : emailStats.allEmails;
    setEmailRecipients([...list]);
    setEmailConfirm(false);
  }, [emailDraft.audience, emailStats]);

  const reloadEmailRecipientsFromAudience = () => {
    if (!emailStats) return;
    const list = emailDraft.audience === "newsletter" ? emailStats.newsletterEmails : emailStats.allEmails;
    setEmailRecipients([...list]);
    setEmailConfirm(false);
  };

  const addEmailRecipient = () => {
    const v = emailAddInput.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      onError?.("Enter a valid email address.");
      return;
    }
    setEmailRecipients((prev) => (prev.includes(v) ? prev : [...prev, v].sort()));
    setEmailAddInput("");
  };

  const removeEmailRecipient = (email: string) => {
    setEmailRecipients((prev) => prev.filter((e) => e !== email));
    setEmailConfirm(false);
  };

  const patchPromo = async (body: Record<string, unknown>) => {
    setPromoSaving(true);
    try {
      const res = await fetch("/api/admin/promo-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.promo) {
        applyPromoDraft(data.promo as PromoBannerAdmin);
        onNotice?.("Promo banner updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setPromoSaving(false);
    }
  };

  const patchMemeAgentBanner = async (body: Record<string, unknown>) => {
    setMemeAgentBannerSaving(true);
    try {
      const res = await fetch("/api/admin/meme-agent-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.banner) {
        applyMemeAgentDraft(data.banner as MemeAgentBannerAdmin);
        onNotice?.("Meme Agent banner updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setMemeAgentBannerSaving(false);
    }
  };

  const patchMemeTableHint = async (body: Record<string, unknown>) => {
    setMemeTableHintSaving(true);
    try {
      const res = await fetch("/api/admin/meme-table-analyze-hint", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.banner) {
        const b = data.banner as MemeTableAnalyzeHintBannerAdmin;
        setMemeTableHint(b);
        setMemeTableHintDraft({
          headline: b.headline,
          guestTitle: b.guestTitle,
          guestBody: b.guestBody,
          freeTitle: b.freeTitle,
          freeBody: b.freeBody,
          vipTitle: b.vipTitle,
          vipBody: b.vipBody,
        });
        onNotice?.("Meme table hint updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setMemeTableHintSaving(false);
    }
  };

  const patchGuestNudge = async (body: Record<string, unknown>) => {
    setGuestNudgeSaving(true);
    try {
      const res = await fetch("/api/admin/guest-registration-nudge-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.banner) {
        const b = data.banner as GuestRegistrationNudgeBannerAdmin;
        setGuestNudge(b);
        setGuestNudgeDraft({
          title: b.title,
          titleEngaged: b.titleEngaged,
          body: b.body,
          bodyEngaged: b.bodyEngaged,
        });
        onNotice?.("Guest nudge banner updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setGuestNudgeSaving(false);
    }
  };

  const patchTwoFactorNudge = async (body: Record<string, unknown>) => {
    setTwoFactorNudgeSaving(true);
    try {
      const res = await fetch("/api/admin/two-factor-security-nudge-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.banner) {
        const b = data.banner as TwoFactorSecurityNudgeBannerAdmin;
        setTwoFactorNudge(b);
        setTwoFactorNudgeDraft({
          title: b.title,
          body: b.body,
          ctaLabel: b.ctaLabel,
          registerSuccessMessage: b.registerSuccessMessage,
        });
        onNotice?.("2FA security nudge updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setTwoFactorNudgeSaving(false);
    }
  };

  const patchSiteAnnouncement = async (body: Record<string, unknown>) => {
    setSiteAnnouncementSaving(true);
    try {
      const res = await fetch("/api/admin/site-announcement-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.banner) {
        const b = data.banner as SiteAnnouncementBannerAdmin;
        setSiteAnnouncement(b);
        setSiteAnnouncementDraft({
          title: b.title,
          body: b.body,
          ctaLabel: b.ctaLabel,
          ctaHref: b.ctaHref,
        });
        onNotice?.("Site announcement updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setSiteAnnouncementSaving(false);
    }
  };

  const patchBlofinPartner = async (body: Record<string, unknown>) => {
    setBlofinPartnerSaving(true);
    try {
      const res = await fetch("/api/admin/blofin-partner-promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.promo) {
        const p = data.promo as BlofinPartnerPromoAdmin;
        setBlofinPartner(p);
        setBlofinPartnerDraft({
          registerUrl: p.registerUrl,
          headline: p.headline,
          bodyText: p.bodyText,
          promoLabel: p.promoLabel,
          ctaLabel: p.ctaLabel,
          showLogosInBanner: p.showLogosInBanner,
          includeLogosInEmail: p.includeLogosInEmail,
          includeLogosInBroadcast: p.includeLogosInBroadcast,
        });
        if (data.broadcastPublished) {
          void load();
        }
        onNotice?.(
          data.broadcastPublished
            ? "Blofin promo saved and in-app broadcast published."
            : "Blofin partner promo updated."
        );
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setBlofinPartnerSaving(false);
    }
  };

  const sendAnnouncementEmail = async () => {
    if (!emailConfirm) {
      onError?.("Check the confirmation box before sending.");
      return;
    }
    setEmailSending(true);
    try {
      const res = await fetch("/api/admin/announcement-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailDraft.subject,
          body: emailDraft.body,
          audience: emailDraft.audience,
          includePartnerLogos: emailDraft.includePartnerLogos,
          partnerBrand: emailDraft.partnerBrand,
          recipients: emailRecipients,
          confirm: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        const r = data.result as { sent: number; failed: number; total: number };
        onNotice?.(`Email sent to ${r.sent} of ${r.total} recipients${r.failed ? ` (${r.failed} failed)` : ""}.`);
        setEmailConfirm(false);
      } else onError?.(data.error ?? "Send failed.");
    } catch {
      onError?.("Send failed.");
    } finally {
      setEmailSending(false);
    }
  };

  const memeAgentPreview = {
    title: memeAgentBannerDraft.title || memeAgentBanner?.title || "",
    message: memeAgentBannerDraft.message || memeAgentBanner?.message || "",
    titleColor: memeAgentBannerDraft.titleColor,
    titleSize: memeAgentBannerDraft.titleSize,
    titleFont: memeAgentBannerDraft.titleFont,
  };

  const memeTableHintPreview = {
    enabled: true,
    headline: memeTableHintDraft.headline,
    guestTitle: memeTableHintDraft.guestTitle,
    guestBody: memeTableHintDraft.guestBody,
    freeTitle: memeTableHintDraft.freeTitle,
    freeBody: memeTableHintDraft.freeBody,
    vipTitle: memeTableHintDraft.vipTitle,
    vipBody: memeTableHintDraft.vipBody,
  };

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Promo banner</CardTitle>
          <p className="text-sm text-muted-foreground">
            Site-wide giveaway / join-free promo shown to guests on the dashboard and register page.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {promoLoading ? (
            <p className="text-muted-foreground text-sm">Loading promo banner…</p>
          ) : promo ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    promo.active
                      ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {promo.active ? "LIVE on site" : promo.enabled ? "Enabled (draw passed)" : "OFF"}
                  {promo.usesDefault ? " · code default" : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={promo.enabled ? "outline" : "default"}
                    disabled={promoSaving}
                    onClick={() => void patchPromo({ enabled: !promo.enabled })}
                  >
                    {promoSaving ? "…" : promo.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={promoSaving}
                    onClick={() => void patchPromo({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>

              {promo.active && (
                <div className="rounded-lg border border-dashed border-cyan-300/60 dark:border-cyan-700/50 p-1">
                  <PromoBannerDisplay promo={promo} />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Headline
                  <input
                    value={promoDraft.headline}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, headline: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Prize (e.g. 250 USDC)
                  <input
                    value={promoDraft.prizeLabel}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, prizeLabel: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1 sm:col-span-2">
                  Draw date (local) — banner hides automatically after this time
                  <input
                    type="datetime-local"
                    value={promoDraft.drawAtLocal}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, drawAtLocal: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 max-w-xs"
                  />
                  {promo.drawAt && (
                    <span className="text-[11px]">Public: {formatPromoDrawDate(promo.drawAt)}</span>
                  )}
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1 sm:col-span-2">
                  Body text
                  <textarea
                    value={promoDraft.bodyText}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, bodyText: e.target.value }))}
                    rows={2}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Button label
                  <input
                    value={promoDraft.ctaLabel}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Button link
                  <input
                    value={promoDraft.ctaHref}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, ctaHref: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-mono"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoDraft.showOnDashboard}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, showOnDashboard: e.target.checked }))}
                  />
                  Show on dashboard
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoDraft.showOnRegister}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, showOnRegister: e.target.checked }))}
                  />
                  Show on register page
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={promoSaving}
                  onClick={() => {
                    const iso = fromDatetimeLocalValue(promoDraft.drawAtLocal);
                    void patchPromo({
                      headline: promoDraft.headline,
                      prizeLabel: promoDraft.prizeLabel,
                      drawAt: iso,
                      bodyText: promoDraft.bodyText || null,
                      ctaLabel: promoDraft.ctaLabel,
                      ctaHref: promoDraft.ctaHref,
                      showOnDashboard: promoDraft.showOnDashboard,
                      showOnRegister: promoDraft.showOnRegister,
                    });
                  }}
                >
                  {promoSaving ? "Saving…" : "Save promo"}
                </Button>
                <Link
                  href="/promo-terms"
                  target="_blank"
                  className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline self-center"
                >
                  Preview promo terms →
                </Link>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Meme Coins Agent banner</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shown at the top of NovaStaris AI Agent → Meme Coins Agent. Encourages users to run Nova AI Agent before trading on external platforms.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {memeAgentBannerLoading ? (
            <p className="text-muted-foreground text-sm">Loading banner…</p>
          ) : memeAgentBanner ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    memeAgentBanner.enabled
                      ? "bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {memeAgentBanner.enabled ? "ON" : "OFF"}
                  {memeAgentBanner.usesDefault ? " · code default" : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={memeAgentBanner.enabled ? "outline" : "default"}
                    disabled={memeAgentBannerSaving}
                    onClick={() => void patchMemeAgentBanner({ enabled: !memeAgentBanner.enabled })}
                  >
                    {memeAgentBannerSaving ? "…" : memeAgentBanner.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={memeAgentBannerSaving}
                    onClick={() => void patchMemeAgentBanner({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>

              {memeAgentBanner.enabled && (
                <div className="rounded-lg border border-dashed border-violet-300/60 dark:border-violet-700/50 p-2 overflow-visible">
                  <MemeAgentBannerDisplay
                    className="mb-0"
                    title={memeAgentPreview.title}
                    message={memeAgentPreview.message}
                    titleColor={memeAgentPreview.titleColor}
                    titleSize={memeAgentPreview.titleSize}
                    titleFont={memeAgentPreview.titleFont}
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-muted-foreground flex flex-col gap-1 sm:col-span-2">
                  Banner title
                  <input
                    type="text"
                    value={memeAgentBannerDraft.title}
                    onChange={(e) => setMemeAgentBannerDraft((d) => ({ ...d, title: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-semibold"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Title color
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={memeAgentBannerDraft.titleColor}
                      onChange={(e) => setMemeAgentBannerDraft((d) => ({ ...d, titleColor: e.target.value }))}
                      className="h-9 w-12 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                    />
                    <input
                      type="text"
                      value={memeAgentBannerDraft.titleColor}
                      onChange={(e) => setMemeAgentBannerDraft((d) => ({ ...d, titleColor: e.target.value }))}
                      className="flex-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-mono"
                    />
                  </div>
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Title size
                  <select
                    value={memeAgentBannerDraft.titleSize}
                    onChange={(e) =>
                      setMemeAgentBannerDraft((d) => ({ ...d, titleSize: e.target.value as MemeAgentTitleSize }))
                    }
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  >
                    {MEME_AGENT_TITLE_SIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Title font
                  <select
                    value={memeAgentBannerDraft.titleFont}
                    onChange={(e) =>
                      setMemeAgentBannerDraft((d) => ({ ...d, titleFont: e.target.value as MemeAgentTitleFont }))
                    }
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  >
                    {MEME_AGENT_TITLE_FONT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Banner message
                <textarea
                  value={memeAgentBannerDraft.message}
                  onChange={(e) => setMemeAgentBannerDraft((d) => ({ ...d, message: e.target.value }))}
                  rows={3}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 leading-relaxed"
                />
              </label>

              <Button
                size="sm"
                disabled={memeAgentBannerSaving}
                onClick={() =>
                  void patchMemeAgentBanner({
                    title: memeAgentBannerDraft.title,
                    message: memeAgentBannerDraft.message,
                    titleColor: memeAgentBannerDraft.titleColor,
                    titleSize: memeAgentBannerDraft.titleSize,
                    titleFont: memeAgentBannerDraft.titleFont,
                  })
                }
              >
                {memeAgentBannerSaving ? "Saving…" : "Save banner"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Meme table analyze hint</CardTitle>
          <p className="text-sm text-muted-foreground">
            Purple dismissible hint above Go Hunting meme coin tables. Separate copy for guest, free, and VIP users.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {memeTableHintLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : memeTableHint ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    memeTableHint.enabled
                      ? "bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {memeTableHint.enabled ? "ON" : "OFF"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={memeTableHint.enabled ? "outline" : "default"}
                    disabled={memeTableHintSaving}
                    onClick={() => void patchMemeTableHint({ enabled: !memeTableHint.enabled })}
                  >
                    {memeTableHintSaving ? "…" : memeTableHint.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={memeTableHintSaving}
                    onClick={() => void patchMemeTableHint({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>
              {memeTableHint.enabled && (
                <div className="rounded-lg border border-dashed border-violet-300/60 dark:border-violet-700/50 p-1 bg-zinc-950">
                  <MemeTableAnalyzeHint tier="vip" config={memeTableHintPreview} preview className="mx-0 mb-0" />
                </div>
              )}
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Headline (shared — e.g. Don&apos;t Get Rugged)
                <input
                  value={memeTableHintDraft.headline}
                  onChange={(e) => setMemeTableHintDraft((d) => ({ ...d, headline: e.target.value }))}
                  placeholder="Leave blank to hide headline"
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-semibold"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["guest", "free", "vip"] as const).map((tier) => (
                  <div key={tier} className="space-y-2 rounded-md border border-zinc-200 dark:border-zinc-700 p-3 sm:col-span-2 lg:col-span-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tier} copy</p>
                    <label className="text-xs text-muted-foreground flex flex-col gap-1">
                      Title
                      <input
                        value={memeTableHintDraft[`${tier}Title` as keyof typeof memeTableHintDraft]}
                        onChange={(e) =>
                          setMemeTableHintDraft((d) => ({ ...d, [`${tier}Title`]: e.target.value }))
                        }
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground flex flex-col gap-1">
                      Body
                      <textarea
                        rows={2}
                        value={memeTableHintDraft[`${tier}Body` as keyof typeof memeTableHintDraft]}
                        onChange={(e) =>
                          setMemeTableHintDraft((d) => ({ ...d, [`${tier}Body`]: e.target.value }))
                        }
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                      />
                    </label>
                  </div>
                ))}
              </div>
              <Button size="sm" disabled={memeTableHintSaving} onClick={() => void patchMemeTableHint(memeTableHintDraft)}>
                {memeTableHintSaving ? "Saving…" : "Save meme table hint"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Guest registration nudge</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cyan sign-up banner for guests on the dashboard. Uses the engaged copy after they explore multiple tabs.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {guestNudgeLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : guestNudge ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    guestNudge.enabled
                      ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {guestNudge.enabled ? "ON" : "OFF"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={guestNudge.enabled ? "outline" : "default"}
                    disabled={guestNudgeSaving}
                    onClick={() => void patchGuestNudge({ enabled: !guestNudge.enabled })}
                  >
                    {guestNudgeSaving ? "…" : guestNudge.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={guestNudgeSaving}
                    onClick={() => void patchGuestNudge({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>
              {guestNudge.enabled && (
                <div className="rounded-lg border border-dashed border-cyan-300/60 dark:border-cyan-700/50 p-1">
                  <GuestRegistrationBanner
                    engaged={false}
                    config={{ enabled: true, ...guestNudgeDraft }}
                    onDismiss={() => {}}
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Default title
                  <input
                    value={guestNudgeDraft.title}
                    onChange={(e) => setGuestNudgeDraft((d) => ({ ...d, title: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Engaged title
                  <input
                    value={guestNudgeDraft.titleEngaged}
                    onChange={(e) => setGuestNudgeDraft((d) => ({ ...d, titleEngaged: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1 sm:col-span-2">
                  Default body
                  <textarea
                    rows={2}
                    value={guestNudgeDraft.body}
                    onChange={(e) => setGuestNudgeDraft((d) => ({ ...d, body: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1 sm:col-span-2">
                  Engaged body
                  <textarea
                    rows={2}
                    value={guestNudgeDraft.bodyEngaged}
                    onChange={(e) => setGuestNudgeDraft((d) => ({ ...d, bodyEngaged: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
              </div>
              <Button size="sm" disabled={guestNudgeSaving} onClick={() => void patchGuestNudge(guestNudgeDraft)}>
                {guestNudgeSaving ? "Saving…" : "Save guest nudge"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-cyan-200/80 dark:border-cyan-900/60">
        <CardHeader>
          <CardTitle className="text-base">Blofin partner promo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shown on Trading Bot, NovaScalper, Prop Firm, and NovaRadar when enabled and a register URL is set. Off by default until you paste your NovaStaris / Blofin register link.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {blofinPartnerLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : blofinPartner ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    blofinPartner.active
                      ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {blofinPartner.active ? "LIVE on bot screens" : blofinPartner.enabled ? "ON (needs URL)" : "OFF"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={blofinPartner.enabled ? "outline" : "default"}
                    disabled={blofinPartnerSaving}
                    onClick={() => void patchBlofinPartner({ enabled: !blofinPartner.enabled })}
                  >
                    {blofinPartnerSaving ? "…" : blofinPartner.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={blofinPartnerSaving}
                    onClick={() =>
                      void patchBlofinPartner({
                        ...blofinPartnerDraft,
                        enabled: true,
                        publishLaunchBroadcast: true,
                      })
                    }
                  >
                    Save + publish in-app broadcast
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={blofinPartnerSaving}
                    onClick={() => void patchBlofinPartner({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                NovaStaris / Blofin register URL
                <input
                  value={blofinPartnerDraft.registerUrl}
                  onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, registerUrl: e.target.value }))}
                  placeholder="https://blofin.com/register?referral_code=wAwpn7"
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Headline
                <input
                  value={blofinPartnerDraft.headline}
                  onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, headline: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Body
                <textarea
                  rows={3}
                  value={blofinPartnerDraft.bodyText}
                  onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, bodyText: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Promo badge (e.g. 10% cashback on trading fees)
                  <input
                    value={blofinPartnerDraft.promoLabel}
                    onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, promoLabel: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  CTA label
                  <input
                    value={blofinPartnerDraft.ctaLabel}
                    onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <label className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={blofinPartnerDraft.showLogosInBanner}
                    onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, showLogosInBanner: e.target.checked }))}
                  />
                  Logos on bot banner
                </label>
                <label className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={blofinPartnerDraft.includeLogosInEmail}
                    onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, includeLogosInEmail: e.target.checked }))}
                  />
                  Logos in email
                </label>
                <label className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={blofinPartnerDraft.includeLogosInBroadcast}
                    onChange={(e) => setBlofinPartnerDraft((d) => ({ ...d, includeLogosInBroadcast: e.target.checked }))}
                  />
                  Logos in broadcast
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={blofinPartnerSaving}
                  onClick={() => void patchBlofinPartner({ ...blofinPartnerDraft, enabled: blofinPartner.enabled })}
                >
                  {blofinPartnerSaving ? "Saving…" : "Save Blofin promo"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEmailDraft({
                      subject: BLOFIN_PARTNERSHIP_EMAIL.subject,
                      body: BLOFIN_PARTNERSHIP_EMAIL.body,
                      audience: "all",
                      includePartnerLogos: blofinPartnerDraft.includeLogosInEmail,
                      partnerBrand: "blofin",
                    });
                  }}
                >
                  Load email template
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Register link clicks tracked: {blofinPartner.registerClickCount}. Blofin does not expose confirmed signups via API — use your Blofin affiliate dashboard for conversions; this list is NovaStaris link clicks only.
              </p>
              {blofinPartnerClicks.length > 0 && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-muted-foreground">
                        <th className="p-2">When</th>
                        <th className="p-2">User</th>
                        <th className="p-2">Guest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blofinPartnerClicks.slice(0, 20).map((c) => (
                        <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="p-2 whitespace-nowrap">{new Date(c.clickedAt).toLocaleString()}</td>
                          <td className="p-2">{c.userEmail ?? "—"}</td>
                          <td className="p-2 font-mono text-[10px]">{c.guestHash ? c.guestHash.slice(0, 8) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {blofinPartner && (
                <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-3">
                  <p className="text-xs text-muted-foreground mb-2">Customer preview (logos {blofinPartnerDraft.showLogosInBanner ? "on" : "off"})</p>
                  <BlofinPartnerPromoBanner
                    preview={{
                      active: true,
                      headline: blofinPartnerDraft.headline,
                      bodyText: blofinPartnerDraft.bodyText,
                      promoLabel: blofinPartnerDraft.promoLabel,
                      ctaLabel: blofinPartnerDraft.ctaLabel,
                      showLogosInBanner: blofinPartnerDraft.showLogosInBanner,
                    }}
                  />
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <ForexBrokerPartnerSection
        broker="vantage"
        onLoadEmailTemplate={(subject, body, includeLogos) =>
          setEmailDraft({
            subject,
            body,
            audience: "all",
            includePartnerLogos: includeLogos,
            partnerBrand: "vantage",
          })
        }
      />
      <ForexBrokerPartnerSection
        broker="tiomarkets"
        onLoadEmailTemplate={(subject, body, includeLogos) =>
          setEmailDraft({
            subject,
            body,
            audience: "all",
            includePartnerLogos: includeLogos,
            partnerBrand: "tiomarkets",
          })
        }
      />

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Site announcement (in-app)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Centered modal for signed-in users on the dashboard (~2s after login). Saving changes re-shows it for users who
            dismissed an older version.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {siteAnnouncementLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : siteAnnouncement ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    siteAnnouncement.enabled
                      ? "bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {siteAnnouncement.enabled ? "ON" : "OFF"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={siteAnnouncement.enabled ? "outline" : "default"}
                    disabled={siteAnnouncementSaving}
                    onClick={() => void patchSiteAnnouncement({ enabled: !siteAnnouncement.enabled })}
                  >
                    {siteAnnouncementSaving ? "…" : siteAnnouncement.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={siteAnnouncementSaving}
                    onClick={() => void patchSiteAnnouncement({ preset: "affiliate-launch" })}
                  >
                    Publish affiliate launch
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={siteAnnouncementSaving}
                    onClick={() => void patchSiteAnnouncement({ preset: "blofin-partnership" })}
                  >
                    Publish Blofin partnership
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={siteAnnouncementSaving}
                    onClick={() => setSiteAnnouncementPreviewOpen(true)}
                  >
                    Preview modal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={siteAnnouncementSaving}
                    onClick={() => void patchSiteAnnouncement({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Title
                <input
                  value={siteAnnouncementDraft.title}
                  onChange={(e) => setSiteAnnouncementDraft((d) => ({ ...d, title: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Body
                <textarea
                  rows={4}
                  value={siteAnnouncementDraft.body}
                  onChange={(e) => setSiteAnnouncementDraft((d) => ({ ...d, body: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  CTA label (optional)
                  <input
                    value={siteAnnouncementDraft.ctaLabel}
                    onChange={(e) => setSiteAnnouncementDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                    placeholder="e.g. View account"
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  CTA link (optional)
                  <input
                    value={siteAnnouncementDraft.ctaHref}
                    onChange={(e) => setSiteAnnouncementDraft((d) => ({ ...d, ctaHref: e.target.value }))}
                    placeholder="/account or https://…"
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                  />
                </label>
              </div>
              <Button
                size="sm"
                disabled={siteAnnouncementSaving}
                onClick={() => void patchSiteAnnouncement(siteAnnouncementDraft)}
              >
                {siteAnnouncementSaving ? "Saving…" : "Save site announcement"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Email announcement</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send a one-time email via Resend. Prefer <strong>newsletter subscribers</strong> for marketing; use all
            customers only for important account notices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailStatsLoading ? (
            <p className="text-muted-foreground text-sm">Loading audience counts…</p>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <strong>{emailStats?.newsletterCount ?? 0}</strong> newsletter subscribers ·{" "}
              <strong>{emailStats?.allEmailCount ?? 0}</strong> customers with email (
              <Link href="/admin/customers" className="text-violet-600 dark:text-violet-400 underline">
                view in Customers
              </Link>
              )
            </p>
          )}
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Audience
            <select
              value={emailDraft.audience}
              onChange={(e) => setEmailDraft((d) => ({ ...d, audience: e.target.value as "newsletter" | "all" }))}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 max-w-xs"
            >
              <option value="newsletter">Newsletter subscribers only (recommended)</option>
              <option value="all">All customers with email</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={emailDraft.includePartnerLogos}
              onChange={(e) => setEmailDraft((d) => ({ ...d, includePartnerLogos: e.target.checked }))}
            />
            Include NovaStaris × partner logos at top of email
          </label>
          {emailDraft.includePartnerLogos && (
            <label className="text-xs text-muted-foreground flex flex-col gap-1 min-w-[180px]">
              Partner logo
              <select
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                value={emailDraft.partnerBrand}
                onChange={(e) =>
                  setEmailDraft((d) => ({
                    ...d,
                    partnerBrand: e.target.value as "blofin" | "vantage" | "tiomarkets",
                  }))
                }
              >
                <option value="blofin">Blofin</option>
                <option value="vantage">Vantage Markets</option>
                <option value="tiomarkets">TIOmarkets</option>
              </select>
            </label>
          )}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Recipients ({emailRecipients.length}) — edit before sending
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={reloadEmailRecipientsFromAudience}>
                Reset list from audience
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-zinc-50/80 dark:bg-zinc-900/50">
              {emailRecipients.length === 0 ? (
                <span className="text-xs text-muted-foreground">No recipients — add an email below to test.</span>
              ) : (
                emailRecipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 px-2 py-0.5 text-xs"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmailRecipient(email)}
                      className="rounded-full hover:bg-violet-200/80 dark:hover:bg-violet-800/60 px-1"
                      aria-label={`Remove ${email}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={emailAddInput}
                onChange={(e) => setEmailAddInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmailRecipient();
                  }
                }}
                placeholder="Add test email…"
                className="flex-1 min-w-[12rem] text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              />
              <Button type="button" size="sm" variant="outline" onClick={addEmailRecipient}>
                Add email
              </Button>
            </div>
          </div>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Subject
            <input
              value={emailDraft.subject}
              onChange={(e) => setEmailDraft((d) => ({ ...d, subject: e.target.value }))}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Message
            <textarea
              rows={5}
              value={emailDraft.body}
              onChange={(e) => setEmailDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Plain text. Line breaks are preserved in the email."
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.checked)}
              className="mt-1"
            />
            <span>
              I confirm sending to <strong>{emailRecipients.length}</strong> recipient
              {emailRecipients.length === 1 ? "" : "s"}. This cannot be undone.
            </span>
          </label>
          <Button
            size="sm"
            variant="destructive"
            disabled={
              emailSending ||
              !emailDraft.subject.trim() ||
              !emailDraft.body.trim() ||
              emailRecipients.length === 0
            }
            onClick={() => void sendAnnouncementEmail()}
          >
            {emailSending ? "Sending…" : "Send email announcement"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">2FA security nudge</CardTitle>
          <p className="text-sm text-muted-foreground">
            Centered modal shown after sign-in for email/password users who have not enabled 2FA. Also sets the
            registration success message on the sign-up page.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFactorNudgeLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : twoFactorNudge ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    twoFactorNudge.enabled
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {twoFactorNudge.enabled ? "ON" : "OFF"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={twoFactorNudge.enabled ? "outline" : "default"}
                    disabled={twoFactorNudgeSaving}
                    onClick={() => void patchTwoFactorNudge({ enabled: !twoFactorNudge.enabled })}
                  >
                    {twoFactorNudgeSaving ? "…" : twoFactorNudge.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={twoFactorNudgeSaving}
                    onClick={() => setTwoFactorNudgePreviewOpen(true)}
                  >
                    Preview modal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={twoFactorNudgeSaving}
                    onClick={() => void patchTwoFactorNudge({ resetToDefault: true })}
                  >
                    Reset defaults
                  </Button>
                </div>
              </div>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Modal title
                <input
                  value={twoFactorNudgeDraft.title}
                  onChange={(e) => setTwoFactorNudgeDraft((d) => ({ ...d, title: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Modal body
                <textarea
                  rows={3}
                  value={twoFactorNudgeDraft.body}
                  onChange={(e) => setTwoFactorNudgeDraft((d) => ({ ...d, body: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                CTA button label
                <input
                  value={twoFactorNudgeDraft.ctaLabel}
                  onChange={(e) => setTwoFactorNudgeDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Registration success message
                <textarea
                  rows={2}
                  value={twoFactorNudgeDraft.registerSuccessMessage}
                  onChange={(e) => setTwoFactorNudgeDraft((d) => ({ ...d, registerSuccessMessage: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <Button size="sm" disabled={twoFactorNudgeSaving} onClick={() => void patchTwoFactorNudge(twoFactorNudgeDraft)}>
                {twoFactorNudgeSaving ? "Saving…" : "Save 2FA nudge"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <TwoFactorSecurityNudgeModal
        open={twoFactorNudgePreviewOpen}
        config={twoFactorNudgeDraft}
        onRemindLater={() => setTwoFactorNudgePreviewOpen(false)}
        onDismissPermanent={() => setTwoFactorNudgePreviewOpen(false)}
      />
      {siteAnnouncement && (
        <SiteAnnouncementModal
          open={siteAnnouncementPreviewOpen}
          banner={{ ...siteAnnouncement, ...siteAnnouncementDraft, enabled: true }}
          onRemindLater={() => setSiteAnnouncementPreviewOpen(false)}
          onDismissPermanent={() => setSiteAnnouncementPreviewOpen(false)}
        />
      )}
    </div>
  );
}

/** Compact Vantage / TIOmarkets partner promo section — mirrors the Blofin card above. */
function ForexBrokerPartnerSection({
  broker,
  onLoadEmailTemplate,
}: {
  broker: ForexBrokerId;
  onLoadEmailTemplate: (subject: string, body: string, includeLogos: boolean) => void;
}) {
  const label = forexBrokerLabel(broker);
  const [promo, setPromo] = useState<ForexBrokerPartnerPromoAdmin | null>(null);
  const [clicks, setClicks] = useState<ForexBrokerPartnerLinkClickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    registerUrl: "",
    headline: "",
    bodyText: "",
    promoLabel: "",
    ctaLabel: "",
    showLogosInBanner: true,
    includeLogosInEmail: true,
    includeLogosInBroadcast: true,
  });

  const applyDraft = useCallback((p: ForexBrokerPartnerPromoAdmin) => {
    setPromo(p);
    setDraft({
      registerUrl: p.registerUrl,
      headline: p.headline,
      bodyText: p.bodyText,
      promoLabel: p.promoLabel,
      ctaLabel: p.ctaLabel,
      showLogosInBanner: p.showLogosInBanner,
      includeLogosInEmail: p.includeLogosInEmail,
      includeLogosInBroadcast: p.includeLogosInBroadcast,
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    return fetch(`/api/admin/forex-broker-partner-promo?broker=${broker}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.promo) applyDraft(data.promo as ForexBrokerPartnerPromoAdmin);
        setClicks((data.clicks ?? []) as ForexBrokerPartnerLinkClickRow[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [broker, applyDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/forex-broker-partner-promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker, ...body }),
      });
      const data = await res.json();
      if (data.success && data.promo) {
        applyDraft(data.promo as ForexBrokerPartnerPromoAdmin);
        if (data.broadcastPublished) void load();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-emerald-200/80 dark:border-emerald-900/60">
      <CardHeader>
        <CardTitle className="text-base">{label} partner promo</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shown on Nova Forex Bot / Scalper connect panels when enabled and a register URL is set. Off by default until
          you paste your NovaStaris / {label} referral link.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : promo ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  promo.active
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                }`}
              >
                {promo.active ? "LIVE on Nova Forex" : promo.enabled ? "ON (needs URL)" : "OFF"}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={promo.enabled ? "outline" : "default"} disabled={saving} onClick={() => void patch({ enabled: !promo.enabled })}>
                  {saving ? "…" : promo.enabled ? "Turn off" : "Turn on"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void patch({ ...draft, enabled: true, publishLaunchBroadcast: true })}
                >
                  Save + publish in-app broadcast
                </Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void patch({ resetToDefault: true })}>
                  Reset defaults
                </Button>
              </div>
            </div>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              NovaStaris / {label} register URL
              <input
                value={draft.registerUrl}
                onChange={(e) => setDraft((d) => ({ ...d, registerUrl: e.target.value }))}
                placeholder={`https://${broker}.com/register?ref=novastaris`}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Headline
              <input
                value={draft.headline}
                onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Body
              <textarea
                rows={3}
                value={draft.bodyText}
                onChange={(e) => setDraft((d) => ({ ...d, bodyText: e.target.value }))}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Promo badge
                <input
                  value={draft.promoLabel}
                  onChange={(e) => setDraft((d) => ({ ...d, promoLabel: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                CTA label
                <input
                  value={draft.ctaLabel}
                  onChange={(e) => setDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <label className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                <input
                  type="checkbox"
                  checked={draft.showLogosInBanner}
                  onChange={(e) => setDraft((d) => ({ ...d, showLogosInBanner: e.target.checked }))}
                />
                Logos on connect panel
              </label>
              <label className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                <input
                  type="checkbox"
                  checked={draft.includeLogosInEmail}
                  onChange={(e) => setDraft((d) => ({ ...d, includeLogosInEmail: e.target.checked }))}
                />
                Logos in email
              </label>
              <label className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                <input
                  type="checkbox"
                  checked={draft.includeLogosInBroadcast}
                  onChange={(e) => setDraft((d) => ({ ...d, includeLogosInBroadcast: e.target.checked }))}
                />
                Logos in broadcast
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={saving} onClick={() => void patch({ ...draft, enabled: promo.enabled })}>
                {saving ? "Saving…" : `Save ${label} promo`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onLoadEmailTemplate(
                    FOREX_PARTNERSHIP_EMAIL[broker].subject,
                    FOREX_PARTNERSHIP_EMAIL[broker].body,
                    draft.includeLogosInEmail
                  )
                }
              >
                Load email template
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Register link clicks tracked: {promo.registerClickCount}. {label} does not expose confirmed signups via
              API — use your {label} affiliate dashboard for conversions; this list is NovaStaris link clicks only.
            </p>
            {clicks.length > 0 && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-muted-foreground">
                      <th className="p-2">When</th>
                      <th className="p-2">User</th>
                      <th className="p-2">Guest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clicks.slice(0, 20).map((c) => (
                      <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="p-2 whitespace-nowrap">{new Date(c.clickedAt).toLocaleString()}</td>
                        <td className="p-2">{c.userEmail ?? "—"}</td>
                        <td className="p-2 font-mono text-[10px]">{c.guestHash ? c.guestHash.slice(0, 8) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Customer preview (logos {draft.showLogosInBanner ? "on" : "off"})
              </p>
              <ForexBrokerPartnerPromoBanner
                broker={broker}
                preview={{
                  active: true,
                  headline: draft.headline,
                  bodyText: draft.bodyText,
                  promoLabel: draft.promoLabel,
                  ctaLabel: draft.ctaLabel,
                  showLogosInBanner: draft.showLogosInBanner,
                }}
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
