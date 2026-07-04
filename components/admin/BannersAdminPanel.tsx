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
import { formatPromoDrawDate } from "@/lib/promo-banner";
import { PromoBannerDisplay } from "@/components/PromoBannerDisplay";
import MemeAgentBannerDisplay from "@/components/MemeAgentBannerDisplay";
import MemeTableAnalyzeHint from "@/components/MemeTableAnalyzeHint";
import { GuestRegistrationBanner } from "@/components/GuestRegistrationNudge";

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
    return Promise.all([
      fetch("/api/admin/promo-banner").then((r) => r.json()),
      fetch("/api/admin/meme-agent-banner").then((r) => r.json()),
      fetch("/api/admin/meme-table-analyze-hint").then((r) => r.json()),
      fetch("/api/admin/guest-registration-nudge-banner").then((r) => r.json()),
    ])
      .then(([promoData, memeBannerData, memeTableHintData, guestNudgeData]) => {
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
      })
      .catch(() => onError?.("Failed to load banners."))
      .finally(() => {
        setPromoLoading(false);
        setMemeAgentBannerLoading(false);
        setMemeTableHintLoading(false);
        setGuestNudgeLoading(false);
      });
  }, [applyPromoDraft, applyMemeAgentDraft, onError]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const memeAgentPreview = {
    title: memeAgentBannerDraft.title || memeAgentBanner?.title || "",
    message: memeAgentBannerDraft.message || memeAgentBanner?.message || "",
    titleColor: memeAgentBannerDraft.titleColor,
    titleSize: memeAgentBannerDraft.titleSize,
    titleFont: memeAgentBannerDraft.titleFont,
  };

  const memeTableHintPreview = {
    enabled: true,
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
                  Prize (e.g. 1 SOL)
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
                  <MemeTableAnalyzeHint tier="free" config={memeTableHintPreview} preview className="mx-0 mb-0" />
                </div>
              )}
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
    </div>
  );
}
