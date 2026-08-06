"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  DEFAULT_ENTER_LANDING,
  type EnterLandingAdmin,
  type EnterLandingConfig,
  type EnterLandingDesk,
  type EnterLandingDeskId,
} from "@/lib/enter-landing";

function cloneConfig(): EnterLandingConfig {
  return JSON.parse(JSON.stringify(DEFAULT_ENTER_LANDING)) as EnterLandingConfig;
}

export default function AdminLandingPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [enabled, setEnabled] = useState(true);
  const [config, setConfig] = useState<EnterLandingConfig>(cloneConfig);
  const [meta, setMeta] = useState<{ usesDefault: boolean; updatedAt: string | null }>({
    usesDefault: true,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/enter-landing", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setEnabled(!!data.enabled);
      const cfg = data.config as EnterLandingAdmin;
      const { usesDefault, updatedAt, ...landing } = cfg;
      setConfig(landing);
      setMeta({
        usesDefault: !!usesDefault,
        updatedAt: updatedAt ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner]);

  const save = async (opts?: { reset?: boolean; enabledOnly?: boolean }) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body: Record<string, unknown> = { enabled };
      if (opts?.reset) body.resetToDefault = true;
      else if (!opts?.enabledOnly) body.config = config;
      const res = await fetch("/api/admin/enter-landing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setEnabled(!!data.enabled);
      const cfg = data.config as EnterLandingAdmin;
      const { usesDefault, updatedAt, ...landing } = cfg;
      setConfig(landing);
      setMeta({
        usesDefault: !!usesDefault,
        updatedAt: updatedAt ?? null,
      });
      setNotice(opts?.reset ? "Reset to defaults." : "Saved.");
      setTimeout(() => setNotice(""), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const patchDesk = (id: EnterLandingDeskId, patch: Partial<EnterLandingDesk>) => {
    setConfig((c) => ({
      ...c,
      desks: c.desks.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage landing."}
          {!session && (
            <p className="mt-2">
              <Link href="/signin" className="underline text-cyan-600">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">Owner access only.</CardContent>
      </Card>
    );
  }

  const fieldClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm";

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Landing"
        description="Guest desk landing on / and /enter — master switch, desk cards, University, Instagram, footer copy."
      />

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Master switch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded"
                />
                Show desk landing for guests on homepage
              </label>
              <p className="text-xs text-muted-foreground">
                Same as Feature flags → <code className="text-[11px]">enter_landing_enabled</code>. When OFF, guests
                see the dashboard on <code className="text-[11px]">/</code>; <code className="text-[11px]">/enter</code>{" "}
                redirects home.
              </p>
              <p className="text-xs text-muted-foreground">
                {meta.usesDefault ? "Using built-in defaults (not saved yet)." : "Custom config saved."}
                {meta.updatedAt ? ` Updated ${new Date(meta.updatedAt).toLocaleString()}.` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={saving} onClick={() => save()}>
                  {saving ? "Saving…" : "Save all"}
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => save({ enabledOnly: true })}>
                  Save switch only
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    if (confirm("Reset all landing copy to defaults?")) void save({ reset: true });
                  }}
                >
                  Reset copy to defaults
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/enter" target="_blank">
                    Preview /enter
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ["heroEyebrow", "Eyebrow"],
                  ["heroTitle", "Title"],
                  ["heroBlurb", "Blurb"],
                  ["heroPrimaryCta", "Primary CTA"],
                  ["heroSecondaryCta", "Secondary CTA"],
                  ["desksHeading", "Desks heading"],
                  ["desksBlurb", "Desks blurb"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  {key === "heroBlurb" || key === "desksBlurb" ? (
                    <textarea
                      rows={2}
                      className={fieldClass}
                      value={config[key]}
                      onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className={fieldClass}
                      value={config[key]}
                      onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Desk cards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {config.desks.map((desk) => (
                <div key={desk.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold capitalize">{desk.id}</p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={desk.enabled}
                        onChange={(e) => patchDesk(desk.id, { enabled: e.target.checked })}
                        className="rounded"
                      />
                      Visible
                    </label>
                  </div>
                  <input
                    className={fieldClass}
                    placeholder="Title"
                    value={desk.title}
                    onChange={(e) => patchDesk(desk.id, { title: e.target.value })}
                  />
                  <textarea
                    rows={2}
                    className={fieldClass}
                    placeholder="Line"
                    value={desk.line}
                    onChange={(e) => patchDesk(desk.id, { line: e.target.value })}
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      className={fieldClass}
                      placeholder="CTA"
                      value={desk.cta}
                      onChange={(e) => patchDesk(desk.id, { cta: e.target.value })}
                    />
                    <input
                      className={fieldClass}
                      placeholder="Href"
                      value={desk.href}
                      onChange={(e) => patchDesk(desk.id, { href: e.target.value })}
                    />
                  </div>
                  <select
                    className={fieldClass}
                    value={desk.gate}
                    onChange={(e) =>
                      patchDesk(desk.id, { gate: e.target.value as EnterLandingDesk["gate"] })
                    }
                  >
                    <option value="open">Gate: open</option>
                    <option value="vip">Gate: vip</option>
                    <option value="preview">Gate: preview</option>
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trading University</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.university.enabled}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, university: { ...c.university, enabled: e.target.checked } }))
                  }
                  className="rounded"
                />
                Show University section
              </label>
              {(
                [
                  ["eyebrow", "Eyebrow"],
                  ["title", "Title"],
                  ["blurb", "Blurb"],
                  ["cta", "CTA"],
                  ["secondaryCta", "Secondary CTA"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  {key === "blurb" ? (
                    <textarea
                      rows={3}
                      className={fieldClass}
                      value={config.university[key]}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          university: { ...c.university, [key]: e.target.value },
                        }))
                      }
                    />
                  ) : (
                    <input
                      className={fieldClass}
                      value={config.university[key]}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          university: { ...c.university, [key]: e.target.value },
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Path steps (comma-separated)
                </label>
                <input
                  className={fieldClass}
                  value={config.university.pathSteps.join(", ")}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      university: {
                        ...c.university,
                        pathSteps: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Instagram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.instagram.enabled}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, instagram: { ...c.instagram, enabled: e.target.checked } }))
                  }
                  className="rounded"
                />
                Show Instagram strip on landing
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.instagram.showOnPublicFooters}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      instagram: { ...c.instagram, showOnPublicFooters: e.target.checked },
                    }))
                  }
                  className="rounded"
                />
                Show quiet footer on public pages
              </label>
              {(
                [
                  ["handle", "Handle (no @)"],
                  ["url", "URL"],
                  ["stripBlurb", "Strip blurb"],
                  ["stripCta", "Strip CTA"],
                  ["marqueeText", "Marquee text"],
                  ["publicFooterLabel", "Public footer label ({handle} ok)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  <input
                    className={fieldClass}
                    value={config.instagram[key]}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        instagram: { ...c.instagram, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Landing footer links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.footer.showInstagram}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, footer: { ...c.footer, showInstagram: e.target.checked } }))
                  }
                  className="rounded"
                />
                Show Instagram in landing footer
              </label>
              {(
                [
                  ["showUniversity", "universityLabel", "universityHref", "University"],
                  ["showStartHere", "startHereLabel", "startHereHref", "Start here"],
                  ["showAffiliate", "affiliateLabel", "affiliateHref", "Affiliate"],
                  ["showWins", "winsLabel", "winsHref", "Wins"],
                ] as const
              ).map(([showKey, labelKey, hrefKey, name]) => (
                <div key={showKey} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.footer[showKey]}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          footer: { ...c.footer, [showKey]: e.target.checked },
                        }))
                      }
                      className="rounded"
                    />
                    Show {name}
                  </label>
                  <input
                    className={fieldClass}
                    value={config.footer[labelKey]}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        footer: { ...c.footer, [labelKey]: e.target.value },
                      }))
                    }
                  />
                  <input
                    className={fieldClass}
                    value={config.footer[hrefKey]}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        footer: { ...c.footer, [hrefKey]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 pb-8">
            <Button disabled={saving} onClick={() => save()}>
              {saving ? "Saving…" : "Save all"}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/feature-flags">Feature flags</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
