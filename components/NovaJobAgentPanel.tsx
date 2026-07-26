"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Download, FileText, Loader2, RefreshCw, Rocket, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  JOB_BOARDS,
  DEFAULT_ENABLED_BOARDS,
  boardLabel,
} from "@/lib/nova-job-agent/boards";
import {
  JOB_REGIONS,
  countriesForRegion,
  citiesForCountry,
  regionForCountry,
} from "@/lib/nova-job-agent/locations";

type Profile = {
  jobTitles: string[];
  city: string | null;
  country: string | null;
  region: string | null;
  remoteOk: boolean;
  workTypes: string[];
  enabledBoards: string[];
  autoApplyEnabled: boolean;
  targetApplicationsPerDay: number;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
};

type Resume = {
  id: string;
  fileName: string | null;
  fileUrl: string | null;
  contentText: string;
  version: number;
  createdAt: string;
};

type Dashboard = {
  total: number;
  applied: number;
  prepared: number;
  queued: number;
  failed: number;
  skipped: number;
  recent: Array<{
    id: string;
    jobTitle: string;
    company: string;
    location: string | null;
    workType: string | null;
    jobUrl: string | null;
    source: string;
    status: string;
    appliedAt: string | null;
    createdAt: string;
  }>;
};

type MatchedJob = {
  externalId: string;
  title: string;
  company: string;
  location: string;
  workType: string;
  url: string;
  source: string;
  descriptionSnippet: string;
};

const WORK_TYPE_OPTIONS = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "internship", label: "Internship" },
] as const;

