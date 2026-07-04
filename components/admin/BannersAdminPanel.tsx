"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PromoBannerAdmin } from "@/lib/promo-banner";
import type { MemeAgentBannerAdmin } from "@/lib/meme-agent-banner";
import { formatPromoDrawDate } from "@/lib/promo-banner";
import { PromoBannerDisplay } from "@/components/PromoBannerDisplay";
import MemeAgentBannerDisplay from "@/components/MemeAgentBannerDisplay";

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
  const [memeAgentBannerDraft, setMemeAgentBannerDraft] = useState({ title: "", message: "" });

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
    return Promise.all([
      fetch("/api/admin/promo-banner").then((r) => r.json()),
      fetch("/api/admin/meme-agent-banner").then((r) => r.json()),
    ])
      .then(([promoData, memeBannerData]) => {
        if (promoData.success && promoData.promo) {
          applyPromoDraft(promoData.promo as PromoBannerAdmin);
        } else onError?.(promoData.error ?? "Failed to load promo banner.");
        if (memeBannerData.success && memeBannerData.banner) {
          const b = memeBannerData.banner as MemeAgentBannerAdmin;
          setMemeAgentBanner(b);
          setMemeAgentBannerDraft({ title: b.title, message: b.message });
        } else onError?.(memeBannerData.error ?? "Failed to load Meme Agent banner.");
      })
      .catch(() => onError?.("Failed to load banners."))
      .finally(() => {
        setPromoLoading(false);
        setMemeAgentBannerLoading(false);
      });
  }, [applyPromoDraft, onError]);

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
        const b = data.banner as MemeAgentBannerAdmin;
        setMemeAgentBanner(b);
        setMemeAgentBannerDraft({ title: b.title, message: b.message });
        onNotice?.("Meme Agent banner updated.");
      } else onError?.(data.error ?? "Update failed.");
    } catch {
      onError?.("Update failed.");
    } finally {
      setMemeAgentBannerSaving(false);
    }
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
                <div className="rounded-lg border border-dashed border-violet-300/60 dark:border-violet-700/50 p-1">
                  <MemeAgentBannerDisplay
                    title={memeAgentBannerDraft.title || memeAgentBanner.title}
                    message={memeAgentBannerDraft.message || memeAgentBanner.message}
                  />
                </div>
              )}

              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Banner title
                <input
                  type="text"
                  value={memeAgentBannerDraft.title}
                  onChange={(e) => setMemeAgentBannerDraft((d) => ({ ...d, title: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-semibold"
                />
              </label>

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
                  })
                }
              >
                {memeAgentBannerSaving ? "Saving…" : "Save banner"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Other in-app banners</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Meme table analyze hint</span> — purple dismissible hint on Go Hunting meme coin tables (guest / free / VIP copy). Fixed in app code for now.
          </p>
          <p>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Guest registration nudge</span> — shown to unsigned visitors after engagement. Fixed in app code.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
