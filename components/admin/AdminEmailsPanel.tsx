"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ADMIN_EMAIL_PRESETS,
  formatPlainShareText,
  getAdminEmailPreset,
  type AdminEmailFormat,
  type AdminEmailPresetId,
} from "@/lib/admin-email-presets";
import { buildStrategyCallEmail } from "@/lib/strategy-call";
import { buildVipTrialInviteEmail } from "@/lib/vip-trial";
import type { AnnouncementEmailTemplate } from "@/lib/announcement-email";
import type { PartnerBrandEmail } from "@/lib/partner-logos-email";
import { ADMIN_EMAIL_DRAFT_STORAGE_KEY } from "@/lib/paid-strategy-call";
import {
  buildPnlCalculatorShareCaption,
  downloadPnlCalculatorPostcard,
  drawPnlCalculatorPostcard,
} from "@/lib/pnl-calculator-share-image";
import { sharePnlWithFallback } from "@/lib/pnl-share";

type RecentRegistrant = {
  email: string;
  name: string | null;
  createdAt: string;
  newsletterOptIn: boolean;
};

type EmailStats = {
  newsletterCount: number;
  allEmailCount: number;
  newsletterEmails: string[];
  allEmails: string[];
  recentRegistrants: RecentRegistrant[];
  freeEmails?: string[];
  vipEmails?: string[];
  inactive7dEmails?: string[];
  trialEmails?: string[];
  trialExpiringEmails?: string[];
  freeCount?: number;
  vipCount?: number;
  inactive7dCount?: number;
  trialCount?: number;
  trialExpiringCount?: number;
};

type CampaignRow = {
  id: string;
  subject: string;
  template: string;
  format: string;
  audience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  partnerBrand: string | null;
  createdAt: string;
};

type WelcomeLogRow = {
  id: string;
  email: string;
  userId: string | null;
  success: boolean;
  error: string | null;
  source: string;
  createdAt: string;
};

type AudienceMode = "newsletter" | "all" | "new" | "free" | "vip" | "inactive7d" | "trial" | "trial-expiring";

type Props = {
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
};

const inputClass =
  "text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800";

