"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  STUDIO_ANGLES,
  STUDIO_SEGMENTS,
  STUDIO_WEEKLY_CAP,
  checkStudioCopy,
  renderStudioEmail,
  type StudioAngle,
  type StudioDraft,
  type StudioSegment,
} from "@/lib/email-studio-types";

type CampaignRow = {
  id: string;
  angle: string;
  subject: string;
  segment: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  cappedCount: number;
  opened: number;
  clicked: number;
  createdAt: string;
};

type Audience = { recipients: number; segmentCount: number; suppressedCount: number; cappedCount: number };

const inputClass =
  "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export default function EmailStudioPanel() {
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [generating, setGenerating] = useState<StudioAngle | null>(null);
  const [segment, setSegment] = useState<StudioSegment>("newsletter");
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
  const [audience, setAudience] = useState<Audience | null>(null);
  const [audienceRefresh, setAudienceRefresh] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-studio", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns ?? []);
        setSegmentCounts(data.segmentCounts ?? {});
      }
    } catch {
      /* stats are optional */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setAudience(null);
    fetch("/api/admin/email-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "audience", segment }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success) setAudience(d as Audience);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [segment, audienceRefresh]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/email-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({ success: false, error: `Request failed (${res.status}).` }));
    if (!data.success) throw new Error(data.error || "Request failed.");
    return data;
  };

  const generate = async (angle: StudioAngle) => {
    setGenerating(angle);
    setError("");
    setNotice("");
    try {
      const data = await post({ action: "generate", angle });
      setDraft(data.draft as StudioDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the email.");
    } finally {
      setGenerating(null);
    }
  };

  const sendTest = async () => {
    if (!draft) return;
    setBusy("test");
    setError("");
    setNotice("");
    try {
      const data = await post({ action: "test", draft });
      setNotice(`Test sent to ${data.to}. Check inbox and spam.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed.");
    } finally {
      setBusy(null);
    }
  };

  const sendCampaign = async () => {
    if (!draft || !audience) return;
    const segLabel = STUDIO_SEGMENTS.find((s) => s.id === segment)?.label ?? segment;
    if (!window.confirm(`Send "${draft.subject}" to ${audience.recipients} people (${segLabel})? This can't be undone.`)) return;
    setBusy("send");
    setError("");
    setNotice("");
    try {
      const data = await post({ action: "send", draft, segment, confirm: true });
      setNotice(
        `Sent to ${data.sent} people${data.failed ? `, ${data.failed} failed` : ""}${data.cappedCount ? `, ${data.cappedCount} skipped by the weekly cap` : ""}.`
      );
      setDraft(null);
      void load();
      setAudienceRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy(null);
    }
  };

  const issues = useMemo(() => (draft ? checkStudioCopy(draft) : []), [draft]);
  const blocked = issues.some((i) => i.level === "block");
  const previewHtml = useMemo(() => (draft ? renderStudioEmail(draft) : ""), [draft]);

  const update = (patch: Partial<StudioDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateSectionNote = (key: string, note: string) =>
    setDraft((d) => (d ? { ...d, sections: d.sections.map((s) => (s.key === key ? { ...s, note } : s)) } : d));

  return (
    <Card className="mb-6 border-teal-500/30">
      <CardContent className="p-4 sm:p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Email Studio</h2>
          <p className="text-sm text-muted-foreground">
            Pick a type and the Studio builds a fresh email from live NovaStaris data. The numbers come from the data; AI only writes the words
            around them. Each click gives a new version. Max {STUDIO_WEEKLY_CAP} Studio emails per person per week.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {STUDIO_ANGLES.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border p-3 flex flex-col gap-2 ${draft?.angle === a.id ? "border-teal-500 bg-teal-500/5" : "border-zinc-200 dark:border-zinc-800"}`}
            >
              <div>
                <p className="font-medium text-sm">{a.label}</p>
                <p className="text-[11px] uppercase tracking-wide text-teal-600 dark:text-teal-400">{a.markets}</p>
              </div>
              <p className="text-xs text-muted-foreground flex-1">{a.description}</p>
              <Button size="sm" onClick={() => generate(a.id)} disabled={!!generating || !!busy}>
                {generating === a.id ? "Building…" : draft?.angle === a.id ? "Generate another" : "Generate"}
              </Button>
            </div>
          ))}
        </div>

        {generating && (
          <p className="text-sm text-muted-foreground">Pulling live data and writing copy. This can take up to a minute…</p>
        )}
        {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {draft && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              {!draft.aiUsed && (
                <p className="text-xs rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                  AI copy wasn&apos;t available, so this uses the built-in template wording. The data is still live.
                </p>
              )}
              <div>
                <label className={labelClass}>Subject line</label>
                <div className="space-y-1 mb-2">
                  {draft.subjects.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="studio-subject" checked={draft.subject === s} onChange={() => update({ subject: s })} />
                      {s}
                    </label>
                  ))}
                </div>
                <input className={inputClass} value={draft.subject} onChange={(e) => update({ subject: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">{draft.subject.length} characters (under 60 reads best on phones)</p>
              </div>
              <div>
                <label className={labelClass}>Preview text (shown after the subject in the inbox)</label>
                <input className={inputClass} value={draft.preheader} onChange={(e) => update({ preheader: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Headline</label>
                <input className={inputClass} value={draft.headline} onChange={(e) => update({ headline: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Intro</label>
                <textarea className={inputClass} rows={4} value={draft.hook} onChange={(e) => update({ hook: e.target.value })} />
              </div>
              {draft.sections.map((s) => (
                <div key={s.key}>
                  <label className={labelClass}>{s.title} (text above the table)</label>
                  <textarea className={inputClass} rows={2} value={s.note} onChange={(e) => updateSectionNote(s.key, e.target.value)} />
                </div>
              ))}
              {draft.lesson && (
                <div className="space-y-2">
                  <label className={labelClass}>Lesson box</label>
                  <input
                    className={inputClass}
                    value={draft.lesson.title}
                    onChange={(e) => update({ lesson: { ...draft.lesson!, title: e.target.value } })}
                  />
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={draft.lesson.body}
                    onChange={(e) => update({ lesson: { ...draft.lesson!, body: e.target.value } })}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Button text</label>
                <input className={inputClass} value={draft.cta.label} onChange={(e) => update({ cta: { ...draft.cta, label: e.target.value } })} />
                <p className="text-[11px] text-muted-foreground mt-1 break-all">Links to {draft.cta.url}</p>
              </div>

              {issues.length > 0 && (
                <ul className="space-y-1">
                  {issues.map((i, idx) => (
                    <li key={idx} className={`text-xs ${i.level === "block" ? "text-rose-600" : "text-amber-600 dark:text-amber-400"}`}>
                      {i.level === "block" ? "Fix before sending: " : "Check: "}
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
                <div>
                  <label className={labelClass}>Send to</label>
                  <select className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value as StudioSegment)}>
                    {STUDIO_SEGMENTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                        {segmentCounts[s.id] != null ? ` (${segmentCounts[s.id]})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {audience
                      ? `${audience.recipients} will get it${audience.suppressedCount ? ` · ${audience.suppressedCount} unsubscribed or blocked` : ""}${audience.cappedCount ? ` · ${audience.cappedCount} skipped (already got ${STUDIO_WEEKLY_CAP} this week)` : ""}`
                      : "Counting recipients…"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={sendTest} disabled={!!busy || blocked}>
                    {busy === "test" ? "Sending…" : "Send test to me"}
                  </Button>
                  <Button size="sm" onClick={sendCampaign} disabled={!!busy || blocked || !audience || audience.recipients === 0}>
                    {busy === "send" ? "Sending… keep this tab open" : `Send to ${audience?.recipients ?? "…"} people`}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <p className={labelClass}>Preview</p>
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full h-[1100px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950"
              />
            </div>
          </div>
        )}

        {campaigns.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Sent Studio emails</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 pr-3 font-medium">Sent</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">To</th>
                    <th className="py-2 pr-3 font-medium text-right">Delivered</th>
                    <th className="py-2 pr-3 font-medium text-right">Opened</th>
                    <th className="py-2 pr-3 font-medium text-right">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{STUDIO_ANGLES.find((a) => a.id === c.angle)?.label ?? c.angle}</td>
                      <td className="py-2 pr-3">{c.subject}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{STUDIO_SEGMENTS.find((s) => s.id === c.segment)?.label ?? c.segment}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {c.sentCount}/{c.recipientCount}
                        {c.failedCount ? <span className="text-rose-600"> ({c.failedCount} failed)</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {c.opened} · {pct(c.opened, c.sentCount)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {c.clicked} · {pct(c.clicked, c.sentCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Opens are an upper bound: Apple Mail loads images for privacy, which counts as an open. Clicks are the reliable number.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
