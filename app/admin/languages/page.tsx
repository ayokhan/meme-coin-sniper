"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { LOCALE_LABELS, type AppLocale } from "@/lib/i18n/locales";
import { Languages } from "lucide-react";

type LocaleConfigAdmin = {
  enabledLocales: AppLocale[];
  defaultLocale: AppLocale;
  updatedAt: string | null;
  allLocales: AppLocale[];
};

export default function AdminLanguagesPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [config, setConfig] = useState<LocaleConfigAdmin | null>(null);
  const [enabled, setEnabled] = useState<Set<AppLocale>>(new Set(["en"]));
  const [defaultLocale, setDefaultLocale] = useState<AppLocale>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/locales", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load languages.");
        return;
      }
      const c = data.config as LocaleConfigAdmin;
      setConfig(c);
      setEnabled(new Set(c.enabledLocales));
      setDefaultLocale(c.defaultLocale);
    } catch {
      setError("Network error loading languages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner, load]);

  const toggle = (id: AppLocale) => {
    if (id === "en") return; // English always on
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      next.add("en");
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const enabledLocales = (config?.allLocales ?? []).filter((id) => enabled.has(id));
      const res = await fetch("/api/admin/locales", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledLocales,
          defaultLocale: enabled.has(defaultLocale) ? defaultLocale : "en",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not save.");
        return;
      }
      const c = data.config as LocaleConfigAdmin;
      setConfig(c);
      setEnabled(new Set(c.enabledLocales));
      setDefaultLocale(c.defaultLocale);
      setMessage("Languages saved. The site language switcher updates immediately.");
      setTimeout(() => setMessage(""), 4000);
    } catch {
      setError("Network error saving languages.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage languages."}
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

  const enabledList = (config?.allLocales ?? []).filter((id) => enabled.has(id));

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Languages"
        description="Turn site languages on or off and choose the default. English stays available as fallback. French and Yorùbá are recommended while other University translations are incomplete."
      />

      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Languages className="h-4 w-4" /> Available in language switcher
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !config ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <ul className="grid sm:grid-cols-2 gap-2">
                {config.allLocales.map((id) => {
                  const on = enabled.has(id);
                  const locked = id === "en";
                  return (
                    <li key={id}>
                      <label
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer ${
                          on
                            ? "border-cyan-500/40 bg-cyan-500/5"
                            : "border-zinc-200 dark:border-zinc-700"
                        } ${locked ? "opacity-90" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked || saving}
                          onChange={() => toggle(id)}
                          className="h-4 w-4 accent-cyan-600"
                        />
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {LOCALE_LABELS[id]}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono ml-auto">{id}</span>
                        {locked && (
                          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Required</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100" htmlFor="default-locale">
                  Default language (new visitors / when stored language is disabled)
                </label>
                <select
                  id="default-locale"
                  value={enabled.has(defaultLocale) ? defaultLocale : "en"}
                  disabled={saving}
                  onChange={(e) => setDefaultLocale(e.target.value as AppLocale)}
                  className="h-10 w-full max-w-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                >
                  {enabledList.map((id) => (
                    <option key={id} value={id}>
                      {LOCALE_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save languages"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void load()} disabled={saving || loading}>
                  Reset draft
                </Button>
              </div>
              {config.updatedAt && (
                <p className="text-[11px] text-muted-foreground">
                  Last saved {new Date(config.updatedAt).toLocaleString()}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