const NEW_WINDOW_OPTIONS = [
  { days: 1, label: "Last 24 hours" },
  { days: 3, label: "Last 3 days" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
] as const;

function registrantEmailsInWindow(list: RecentRegistrant[], days: number): RecentRegistrant[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return list.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}

export default function AdminEmailsPanel({ onNotice, onError }: Props) {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [welcomeLogs, setWelcomeLogs] = useState<WelcomeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [addInput, setAddInput] = useState("");
  const [format, setFormat] = useState<AdminEmailFormat>("rich");
  const [presetId, setPresetId] = useState<AdminEmailPresetId>("custom");
  const [newWindowDays, setNewWindowDays] = useState(1);
  const [selectedNewEmails, setSelectedNewEmails] = useState<Set<string>>(new Set());
  const [recipientsLocked, setRecipientsLocked] = useState(false);
  const [draft, setDraft] = useState({
    subject: "",
    body: "",
    audience: "newsletter" as AudienceMode,
    includePartnerLogos: false,
    partnerBrand: "tiomarkets" as PartnerBrandEmail,
    template: "default" as AnnouncementEmailTemplate,
    ctaLabel: "",
    ctaUrl: "",
  });
  const [strategyCallUrl, setStrategyCallUrl] = useState("");
  const [strategyCallEnabled, setStrategyCallEnabled] = useState(false);
  const [strategyCallShowNav, setStrategyCallShowNav] = useState(true);
  const [strategyCallShowPopup, setStrategyCallShowPopup] = useState(true);
  const [postcardBusy, setPostcardBusy] = useState(false);
  const [strategyCallSaving, setStrategyCallSaving] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcement-email", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success && data.stats) {
        const s = data.stats as EmailStats;
        setStats({
          ...s,
          recentRegistrants: Array.isArray(s.recentRegistrants) ? s.recentRegistrants : [],
          freeEmails: Array.isArray(s.freeEmails) ? s.freeEmails : [],
          vipEmails: Array.isArray(s.vipEmails) ? s.vipEmails : [],
          inactive7dEmails: Array.isArray(s.inactive7dEmails) ? s.inactive7dEmails : [],
          trialEmails: Array.isArray(s.trialEmails) ? s.trialEmails : [],
          trialExpiringEmails: Array.isArray(s.trialExpiringEmails) ? s.trialExpiringEmails : [],
          freeCount: s.freeCount,
          vipCount: s.vipCount,
          inactive7dCount: s.inactive7dCount,
          trialCount: s.trialCount,
          trialExpiringCount: s.trialExpiringCount,
        });
        setCampaigns(Array.isArray(data.campaigns) ? (data.campaigns as CampaignRow[]) : []);
        setWelcomeLogs(Array.isArray(data.welcomeLogs) ? (data.welcomeLogs as WelcomeLogRow[]) : []);
      } else {
        onError?.(data.error || "Could not load email stats.");
      }
    } catch {
      onError?.("Could not load email stats.");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/strategy-call", { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.success && data.config) {
          setStrategyCallUrl(String(data.config.bookingUrl ?? ""));
          setStrategyCallEnabled(!!data.config.enabled);
          setStrategyCallShowNav(data.config.showNavButton !== false);
          setStrategyCallShowPopup(data.config.showOncePopup !== false);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const saveStrategyCall = useCallback(async () => {
    setStrategyCallSaving(true);
    try {
      const res = await fetch("/api/admin/strategy-call", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: strategyCallEnabled,
          bookingUrl: strategyCallUrl,
          showNavButton: strategyCallShowNav,
          showOncePopup: strategyCallShowPopup,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setStrategyCallUrl(String(data.config.bookingUrl ?? ""));
        setStrategyCallEnabled(!!data.config.enabled);
        setStrategyCallShowNav(data.config.showNavButton !== false);
        setStrategyCallShowPopup(data.config.showOncePopup !== false);
        onNotice?.(
          data.config.enabled
            ? "Discovery call settings saved."
            : "Discovery call disabled (nav, popup, and page promo off)."
        );
      } else {
        onError?.(data.error || "Could not save Discovery call link.");
      }
    } catch {
      onError?.("Could not save Discovery call link.");
    } finally {
      setStrategyCallSaving(false);
    }
  }, [strategyCallEnabled, strategyCallUrl, strategyCallShowNav, strategyCallShowPopup, onNotice, onError]);

  const windowedNew = useMemo(
    () => registrantEmailsInWindow(stats?.recentRegistrants ?? [], newWindowDays),
    [stats?.recentRegistrants, newWindowDays]
  );

  const applyPreset = useCallback(
    async (id: AdminEmailPresetId) => {
      setPresetId(id);
      if (id === "strategy-call") {
        const url = strategyCallUrl.trim();
        const built = buildStrategyCallEmail(url);
        setDraft({
          subject: built.subject,
          body: built.body,
          audience: "free",
          includePartnerLogos: false,
          partnerBrand: "blofin",
          template: "nova-branded",
          ctaLabel: built.ctaLabel,
          ctaUrl: built.ctaUrl,
        });
        return;
      }
      if (id === "vip-trial-invite") {
        try {
          const res = await fetch("/api/admin/vip-trial", { credentials: "include", cache: "no-store" });
          const data = await res.json();
          const cfg = data?.config as
            | {
                trialDays?: number;
                reminderHoursBefore?: number;
                planIdAfterTrial?: string;
              }
            | undefined;
          const trialDays = Math.max(1, Number(cfg?.trialDays) || 3);
          const reminderHoursBefore = Math.max(6, Number(cfg?.reminderHoursBefore) || 24);
          const planId = typeof cfg?.planIdAfterTrial === "string" ? cfg.planIdAfterTrial : "1month";
          const plan =
            planId === "6month"
              ? { label: "6 months", priceUsd: 750 }
              : planId === "12month"
                ? { label: "12 months", priceUsd: 1500 }
                : { label: "1 month", priceUsd: 150 };
          const built = buildVipTrialInviteEmail({
            trialDays,
            reminderHoursBefore,
            planLabel: plan.label,
            planPriceUsd: plan.priceUsd,
          });
          setDraft({
            subject: built.subject,
            body: built.body,
            audience: "free",
            includePartnerLogos: false,
            partnerBrand: "blofin",
            template: "nova-branded",
            ctaLabel: built.ctaLabel,
            ctaUrl: built.ctaUrl,
          });
          return;
        } catch {
          /* fall through to static preset */
        }
      }
      const p = getAdminEmailPreset(id);
      if (!p) return;
      if (p.template === "why-traders") setFormat("rich");
      if (p.template === "futures-morning-brief") {
        setFormat("rich");
        // Prefer today's stored Daily Wrap (same content cron / Publish today builds)
        try {
          const wrapRes = await fetch("/api/futures/daily-wrap", {
            credentials: "include",
            cache: "no-store",
          });
          const wrapData = await wrapRes.json().catch(() => ({}));
          const wrap = wrapData?.wrap as
            | {
                title?: string;
                emailTeaser?: { text: string; highlights?: string[] }[];
                hotTopics?: { text: string; highlights?: string[] }[];
              }
            | null
            | undefined;
          if (wrapRes.ok && wrap) {
            const { morningFuturesBriefPlainBody, morningFuturesBriefSubject } = await import(
              "@/lib/futures-daily-wrap-email"
            );
            const { FUTURES_WRAP_APP_URL } = await import("@/lib/futures-daily-wrap");
            const teaser =
              Array.isArray(wrap.emailTeaser) && wrap.emailTeaser.length > 0
                ? wrap.emailTeaser
                : Array.isArray(wrap.hotTopics)
                  ? wrap.hotTopics.slice(0, 3)
                  : [];
            if (teaser.length > 0) {
              setDraft({
                subject: morningFuturesBriefSubject(wrap.title || "Daily Market Wrap"),
                body: morningFuturesBriefPlainBody(
                  teaser.map((t, i) => ({
                    id: `wrap-${i}`,
                    text: t.text,
                    highlights: t.highlights ?? [],
                  }))
                ),
                audience: p.defaultAudience ?? "newsletter",
                includePartnerLogos: false,
                partnerBrand: "blofin",
                template: "futures-morning-brief",
                ctaLabel: p.ctaLabel,
                ctaUrl: FUTURES_WRAP_APP_URL,
              });
              onNotice?.(
                "Loaded today’s Daily Wrap into the Daily Futures Brief. Edit if needed, then send."
              );
              return;
            }
          }
          onNotice?.(
            "No Daily Wrap stored yet — showing sample brief. Publish today under Crypto Futures → Daily Wrap (or wait for the wrap cron), then reload this preset."
          );
        } catch {
          onNotice?.("Could not load Daily Wrap — using sample Daily Futures Brief.");
        }
      }
      setDraft({
        subject: p.subject,
        body: p.body,
        audience: p.defaultAudience ?? "newsletter",
        includePartnerLogos: p.includePartnerLogos,
        partnerBrand: p.partnerBrand,
        template: p.template,
        ctaLabel: p.ctaLabel,
        ctaUrl: p.ctaUrl,
      });
      if (p.defaultAudience === "new") {
        setNewWindowDays(id.startsWith("deepdive-") || id === "vip-soft-pitch" ? 7 : 1);
      }
    },
    [strategyCallUrl]
  );

  useEffect(() => {
    const preset = searchParams.get("preset") as AdminEmailPresetId | null;
    if (preset && getAdminEmailPreset(preset)) {
      applyPreset(preset);
    }
    try {
      const raw = sessionStorage.getItem(ADMIN_EMAIL_DRAFT_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(ADMIN_EMAIL_DRAFT_STORAGE_KEY);
      const d = JSON.parse(raw) as {
        subject?: string;
        body?: string;
        recipients?: string[];
        template?: AnnouncementEmailTemplate;
        presetId?: AdminEmailPresetId;
      };
      if (d.presetId) setPresetId(d.presetId);
      setDraft((prev) => ({
        ...prev,
        subject: d.subject ?? prev.subject,
        body: d.body ?? prev.body,
        template: d.template ?? "nova-branded",
        audience: "newsletter",
        ctaLabel: "",
        ctaUrl: "",
      }));
      if (Array.isArray(d.recipients) && d.recipients.length) {
        setRecipients(d.recipients);
        setRecipientsLocked(true);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams, applyPreset]);

  // Sync recipients for list audiences (not checkbox “new”)
  useEffect(() => {
    if (recipientsLocked) return;
    if (!stats || draft.audience === "new") return;
    const list =
      draft.audience === "newsletter"
        ? stats.newsletterEmails
        : draft.audience === "free"
          ? stats.freeEmails ?? []
          : draft.audience === "vip"
            ? stats.vipEmails ?? []
            : draft.audience === "inactive7d"
              ? stats.inactive7dEmails ?? []
              : draft.audience === "trial"
                ? stats.trialEmails ?? []
                : draft.audience === "trial-expiring"
                  ? stats.trialExpiringEmails ?? []
                  : stats.allEmails;
    setRecipients([...list]);
  }, [draft.audience, stats, recipientsLocked]);

  // When switching to "new" or changing window, select all in window by default
  useEffect(() => {
    if (draft.audience !== "new") return;
    const emails = windowedNew.map((r) => r.email);
    setSelectedNewEmails(new Set(emails));
    setRecipients(emails);
  }, [draft.audience, windowedNew]);

  const toggleNewEmail = (email: string) => {
    setSelectedNewEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      const list = windowedNew.map((r) => r.email).filter((e) => next.has(e));
      setRecipients(list);
      return next;
    });
  };

  const selectAllNew = () => {
    const emails = windowedNew.map((r) => r.email);
    setSelectedNewEmails(new Set(emails));
    setRecipients(emails);
  };

  const clearNewSelection = () => {
    setSelectedNewEmails(new Set());
    setRecipients([]);
  };

  const shareText = useMemo(
    () => formatPlainShareText(draft.subject, draft.body),
    [draft.subject, draft.body]
  );

  const copyForWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      onNotice?.("Copied — paste into WhatsApp, Telegram, or Instagram.");
    } catch {
      onError?.("Could not copy. Select the plain text and copy manually.");
    }
  };

  const addRecipient = () => {
    const email = addInput.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onError?.("Enter a valid email.");
      return;
    }
    setRecipients((prev) => (prev.includes(email) ? prev : [...prev, email]));
    if (draft.audience === "new") {
      setSelectedNewEmails((prev) => new Set(prev).add(email));
    }
    setAddInput("");
  };

  const send = async () => {
    if (!confirm) {
      onError?.("Check the confirmation box before sending.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/announcement-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: draft.subject,
          body: draft.body,
          audience: draft.audience === "all" ? "all" : "newsletter",
          includePartnerLogos: draft.includePartnerLogos,
          partnerBrand: draft.partnerBrand,
          template: format === "rich" ? draft.template : "default",
          format,
          ctaLabel: format === "rich" ? draft.ctaLabel || undefined : undefined,
          ctaUrl: format === "rich" ? draft.ctaUrl || undefined : undefined,
          recipients,
          confirm: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        const r = data.result as { sent: number; failed: number; total: number };
        onNotice?.(
          `Email sent to ${r.sent} of ${r.total} recipients${r.failed ? ` (${r.failed} failed)` : ""}.`
        );
        setConfirm(false);
        void loadStats();
      } else {
        onError?.(data.error ?? "Send failed.");
      }
    } catch {
      onError?.("Send failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Discovery call (Calendly)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Users land on /discovery-call, then book via Calendly (external). Free Calendly plan is enough.
            Paste / update your public booking link below, enable, then load the “Discovery call” preset.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={strategyCallEnabled}
              onChange={(e) => setStrategyCallEnabled(e.target.checked)}
            />
            Enabled (page, Start here link, emails)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={strategyCallShowNav}
              onChange={(e) => setStrategyCallShowNav(e.target.checked)}
              disabled={!strategyCallEnabled}
            />
            Show “Discovery call” button in dashboard nav
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={strategyCallShowPopup}
              onChange={(e) => setStrategyCallShowPopup(e.target.checked)}
              disabled={!strategyCallEnabled}
            />
            Show one-time popup on dashboard (once per browser)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              className={`${inputClass} flex-1`}
              placeholder="https://calendly.com/novastaris-ai/30min"
              value={strategyCallUrl}
              onChange={(e) => setStrategyCallUrl(e.target.value)}
            />
            <Button type="button" size="sm" disabled={strategyCallSaving} onClick={() => void saveStrategyCall()}>
              {strategyCallSaving ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Setup: calendly.com → free account → connect Google Calendar → create one event → copy the share link
            here. Page: /discovery-call
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-200/80 dark:border-amber-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">PnL Calculator — social postcard</CardTitle>
          <p className="text-sm text-muted-foreground">
            Owner-only marketing asset for X, Instagram, WhatsApp, and Telegram. Pair with the PnL Calculator launch
            email preset below.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={postcardBusy}
              onClick={async () => {
                setPostcardBusy(true);
                try {
                  const blob = await drawPnlCalculatorPostcard();
                  await sharePnlWithFallback(
                    blob,
                    `NovaStaris_PnL_Calculator_${new Date().toISOString().slice(0, 10)}.jpg`,
                    buildPnlCalculatorShareCaption()
                  );
                  onNotice?.("Postcard shared or downloaded.");
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
                  await downloadPnlCalculatorPostcard();
                  onNotice?.("Postcard downloaded.");
                } finally {
                  setPostcardBusy(false);
                }
              }}
            >
              Download postcard
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Choose a template</CardTitle>
          <p className="text-sm text-muted-foreground">
            Load a preset, then send as rich email or copy plain text for WhatsApp / Telegram / IG.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ADMIN_EMAIL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  presetId === p.id
                    ? "border-teal-500 bg-teal-500/10"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.blurb}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPresetId("custom");
                setDraft((d) => ({ ...d, template: "default", ctaLabel: "", ctaUrl: "" }));
              }}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                presetId === "custom"
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
              }`}
            >
              <p className="text-sm font-medium">Custom</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Write your own message</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={format === "rich" ? "default" : "outline"}
              onClick={() => setFormat("rich")}
            >
              Rich email template
            </Button>
            <Button
              type="button"
              size="sm"
              variant={format === "plain" ? "default" : "outline"}
              onClick={() => setFormat("plain")}
            >
              Plain text
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {format === "rich"
              ? "Polished HTML for Resend (header, sections, CTA when available)."
              : "Original plain format — best for WhatsApp / Telegram / Instagram copy-paste. Emails send as simple text too."}
          </p>
          {format === "rich" && draft.template === "forex-rebate" && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              Rebate rich layout is on (branded header, offer card, CTA).
            </p>
          )}
          {format === "rich" && draft.template === "affiliate" && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
              Affiliate rich layout is on (NovaStaris header, 10% offer card, Get your link CTA).
            </p>
          )}
          {format === "rich" && draft.template === "welcome" && (
            <p className="text-xs text-teal-700 dark:text-teal-300 rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-2">
              Welcome rich layout is on (NovaStaris banner, path card, Open Start here CTA).
            </p>
          )}
          {format === "rich" && draft.template === "why-traders" && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
              Brand blast rich layout is on (blue frame, gradient hero, dark card, Choose your desk CTA).
            </p>
          )}
          {format === "rich" && draft.template === "futures-morning-brief" && (
            <p className="text-xs text-teal-700 dark:text-teal-300 rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-2">
              Loads today’s stored Daily Wrap into subject/body when you pick this preset (or after Publish today). Sample text means no wrap in DB yet. CTA opens Crypto Futures → Daily Wrap. Cron emails the live wrap separately when DIGEST_EMAIL_TO / newsletter flag is set.
            </p>
          )}
          {format === "rich" && draft.template === "pnl-calculator" && (
            <p className="text-xs text-amber-700 dark:text-amber-300 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              PnL Calculator rich layout is on (amber hero, feature card, access tiers, Open PnL Calculator CTA).
              Suggested audience: all users with email.
            </p>
          )}
          {format === "rich" && draft.template === "nova-branded" && (
            <p className="text-xs text-teal-700 dark:text-teal-300 rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-2">
              NovaStaris banner layout is on (brand header + your message + CTA).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyForWhatsApp()}>
              Copy for WhatsApp / Telegram / IG
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">3. Message & send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading audience…</p>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <strong>{stats?.newsletterCount ?? 0}</strong> newsletter ·{" "}
              <strong>{stats?.allEmailCount ?? 0}</strong> with email ·{" "}
              <strong>{stats?.freeCount ?? stats?.freeEmails?.length ?? 0}</strong> free ·{" "}
              <strong>{stats?.vipCount ?? stats?.vipEmails?.length ?? 0}</strong> VIP ·{" "}
              <strong>{stats?.trialCount ?? stats?.trialEmails?.length ?? 0}</strong> on trial ·{" "}
              <strong>{stats?.trialExpiringCount ?? stats?.trialExpiringEmails?.length ?? 0}</strong> trial ending soon ·{" "}
              <strong>{stats?.inactive7dCount ?? stats?.inactive7dEmails?.length ?? 0}</strong> inactive 7d ·{" "}
              <strong>{stats?.recentRegistrants?.length ?? 0}</strong> new (30d) (
              <Link href="/admin/customers" className="underline text-teal-700 dark:text-teal-300">
                Customers
              </Link>
              )
            </p>
          )}

          <label className="text-xs text-muted-foreground flex flex-col gap-1 max-w-xs">
            Audience
            <select
              className={inputClass}
              value={draft.audience}
              onChange={(e) =>
                setDraft((d) => ({ ...d, audience: e.target.value as AudienceMode }))
              }
            >
              <option value="newsletter">Newsletter only (recommended)</option>
              <option value="all">All customers with email</option>
              <option value="free">Free users (no active VIP)</option>
              <option value="vip">VIP subscribers (active)</option>
              <option value="inactive7d">Inactive 7+ days</option>
              <option value="trial">On VIP trial</option>
              <option value="trial-expiring">Trial ending soon (~36h)</option>
              <option value="new">Newly registered (select below)</option>
            </select>
          </label>

          {draft.audience === "new" && (
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-3 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Registered in
                  <select
                    className={inputClass}
                    value={newWindowDays}
                    onChange={(e) => setNewWindowDays(Number(e.target.value))}
                  >
                    {NEW_WINDOW_OPTIONS.map((o) => (
                      <option key={o.days} value={o.days}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={selectAllNew}>
                    Select all ({windowedNew.length})
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={clearNewSelection}>
                    Clear
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedNewEmails.size} selected · click a row to toggle. Newsletter opt-in shown for reference —
                welcome can go to any selected registrant.
              </p>
              <div className="max-h-56 overflow-y-auto rounded-md border bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
                {windowedNew.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No registrations in this window.</p>
                ) : (
                  windowedNew.map((r) => {
                    const checked = selectedNewEmails.has(r.email);
                    return (
                      <label
                        key={r.email}
                        className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleNewEmail(r.email)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 break-all">
                            {r.email}
                          </span>
                          {r.name ? (
                            <span className="text-muted-foreground"> · {r.name}</span>
                          ) : null}
                          <span className="block text-[11px] text-muted-foreground">
                            {new Date(r.createdAt).toLocaleString()}
                            {r.newsletterOptIn ? " · newsletter" : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {format === "rich" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.includePartnerLogos}
                  onChange={(e) => setDraft((d) => ({ ...d, includePartnerLogos: e.target.checked }))}
                />
                Include partner logos / branded header
              </label>
              {draft.includePartnerLogos && (
                <label className="text-xs text-muted-foreground flex flex-col gap-1 max-w-[200px]">
                  Partner
                  <select
                    className={inputClass}
                    value={draft.partnerBrand}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        partnerBrand: e.target.value as PartnerBrandEmail,
                      }))
                    }
                  >
                    <option value="blofin">Blofin</option>
                    <option value="vantage">Vantage</option>
                    <option value="tiomarkets">TIOmarkets</option>
                    <option value="assexmarkets">Assexmarkets</option>
                  </select>
                </label>
              )}
            </>
          )}

          {format === "plain" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.includePartnerLogos}
                onChange={(e) => setDraft((d) => ({ ...d, includePartnerLogos: e.target.checked }))}
              />
              Include logos when emailing plain text (optional)
            </label>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium">Recipients ({recipients.length})</p>
              <div className="flex flex-wrap items-center gap-1">
                {recipients.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    onClick={() => {
                      setRecipients([]);
                      setSelectedNewEmails(new Set());
                      setRecipientsLocked(false);
                    }}
                  >
                    Clear all
                  </Button>
                )}
                {draft.audience !== "new" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!stats) return;
                      const list =
                        draft.audience === "newsletter"
                          ? stats.newsletterEmails
                          : draft.audience === "free"
                            ? stats.freeEmails ?? []
                            : draft.audience === "vip"
                              ? stats.vipEmails ?? []
                              : draft.audience === "inactive7d"
                                ? stats.inactive7dEmails ?? []
                                : draft.audience === "trial"
                                  ? stats.trialEmails ?? []
                                  : draft.audience === "trial-expiring"
                                    ? stats.trialExpiringEmails ?? []
                                    : stats.allEmails;
                      setRecipients([...list]);
                    }}
                  >
                    Reset from audience
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-md border p-2 bg-zinc-50/80 dark:bg-zinc-900/50">
              {recipients.length === 0 ? (
                <span className="text-xs text-muted-foreground">No recipients — add a test email below.</span>
              ) : (
                recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 text-xs"
                  >
                    {email}
                    <button
                      type="button"
                      className="px-1"
                      aria-label={`Remove ${email}`}
                      onClick={() => {
                        setRecipients((prev) => prev.filter((e) => e !== email));
                        setSelectedNewEmails((prev) => {
                          const next = new Set(prev);
                          next.delete(email);
                          return next;
                        });
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputClass} flex-1 min-w-[12rem]`}
                value={addInput}
                placeholder="Add test email…"
                onChange={(e) => setAddInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={addRecipient}>
                Add
              </Button>
            </div>
          </div>

          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Subject
            <input
              className={inputClass}
              value={draft.subject}
              onChange={(e) => {
                setPresetId("custom");
                setDraft((d) => ({ ...d, subject: e.target.value }));
              }}
            />
          </label>

          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Message (plain text source)
            <textarea
              rows={12}
              className={inputClass}
              value={draft.body}
              onChange={(e) => {
                setPresetId("custom");
                setDraft((d) => ({ ...d, body: e.target.value }));
              }}
              placeholder="Edit the message. Use Copy for WhatsApp, or Send for email."
            />
          </label>

          {format === "rich" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Button text (CTA)
                <input
                  className={inputClass}
                  value={draft.ctaLabel}
                  onChange={(e) => {
                    setPresetId("custom");
                    setDraft((d) => ({ ...d, ctaLabel: e.target.value }));
                  }}
                  placeholder='e.g. Start 3-day VIP trial'
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Button link (CTA URL)
                <input
                  className={inputClass}
                  value={draft.ctaUrl}
                  onChange={(e) => {
                    setPresetId("custom");
                    setDraft((d) => ({ ...d, ctaUrl: e.target.value }));
                  }}
                  placeholder="https://novastaris.ai/subscribe?trial=1"
                />
              </label>
            </div>
          )}

          {format === "plain" && (
            <div className="rounded-md border bg-zinc-50 dark:bg-zinc-900/40 p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">WhatsApp preview</p>
              <pre className="whitespace-pre-wrap text-xs text-zinc-800 dark:text-zinc-200 font-sans">
                {shareText || "—"}
              </pre>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            <span>
              I confirm sending to <strong>{recipients.length}</strong> recipient
              {recipients.length === 1 ? "" : "s"} via email ({format === "rich" ? "rich" : "plain"} format).
            </span>
          </label>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={
              sending || !draft.subject.trim() || !draft.body.trim() || recipients.length === 0 || !confirm
            }
            onClick={() => void send()}
          >
            {sending ? "Sending…" : `Send ${format === "rich" ? "rich" : "plain"} email`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Auto welcome log</CardTitle>
          <p className="text-sm text-muted-foreground">
            Who received the signup welcome email (register / first Google). Toggle in Feature flags → Welcome email on
            signup.
          </p>
        </CardHeader>
        <CardContent>
          {welcomeLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No auto welcome sends logged yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Source</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {welcomeLogs.map((w) => (
                    <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-2 font-medium break-all">{w.email}</td>
                      <td className="py-1.5 pr-2">{w.source}</td>
                      <td className="py-1.5 pr-2">
                        {w.success ? (
                          <span className="text-emerald-700 dark:text-emerald-300">Sent</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400" title={w.error ?? undefined}>
                            Failed{w.error ? `: ${w.error.slice(0, 48)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                        {w.createdAt ? new Date(w.createdAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent sends</CardTitle>
          <p className="text-sm text-muted-foreground">Last 20 announcement email campaigns.</p>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Subject</th>
                    <th className="py-2 pr-2">Template</th>
                    <th className="py-2 pr-2">Sent / failed</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-2 font-medium">{c.subject}</td>
                      <td className="py-1.5 pr-2">{c.template}</td>
                      <td className="py-1.5 pr-2">
                        {c.sentCount}/{c.recipientCount}
                        {c.failedCount ? (
                          <span className="text-rose-600 dark:text-rose-400"> · {c.failedCount} failed</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                        {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
