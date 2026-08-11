"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  DEFAULT_CASE_STUDIES_PAGE,
  type CaseStudiesPageAdmin,
  type CaseStudiesPageConfig,
  type CaseStudyAccent,
  type CaseStudyStory,
} from "@/lib/case-studies-content";

function cloneConfig(): CaseStudiesPageConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CASE_STUDIES_PAGE)) as CaseStudiesPageConfig;
}

export default function AdminCaseStudiesPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [enabled, setEnabled] = useState(true);
  const [config, setConfig] = useState<CaseStudiesPageConfig>(cloneConfig);
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
      const res = await fetch("/api/admin/case-studies", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setEnabled(!!data.enabled);
      const cfg = data.config as CaseStudiesPageAdmin;
      const { usesDefault, updatedAt, ...page } = cfg;
      setConfig(page);
      setMeta({ usesDefault: !!usesDefault, updatedAt: updatedAt ?? null });
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
      const res = await fetch("/api/admin/case-studies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setEnabled(!!data.enabled);
      const cfg = data.config as CaseStudiesPageAdmin;
      const { usesDefault, updatedAt, ...page } = cfg;
      setConfig(page);
      setMeta({ usesDefault: !!usesDefault, updatedAt: updatedAt ?? null });
      setNotice(opts?.reset ? "Reset to defaults." : "Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const patchStudy = (index: number, patch: Partial<CaseStudyStory>) => {
    setConfig((c) => {
      const studies = c.studies.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...c, studies };
    });
  };

  const fieldClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm";

  if (status === "loading") {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!isOwner) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Owner only. <Link href="/admin" className="underline">Admin hub</Link></p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <AdminPageHeader
        title="Case studies"
        description="Edit /case-studies hero and story copy. Master on/off also lives in Product visibility."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {meta.updatedAt && (
        <p className="text-xs text-muted-foreground">
          {meta.usesDefault ? "Using code defaults" : "Custom config"} · updated {new Date(meta.updatedAt).toLocaleString()}
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            Case studies page ON (page_tab_case_studies)
          </label>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void save({ enabledOnly: true })}>
            Save visibility only
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading config…</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ["heroEyebrow", "Eyebrow"],
                  ["heroTitleBefore", "Title before accent"],
                  ["heroTitleAccent", "Title accent word"],
                  ["heroBlurb", "Blurb"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  {key === "heroBlurb" ? (
                    <textarea
                      rows={3}
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

          {config.studies.map((study, index) => (
            <Card key={study.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Story: {study.id}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={study.enabled}
                    onChange={(e) => patchStudy(index, { enabled: e.target.checked })}
                    className="rounded"
                  />
                  Show this story
                </label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className={fieldClass}
                    placeholder="Name"
                    value={study.name}
                    onChange={(e) => patchStudy(index, { name: e.target.value })}
                  />
                  <input
                    className={fieldClass}
                    placeholder="Role"
                    value={study.role}
                    onChange={(e) => patchStudy(index, { role: e.target.value })}
                  />
                </div>
                <input
                  className={fieldClass}
                  placeholder="Eyebrow"
                  value={study.eyebrow}
                  onChange={(e) => patchStudy(index, { eyebrow: e.target.value })}
                />
                <input
                  className={fieldClass}
                  placeholder="Headline"
                  value={study.headline}
                  onChange={(e) => patchStudy(index, { headline: e.target.value })}
                />
                <select
                  className={fieldClass}
                  value={study.accent}
                  onChange={(e) => patchStudy(index, { accent: e.target.value as CaseStudyAccent })}
                >
                  <option value="cyan">Accent: cyan</option>
                  <option value="violet">Accent: violet</option>
                  <option value="emerald">Accent: emerald</option>
                </select>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Problem</label>
                  <textarea
                    rows={3}
                    className={fieldClass}
                    value={study.problem}
                    onChange={(e) => patchStudy(index, { problem: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Solution / workflow</label>
                  <textarea
                    rows={3}
                    className={fieldClass}
                    value={study.solution}
                    onChange={(e) => patchStudy(index, { solution: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Outcome</label>
                  <textarea
                    rows={2}
                    className={fieldClass}
                    value={study.outcome}
                    onChange={(e) => patchStudy(index, { outcome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tools (comma-separated)</label>
                  <input
                    className={fieldClass}
                    value={study.tools.join(", ")}
                    onChange={(e) =>
                      patchStudy(index, {
                        tools: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className={fieldClass}
                    placeholder="CTA label"
                    value={study.ctaLabel}
                    onChange={(e) => patchStudy(index, { ctaLabel: e.target.value })}
                  />
                  <input
                    className={fieldClass}
                    placeholder="CTA href"
                    value={study.ctaHref}
                    onChange={(e) => patchStudy(index, { ctaHref: e.target.value })}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className={fieldClass}
                    placeholder="Image path"
                    value={study.imageSrc}
                    onChange={(e) => patchStudy(index, { imageSrc: e.target.value })}
                  />
                  <input
                    className={fieldClass}
                    placeholder="Image alt"
                    value={study.imageAlt}
                    onChange={(e) => patchStudy(index, { imageAlt: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bottom CTA + disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  className={fieldClass}
                  placeholder="Primary CTA label"
                  value={config.ctaPrimaryLabel}
                  onChange={(e) => setConfig((c) => ({ ...c, ctaPrimaryLabel: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  placeholder="Primary CTA href"
                  value={config.ctaPrimaryHref}
                  onChange={(e) => setConfig((c) => ({ ...c, ctaPrimaryHref: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  placeholder="Secondary CTA label"
                  value={config.ctaSecondaryLabel}
                  onChange={(e) => setConfig((c) => ({ ...c, ctaSecondaryLabel: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  placeholder="Secondary CTA href"
                  value={config.ctaSecondaryHref}
                  onChange={(e) => setConfig((c) => ({ ...c, ctaSecondaryHref: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  placeholder="Tertiary CTA label"
                  value={config.ctaTertiaryLabel}
                  onChange={(e) => setConfig((c) => ({ ...c, ctaTertiaryLabel: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  placeholder="Tertiary CTA href"
                  value={config.ctaTertiaryHref}
                  onChange={(e) => setConfig((c) => ({ ...c, ctaTertiaryHref: e.target.value }))}
                />
              </div>
              <textarea
                rows={3}
                className={fieldClass}
                value={config.footerDisclaimer}
                onChange={(e) => setConfig((c) => ({ ...c, footerDisclaimer: e.target.value }))}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 pb-8">
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save all"}
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => void save({ reset: true })}>
              Reset to defaults
            </Button>
            <Button variant="outline" asChild>
              <Link href="/case-studies" target="_blank">
                Preview page
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/tab-visibility">Product visibility</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
