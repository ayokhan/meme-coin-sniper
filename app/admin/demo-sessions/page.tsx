"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { publicDemoUrl, shareTextForDemo, slugifyDemoTitle } from "@/lib/demo-sessions";

type SessionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sessionAt: string | null;
  timezone: string | null;
  meetingUrl: string | null;
  meetingPlatform: string | null;
  locationNote: string | null;
  isPublished: boolean;
  registrationOpen: boolean;
  maxAttendees: number | null;
  registrationCount: number;
  publicUrl?: string;
};

type Registration = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  cryptoExperience: string | null;
  forexExperience: string | null;
  newsletterOptIn: boolean;
  promoOptIn: boolean;
  source: string | null;
  createdAt: string;
};

export default function AdminDemoSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sessionAt, setSessionAt] = useState("");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingPlatform, setMeetingPlatform] = useState("zoom");
  const [locationNote, setLocationNote] = useState("Online via Zoom / Google Meet");
  const [isPublished, setIsPublished] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [maxAttendees, setMaxAttendees] = useState("");

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/demo-sessions", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load sessions.");
        return;
      }
      setSessions(data.sessions ?? []);
    } catch {
      setError("Network error loading sessions.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/demo-sessions/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load session.");
        return;
      }
      const s = data.session;
      setTitle(s.title);
      setSlug(s.slug);
      setDescription(s.description ?? "");
      setSessionAt(s.sessionAt ? toLocalInput(s.sessionAt) : "");
      setTimezone(s.timezone ?? "America/Toronto");
      setMeetingUrl(s.meetingUrl ?? "");
      setMeetingPlatform(s.meetingPlatform ?? "zoom");
      setLocationNote(s.locationNote ?? "");
      setIsPublished(!!s.isPublished);
      setRegistrationOpen(s.registrationOpen !== false);
      setMaxAttendees(s.maxAttendees != null ? String(s.maxAttendees) : "");
      setRegs(s.registrations ?? []);
      setEmailSubject(`Your NovaStaris demo: ${s.title}`);
      setEmailBody(
        `Hi,\n\nThanks for registering for ${s.title}.\n\nPlease join with the link below at the scheduled time. Bring questions — we'll walk through the platform live.`
      );
    } catch {
      setError("Failed to load session detail.");
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setSelectedId(null);
    setRegs([]);
    setTitle("");
    setSlug("");
    setDescription("");
    setSessionAt("");
    setTimezone("America/Toronto");
    setMeetingUrl("");
    setMeetingPlatform("zoom");
    setLocationNote("Online via Zoom / Google Meet");
    setIsPublished(false);
    setRegistrationOpen(true);
    setMaxAttendees("");
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        title,
        slug: slug || slugifyDemoTitle(title),
        description,
        sessionAt: sessionAt || null,
        timezone,
        meetingUrl,
        meetingPlatform,
        locationNote,
        isPublished,
        registrationOpen,
        maxAttendees: maxAttendees || null,
      };
      const res = await fetch(
        selectedId ? `/api/admin/demo-sessions/${selectedId}` : "/api/admin/demo-sessions",
        {
          method: selectedId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Save failed.");
        return;
      }
      setNotice(selectedId ? "Session updated." : "Session created.");
      await load();
      if (data.session?.id) await loadDetail(data.session.id);
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId || !confirm("Delete this session and all registrations?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/demo-sessions/${selectedId}`, {
        method: "DELETE",
        credentials: "include",
      });
      resetForm();
      await load();
      setNotice("Session deleted.");
    } finally {
      setBusy(false);
    }
  };

  const announce = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/demo-sessions/${selectedId}/announce`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not publish announcement.");
        return;
      }
      setNotice("In-app announcement enabled with register CTA.");
    } catch {
      setError("Announce failed.");
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/demo-sessions/${selectedId}/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Email failed.");
        return;
      }
      setNotice(`Emailed ${data.sent} of ${data.total} registrants${data.failed ? ` (${data.failed} failed)` : ""}.`);
    } catch {
      setError("Email send failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async (s: SessionRow) => {
    const text = shareTextForDemo(
      s.title,
      s.slug,
      s.sessionAt ? new Date(s.sessionAt) : null
    );
    await navigator.clipboard.writeText(text);
    setNotice("Share text copied — paste into Instagram, Telegram, or WhatsApp.");
  };

  return (
    <div className="max-w-5xl">
      <AdminPageHeader
        title="Demo sessions"
        description="Create shareable registration forms for Zoom/Meet demos. Turn on Feature flags → Demo session registration when ready."
      />
      <div className="space-y-4">
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selectedId ? "Edit session" : "New session"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block text-xs text-muted-foreground">
                Demo name *
                <input
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!selectedId) setSlug(slugifyDemoTitle(e.target.value));
                  }}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                URL slug (/demo/…)
                <input
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900 font-mono text-xs"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Description
                <textarea
                  className="mt-1 w-full min-h-[80px] rounded border px-2 py-1.5 bg-white dark:bg-zinc-900"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Date &amp; time
                <input
                  type="datetime-local"
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={sessionAt}
                  onChange={(e) => setSessionAt(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Timezone
                <input
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Meeting URL (Zoom / Meet — emailed to registrants, not shown on public form)
                <input
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://zoom.us/j/…"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Platform
                <select
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={meetingPlatform}
                  onChange={(e) => setMeetingPlatform(e.target.value)}
                >
                  <option value="zoom">Zoom</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Location note
                <input
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Max attendees (optional)
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                Published (visible when feature flag is ON)
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={registrationOpen}
                  onChange={(e) => setRegistrationOpen(e.target.checked)}
                />
                Registration open
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy || !title.trim()} onClick={() => void save()}>
                  {busy ? "Saving…" : selectedId ? "Save changes" : "Create session"}
                </Button>
                {selectedId && (
                  <>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void announce()}>
                      Post in-app announcement
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                      New
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => void remove()}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
              {slug && (
                <p className="text-[11px] text-muted-foreground break-all">
                  Public link:{" "}
                  <a className="text-cyan-600 underline" href={publicDemoUrl(slug)} target="_blank" rel="noreferrer">
                    {publicDemoUrl(slug)}
                  </a>
                  {" · "}
                  <a className="underline" href={`${publicDemoUrl(slug)}?src=instagram`} target="_blank" rel="noreferrer">
                    ?src=instagram
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions yet.</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
                    >
                      <button type="button" className="text-left min-w-0" onClick={() => void loadDetail(s.id)}>
                        <p className="font-medium truncate">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.registrationCount} registered · {s.isPublished ? "Published" : "Draft"} · /{s.slug}
                        </p>
                      </button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void copyShare(s)}>
                        Copy share text
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {selectedId && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Email registrants ({regs.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <input
                    className="w-full h-9 rounded border px-2 text-sm bg-white dark:bg-zinc-900"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject"
                  />
                  <textarea
                    className="w-full min-h-[100px] rounded border px-2 py-1.5 text-sm bg-white dark:bg-zinc-900"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Meeting URL from the session is appended automatically when you send.
                  </p>
                  <Button type="button" size="sm" disabled={busy || regs.length === 0} onClick={() => void sendEmail()}>
                    Send email to all registrants
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {selectedId && regs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Registrations</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Phone</th>
                    <th className="py-2 pr-2">City</th>
                    <th className="py-2 pr-2">Country</th>
                    <th className="py-2 pr-2">Crypto</th>
                    <th className="py-2 pr-2">Forex</th>
                    <th className="py-2 pr-2">News</th>
                    <th className="py-2 pr-2">Promo</th>
                    <th className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-2">{r.name}</td>
                      <td className="py-1.5 pr-2">{r.email}</td>
                      <td className="py-1.5 pr-2">{r.phone || "—"}</td>
                      <td className="py-1.5 pr-2">{r.city || "—"}</td>
                      <td className="py-1.5 pr-2">{r.country || "—"}</td>
                      <td className="py-1.5 pr-2">{r.cryptoExperience || "—"}</td>
                      <td className="py-1.5 pr-2">{r.forexExperience || "—"}</td>
                      <td className="py-1.5 pr-2">{r.newsletterOptIn ? "Yes" : "No"}</td>
                      <td className="py-1.5 pr-2">{r.promoOptIn ? "Yes" : "No"}</td>
                      <td className="py-1.5">{r.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