const emptyProfile: Profile = {
  jobTitles: [],
  city: "",
  country: "",
  region: "",
  remoteOk: true,
  workTypes: ["full_time"],
  enabledBoards: [...DEFAULT_ENABLED_BOARDS],
  autoApplyEnabled: false,
  targetApplicationsPerDay: 10,
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  notes: "",
};

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function NovaJobAgentPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [titlesInput, setTitlesInput] = useState("");
  const [resume, setResume] = useState<Resume | null>(null);
  const [resumeDraft, setResumeDraft] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [jobs, setJobs] = useState<MatchedJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [tunedResumePreview, setTunedResumePreview] = useState<string | null>(null);
  const [lastOpenedJobUrl, setLastOpenedJobUrl] = useState<string | null>(null);
  const [pasteJobTitle, setPasteJobTitle] = useState("");
  const [pasteCompany, setPasteCompany] = useState("");
  const [pasteJd, setPasteJd] = useState("");
  const [pasteJobUrl, setPasteJobUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-job-agent", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load Nova Jobs Agent.");
        return;
      }
      const p = data.profile as Profile;
      const countryRaw = p.country ?? "";
      const matchedCountry =
        countriesForRegion(null).find((c) => c.name.toLowerCase() === countryRaw.toLowerCase())?.name ||
        countryRaw;
      const regionRaw = p.region || regionForCountry(matchedCountry) || "";
      const cityRaw = p.city ?? "";
      const cities = citiesForCountry(matchedCountry);
      const matchedCity =
        cities.find((c) => c.toLowerCase() === cityRaw.toLowerCase()) || cityRaw;
      setProfile({
        ...emptyProfile,
        ...p,
        city: matchedCity,
        country: matchedCountry,
        region: regionRaw,
        notes: p.notes ?? "",
        contactEmail: p.contactEmail ?? "",
        contactName: p.contactName ?? "",
        contactPhone: p.contactPhone ?? "",
        enabledBoards: Array.isArray(p.enabledBoards) && p.enabledBoards.length
          ? p.enabledBoards
          : [...DEFAULT_ENABLED_BOARDS],
      });
      if ((p.jobTitles?.[0] || "").trim()) {
        setSearchQuery((prev) => prev || String(p.jobTitles[0]));
      }
      setTitlesInput((p.jobTitles ?? []).join(", "));
      setResume(data.resume);
      setResumeDraft(data.resume?.contentText ?? "");
      setDashboard(data.dashboard);
    } catch {
      setError("Network error loading Nova Jobs Agent.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePrefs = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const jobTitles = titlesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/nova-job-agent", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitles,
          city: profile.city || null,
          country: profile.country || null,
          region: profile.region || null,
          remoteOk: profile.remoteOk,
          workTypes: profile.workTypes,
          enabledBoards: profile.enabledBoards,
          autoApplyEnabled: profile.autoApplyEnabled,
          targetApplicationsPerDay: profile.targetApplicationsPerDay,
          contactEmail: profile.contactEmail || null,
          contactName: profile.contactName || null,
          contactPhone: profile.contactPhone || null,
          notes: profile.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not save preferences.");
        return;
      }
      setNotice("Preferences saved.");
      setProfile((prev) => ({
        ...prev,
        ...data.profile,
        city: data.profile.city ?? "",
        country: data.profile.country ?? "",
        region: data.profile.region ?? "",
        notes: data.profile.notes ?? "",
        contactEmail: data.profile.contactEmail ?? "",
        contactName: data.profile.contactName ?? "",
        contactPhone: data.profile.contactPhone ?? "",
        enabledBoards:
          Array.isArray(data.profile.enabledBoards) && data.profile.enabledBoards.length
            ? data.profile.enabledBoards
            : [...DEFAULT_ENABLED_BOARDS],
      }));
      setTitlesInput((data.profile.jobTitles ?? []).join(", "));
    } catch {
      setError("Network error saving preferences.");
    } finally {
      setSaving(false);
    }
  };

  const saveResume = async (improve: boolean) => {
    setBusy(improve ? "improve" : "resume");
    setError(null);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = { contentText: resumeDraft, improve };
      if (improve) {
        const selected = jobs.filter((j) => selectedJobIds.has(j.externalId));
        if (selected.length === 0) {
          setError(
            "Select a job under Find & apply (or use Paste job description below) so AI can tailor your resume to that JD."
          );
          setBusy(null);
          return;
        }
        const primary = selected[0];
        payload.jobTitle = primary.title;
        payload.company = primary.company;
        payload.jobDescription = selected
          .slice(0, 3)
          .map(
            (j) =>
              `${j.title} @ ${j.company}\n${j.descriptionSnippet || "(no description snippet)"}`
          )
          .join("\n\n---\n\n");
      }
      const res = await fetch("/api/nova-job-agent/resume", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not save resume.");
        return;
      }
      setResume(data.resume);
      setResumeDraft(data.resume.contentText);
      if (improve) {
        const selected = jobs.filter((j) => selectedJobIds.has(j.externalId));
        const primary = selected[0];
        setNotice(
          selected.length > 1
            ? `Base resume updated (v${data.resume.version}) using ${selected.length} selected jobs (primary: ${primary.title} @ ${primary.company}). For per-job cover letters use Prepare selected.`
            : `Base resume tailored to ${primary.title} @ ${primary.company} (v${data.resume.version}).`
        );
      } else {
        setNotice(`Resume saved (v${data.resume.version}).`);
      }
    } catch {
      setError("Network error saving resume.");
    } finally {
      setBusy(null);
    }
  };

  const prepareFromPastedJd = async () => {
    const jobTitle = pasteJobTitle.trim();
    const company = pasteCompany.trim();
    const jobDescription = pasteJd.trim();
    if (!jobTitle || !company) {
      setError("Enter job title and company for the pasted job description.");
      return;
    }
    if (!jobDescription || jobDescription.length < 40) {
      setError("Paste a fuller job description (at least a few sentences) so Nova can align your materials.");
      return;
    }
    if (!resumeDraft.trim() && !resume?.contentText) {
      setError("Save a base resume first, then paste a JD to generate a tuned copy + cover letter.");
      return;
    }
    setBusy("paste-jd");
    setError(null);
    setNotice(null);
    try {
      // Ensure latest draft is saved as active base before tuning
      if (resumeDraft.trim() && resumeDraft !== (resume?.contentText ?? "")) {
        const saveRes = await fetch("/api/nova-job-agent/resume", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentText: resumeDraft, improve: false }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok || !saveData.success) {
          setError(saveData.error || "Could not save resume before generating materials.");
          return;
        }
        setResume(saveData.resume);
        setResumeDraft(saveData.resume.contentText);
      }
      const res = await fetch("/api/nova-job-agent/applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          company,
          jobUrl: pasteJobUrl.trim() || undefined,
          source: "pasted_jd",
          externalId: `pasted-${Date.now()}`,
          jobDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Could not generate tuned resume + cover letter.");
        return;
      }
      setCoverPreview(data.application.coverLetter);
      setTunedResumePreview(data.application.resumeSnapshot || null);
      if (data.application.jobUrl) setLastOpenedJobUrl(data.application.jobUrl);
      setNotice(
        `Tuned resume + cover letter ready for ${company}. Download below, then submit on the employer site.`
      );
      await load();
    } catch {
      setError("Failed to generate materials from pasted JD.");
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/nova-job-agent/resume", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Upload failed.");
        return;
      }
      setResume(data.resume);
      setResumeDraft(data.resume.contentText);
      const found = String(data.resume.contentText || "").match(
        /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
      );
      if (found?.[0] && !(profile.contactEmail || "").trim()) {
        setProfile((p) => ({ ...p, contactEmail: found[0].toLowerCase() }));
        setNotice(
          `Resume uploaded from ${file.name} (v${data.resume.version}). Detected email ${found[0]} — save preferences to keep it.`
        );
      } else {
        setNotice(`Resume uploaded from ${file.name} (v${data.resume.version}).`);
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const searchJobs = async () => {
    setBusy("search");
    setError(null);
    try {
      const qs = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : "";
      const res = await fetch(`/api/nova-job-agent/search${qs}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Search failed.");
        return;
      }
      const list = (data.jobs ?? []) as MatchedJob[];
      setJobs(list);
      setSelectedJobIds(new Set(list.map((j) => j.externalId)));
      setNotice(
        list.length
          ? `Found ${list.length} matching roles. Uncheck any you don’t want, then Prepare selected.`
          : "No matching roles on live boards for that search/location."
      );
    } catch {
      setError("Search network error.");
    } finally {
      setBusy(null);
    }
  };

  const prepareJob = async (job: MatchedJob) => {
    setBusy(`prep-${job.externalId}`);
    setError(null);
    try {
      const res = await fetch("/api/nova-job-agent/applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          workType: job.workType,
          jobUrl: job.url,
          source: job.source || "remotive",
          externalId: job.externalId,
          jobDescription: job.descriptionSnippet,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Could not prepare application.");
        return;
      }
      setCoverPreview(data.application.coverLetter);
      setTunedResumePreview(data.application.resumeSnapshot || null);
      if (data.application.jobUrl) setLastOpenedJobUrl(data.application.jobUrl);
      setNotice(
        `Materials ready for ${job.company}. Click “Open job posting” to submit on the board, then mark Applied.`
      );
      await load();
    } catch {
      setError("Prepare failed — try one job at a time.");
    } finally {
      setBusy(null);
    }
  };

  const runAutoApply = async () => {
    const selected = jobs.filter((j) => selectedJobIds.has(j.externalId));
    if (selected.length === 0) {
      setError("Search jobs first, then select at least one role to prepare.");
      return;
    }
    setBusy("auto");
    setError(null);
    setNotice(null);
    let okCount = 0;
    let lastUrl: string | null = null;
    try {
      // One job per request — avoids gateway timeouts from multi-job AI.
      for (let i = 0; i < selected.length; i++) {
        const j = selected[i];
        setNotice(`Preparing ${i + 1} of ${selected.length}: ${j.title}…`);
        const res = await fetch("/api/nova-job-agent/auto-apply", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobs: [
              {
                externalId: j.externalId,
                title: j.title,
                company: j.company,
                location: j.location,
                workType: j.workType,
                url: j.url,
                source: j.source,
                descriptionSnippet: j.descriptionSnippet,
              },
            ],
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setError(
            data.error ||
              `Stopped after ${okCount} prepared (server error on “${j.title}”). Open prepared jobs from the dashboard.`
          );
          break;
        }
        okCount += data.created?.length ?? 0;
        const url = data.created?.[0]?.jobUrl || data.application?.jobUrl || j.url;
        if (url) lastUrl = url;
      }
      if (lastUrl) setLastOpenedJobUrl(lastUrl);
      if (okCount > 0) {
        setNotice(
          `Prepared ${okCount} application(s). Open each job posting link, submit on the board, then mark Applied in the dashboard.`
        );
      }
      await load();
    } catch {
      setError(
        okCount > 0
          ? `Prepared ${okCount} before a network timeout. Refresh — check the dashboard for Open job posting links.`
          : "Prepare timed out. Try preparing one job at a time with “Tune + cover”."
      );
      await load();
    } finally {
      setBusy(null);
    }
  };

  const toggleJobSelected = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllJobs = () => setSelectedJobIds(new Set(jobs.map((j) => j.externalId)));
  const deselectAllJobs = () => setSelectedJobIds(new Set());

  const setStatus = async (applicationId: string, status: string) => {
    setBusy(`status-${applicationId}`);
    try {
      await fetch("/api/nova-job-agent/applications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const toggleWorkType = (id: string) => {
    setProfile((p) => {
      const has = p.workTypes.includes(id);
      const workTypes = has ? p.workTypes.filter((x) => x !== id) : [...p.workTypes, id];
      return { ...p, workTypes: workTypes.length ? workTypes : ["full_time"] };
    });
  };

  const toggleBoard = (id: string) => {
    setProfile((p) => {
      const has = p.enabledBoards.includes(id);
      const enabledBoards = has
        ? p.enabledBoards.filter((x) => x !== id)
        : [...p.enabledBoards, id];
      return {
        ...p,
        enabledBoards: enabledBoards.length ? enabledBoards : [...DEFAULT_ENABLED_BOARDS],
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Nova Jobs Agent…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-cyan-600" /> Nova Jobs Agent
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          How it works: (1) Save preferences + resume (2) Search jobs (3) Prepare materials — we tune your resume and
          write a cover letter (4) Click <strong>Open job posting</strong> and submit on that board yourself. We do not
          yet click Apply on LinkedIn/Indeed for you.
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          {notice}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Applied", value: dashboard?.applied ?? 0 },
          { label: "Prepared", value: dashboard?.prepared ?? 0 },
          { label: "Queued", value: dashboard?.queued ?? 0 },
          { label: "Total tracked", value: dashboard?.total ?? 0 },
        ].map((s) => (
          <Card key={s.label} className="border-zinc-200 dark:border-zinc-800">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Job preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Job titles (comma-separated)</label>
            <input
              className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
              placeholder="Project Manager, Product Manager"
              value={titlesInput}
              onChange={(e) => setTitlesInput(e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Region</label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                value={profile.region || ""}
                onChange={(e) => {
                  const region = e.target.value;
                  setProfile((p) => {
                    const countries = countriesForRegion(region || null);
                    const countryStillValid = countries.some((c) => c.name === p.country);
                    return {
                      ...p,
                      region,
                      country: countryStillValid ? p.country : "",
                      city: countryStillValid ? p.city : "",
                    };
                  });
                }}
              >
                <option value="">Select region</option>
                {JOB_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Country</label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                value={profile.country || ""}
                onChange={(e) => {
                  const country = e.target.value;
                  const region = regionForCountry(country);
                  setProfile((p) => ({
                    ...p,
                    country,
                    region: region || p.region,
                    city: "",
                  }));
                }}
              >
                <option value="">Select country</option>
                {countriesForRegion(profile.region).map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">City</label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                value={profile.city || ""}
                onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                disabled={!profile.country}
              >
                <option value="">{profile.country ? "Any / select city" : "Select country first"}</option>
                {citiesForCountry(profile.country).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Contact for employers</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                This email is put on tuned resumes and cover letters. Employers do not see your NovaStaris login unless
                you use the same address here. Priority: this field → email found in resume → account email.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Full name</label>
                <input
                  className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                  value={profile.contactName ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, contactName: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Email employers should see</label>
                <input
                  type="email"
                  className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                  value={profile.contactEmail ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, contactEmail: e.target.value }))}
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Phone (optional)</label>
                <input
                  className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                  value={profile.contactPhone ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, contactPhone: e.target.value }))}
                  placeholder="+1 …"
                />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.remoteOk}
              onChange={(e) => setProfile((p) => ({ ...p, remoteOk: e.target.checked }))}
            />
            Include remote / worldwide roles
          </label>
          <div className="flex flex-wrap gap-3">
            {WORK_TYPE_OPTIONS.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.workTypes.includes(w.id)}
                  onChange={() => toggleWorkType(w.id)}
                />
                {w.label}
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Job boards</label>
            <div className="mt-2 space-y-2">
              {JOB_BOARDS.map((b) => (
                <label
                  key={b.id}
                  className={`flex items-start gap-2 text-sm ${b.live ? "" : "opacity-80"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={profile.enabledBoards.includes(b.id)}
                    onChange={() => toggleBoard(b.id)}
                  />
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
                      {b.label}
                      {!b.live && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Soon
                        </span>
                      )}
                    </span>
                    <span
                      className={`block text-xs ${
                        b.live
                          ? "text-muted-foreground"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {b.blurb}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Applications per day (target)</label>
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                value={profile.targetApplicationsPerDay}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    targetApplicationsPerDay: Number(e.target.value) || 10,
                  }))
                }
              />
            </div>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={profile.autoApplyEnabled}
                onChange={(e) => setProfile((p) => ({ ...p, autoApplyEnabled: e.target.checked }))}
              />
              <span>
                Legacy flag (unused for board submit). Prepared apps stay <em>prepared</em> until you mark Applied after
                submitting on the job site.
              </span>
            </label>
          </div>
          <div>
            <label className="text-xs font-medium">Notes for AI (optional)</label>
            <textarea
              className="mt-1 w-full min-h-[70px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={profile.notes ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Emphasize PMP, agile delivery, stakeholder management…"
            />
          </div>
          <Button type="button" onClick={() => void savePrefs()} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Resume
            {resume ? <span className="text-xs font-normal text-muted-foreground">v{resume.version}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <Upload className="h-4 w-4" />
              Upload PDF / Word / text
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {resume?.fileUrl && (
              <a href={resume.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-600 underline">
                Original file
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Base resume is saved here. <strong>AI adjust</strong> rewrites this base using the{" "}
            <em>selected</em> job description(s) below. <strong>Prepare selected</strong> /{" "}
            <strong>Paste JD</strong> create a separate tuned resume + cover letter per application without
            replacing your base (unless you choose AI adjust).
          </p>
          <textarea
            className="w-full min-h-[220px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
            value={resumeDraft}
            onChange={(e) => setResumeDraft(e.target.value)}
            placeholder="Paste resume text here…"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveResume(false)} disabled={!!busy || !resumeDraft.trim()}>
              {busy === "resume" ? "Saving…" : "Save resume"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void saveResume(true)}
              disabled={!!busy || !resumeDraft.trim()}
              title="Select one or more jobs under Find & apply first"
            >
              {busy === "improve" ? "Tailoring…" : "AI adjust to selected job"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!resumeDraft.trim()}
              onClick={() =>
                downloadTextFile(
                  `nova-jobs-resume-v${resume?.version ?? 1}.txt`,
                  resumeDraft
                )
              }
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download resume
            </Button>
          </div>
          {selectedJobIds.size === 0 ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Select a job under Find &amp; apply before using AI adjust, or paste a JD in the section below for
              resume + cover letter.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {selectedJobIds.size} job{selectedJobIds.size === 1 ? "" : "s"} selected for AI adjust.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Paste job description</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Paste any JD (LinkedIn, company site, email). Nova Agent tunes a copy of your resume and writes a cover
            letter. Your base resume stays unchanged.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Job title</label>
              <input
                className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                value={pasteJobTitle}
                onChange={(e) => setPasteJobTitle(e.target.value)}
                placeholder="e.g. Product Manager"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Company</label>
              <input
                className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
                value={pasteCompany}
                onChange={(e) => setPasteCompany(e.target.value)}
                placeholder="e.g. Acme Health"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Job posting URL (optional)</label>
            <input
              className="mt-1 w-full h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
              value={pasteJobUrl}
              onChange={(e) => setPasteJobUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Job description</label>
            <textarea
              className="mt-1 w-full min-h-[160px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={pasteJd}
              onChange={(e) => setPasteJd(e.target.value)}
              placeholder="Paste the full job description here…"
            />
          </div>
          <Button
            type="button"
            onClick={() => void prepareFromPastedJd()}
            disabled={!!busy || !pasteJd.trim() || !pasteJobTitle.trim() || !pasteCompany.trim()}
          >
            {busy === "paste-jd" ? "Generating…" : "Generate tuned resume + cover letter"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Find & apply</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Search finds roles on live boards. Prepare creates a tuned resume + cover letter. You still open the job
            posting link to submit on Remotive / RemoteOK / etc.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
              placeholder="Search jobs… e.g. Product Manager"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchJobs();
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void searchJobs()} disabled={!!busy}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {busy === "search" ? "Searching…" : "Search"}
              </Button>
              <Button type="button" size="sm" onClick={() => void runAutoApply()} disabled={!!busy}>
                <Rocket className="h-3.5 w-3.5 mr-1" />
                {busy === "auto"
                  ? "Preparing…"
                  : `Prepare selected${selectedJobIds.size ? ` (${selectedJobIds.size})` : ""}`}
              </Button>
            </div>
          </div>
          {lastOpenedJobUrl && (
            <a
              href={lastOpenedJobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-medium text-cyan-700 dark:text-cyan-300 underline"
            >
              Open last prepared job posting →
            </a>
          )}
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Type a role in the search box (or use saved job titles), set country/city, then Search.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  {selectedJobIds.size} of {jobs.length} selected
                </span>
                <button type="button" className="underline text-cyan-700 dark:text-cyan-300" onClick={selectAllJobs}>
                  Select all
                </button>
                <button type="button" className="underline text-cyan-700 dark:text-cyan-300" onClick={deselectAllJobs}>
                  Deselect all
                </button>
              </div>
              <ul className="space-y-2">
                {jobs.map((j) => (
                  <li
                    key={j.externalId}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
                  >
                    <label className="flex items-start gap-3 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedJobIds.has(j.externalId)}
                        onChange={() => toggleJobSelected(j.externalId)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{j.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {j.company} · {j.location} · {j.workType}
                        </p>
                        <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {boardLabel(j.source)}
                        </span>
                      </div>
                    </label>
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={j.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center rounded-md border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-medium"
                        onClick={() => setLastOpenedJobUrl(j.url)}
                      >
                        Open job posting
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!!busy}
                        onClick={() => void prepareJob(j)}
                      >
                        {busy === `prep-${j.externalId}` ? "…" : "Tune + cover"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tunedResumePreview && (
            <div className="rounded-lg border border-zinc-300 dark:border-zinc-600 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Latest JD-tuned resume</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadTextFile("nova-jobs-tuned-resume.txt", tunedResumePreview)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download tuned resume
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 font-sans max-h-48 overflow-y-auto">
                {tunedResumePreview}
              </pre>
            </div>
          )}
          {coverPreview && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-200">Latest cover letter</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadTextFile("nova-jobs-cover-letter.txt", coverPreview)
                  }
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download cover letter
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 font-sans">{coverPreview}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Application dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          {!dashboard?.recent?.length ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-2">Role</th>
                    <th className="py-2 pr-2">Company</th>
                    <th className="py-2 pr-2">Source</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-2">{a.jobTitle}</td>
                      <td className="py-2 pr-2">{a.company}</td>
                      <td className="py-2 pr-2">{boardLabel(a.source)}</td>
                      <td className="py-2 pr-2 capitalize">{a.status}</td>
                      <td className="py-2 space-x-2 whitespace-nowrap">
                        {a.jobUrl && (
                          <a
                            href={a.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-600 underline text-xs font-medium"
                            onClick={() => {
                              if (a.jobUrl) setLastOpenedJobUrl(a.jobUrl);
                            }}
                          >
                            Open job posting
                          </a>
                        )}
                        {a.status !== "applied" && (
                          <button
                            type="button"
                            className="text-xs text-emerald-700 dark:text-emerald-300 underline"
                            onClick={() => void setStatus(a.id, "applied")}
                          >
                            Mark applied
                          </button>
                        )}
                        {a.status !== "skipped" && (
                          <button
                            type="button"
                            className="text-xs text-zinc-500 underline"
                            onClick={() => void setStatus(a.id, "skipped")}
                          >
                            Skip
                          </button>
                        )}
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
