import { LIVE_BOARD_IDS, normalizeBoardIds, type JobBoardId } from "@/lib/nova-job-agent/boards";

export type MatchedJob = {
  externalId: string;
  title: string;
  company: string;
  location: string;
  workType: string;
  url: string;
  source: JobBoardId;
  descriptionSnippet: string;
  score: number;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreJob(
  title: string,
  location: string,
  titleNeedles: string[],
  locNeedles: string[],
  remoteOk: boolean
): number {
  const t = normalize(title);
  const loc = normalize(location);
  let score = 0;
  if (titleNeedles.length === 0) score += 1;
  for (const n of titleNeedles) {
    if (t.includes(n) || n.split(" ").every((w) => w.length < 3 || t.includes(w))) score += 5;
    else if (n.split(" ").some((w) => w.length > 3 && t.includes(w))) score += 2;
  }
  if (locNeedles.length === 0 || remoteOk) {
    if (/worldwide|anywhere|remote|global/i.test(location || "")) score += 1;
  }
  for (const n of locNeedles) {
    if (loc.includes(n)) score += 3;
  }
  return score;
}

async function searchRemotive(args: {
  titleNeedles: string[];
  locNeedles: string[];
  remoteOk: boolean;
  limit: number;
}): Promise<MatchedJob[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs", { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      url: string;
      title: string;
      company_name: string;
      candidate_required_location: string;
      job_type: string;
      description: string;
    }>;
  };
  const out: MatchedJob[] = [];
  for (const job of data.jobs ?? []) {
    const score = scoreJob(
      job.title || "",
      job.candidate_required_location || "",
      args.titleNeedles,
      args.locNeedles,
      args.remoteOk
    );
    if (score <= 0) continue;
    out.push({
      externalId: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || "Remote",
      workType: job.job_type || "full_time",
      url: job.url,
      source: "remotive",
      descriptionSnippet: String(job.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
      score,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, args.limit);
}

async function searchRemoteOk(args: {
  titleNeedles: string[];
  locNeedles: string[];
  remoteOk: boolean;
  limit: number;
}): Promise<MatchedJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "NovaStaris-Jobs-Agent/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  const out: MatchedJob[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const job = row as Record<string, unknown>;
    if (!job.id || !job.position) continue;
    const title = String(job.position);
    const location = String(job.location || "Remote");
    const score = scoreJob(title, location, args.titleNeedles, args.locNeedles, args.remoteOk);
    if (score <= 0) continue;
    const id = String(job.id);
    const slug = String(job.slug || id);
    out.push({
      externalId: `remoteok-${id}`,
      title,
      company: String(job.company || "Company"),
      location,
      workType: Array.isArray(job.tags) && (job.tags as string[]).includes("contract") ? "contract" : "full_time",
      url: String(job.url || `https://remoteok.com/remote-jobs/${slug}`),
      source: "remoteok",
      descriptionSnippet: String(job.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
      score,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, args.limit);
}

async function searchArbeitnow(args: {
  titleNeedles: string[];
  locNeedles: string[];
  remoteOk: boolean;
  limit: number;
}): Promise<MatchedJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      slug: string;
      url: string;
      title: string;
      company_name: string;
      location: string;
      remote: boolean;
      description: string;
      job_types?: string[];
    }>;
  };
  const out: MatchedJob[] = [];
  for (const job of data.data ?? []) {
    const location = job.remote ? `Remote · ${job.location || ""}`.trim() : job.location || "";
    const score = scoreJob(job.title || "", location, args.titleNeedles, args.locNeedles, args.remoteOk);
    if (score <= 0) continue;
    if (!args.remoteOk && job.remote && args.locNeedles.length === 0) {
      /* still allow if title matches */
    }
    out.push({
      externalId: `arbeitnow-${job.slug}`,
      title: job.title,
      company: job.company_name,
      location: location || (job.remote ? "Remote" : "—"),
      workType: (job.job_types && job.job_types[0]) || "full_time",
      url: job.url,
      source: "arbeitnow",
      descriptionSnippet: String(job.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
      score,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, args.limit);
}

/** Search selected live boards and merge/dedupe by URL. */
export async function searchJobsAcrossBoards(args: {
  jobTitles: string[];
  city?: string | null;
  country?: string | null;
  region?: string | null;
  remoteOk: boolean;
  enabledBoards?: unknown;
  limit?: number;
}): Promise<MatchedJob[]> {
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 50);
  const titleNeedles = args.jobTitles.map(normalize).filter(Boolean);
  const locNeedles = [args.city, args.country, args.region]
    .map((x) => (x ? normalize(x) : ""))
    .filter(Boolean);

  const selected = normalizeBoardIds(args.enabledBoards).filter((id) =>
    (LIVE_BOARD_IDS as string[]).includes(id)
  );
  const boards = selected.length ? selected : [...LIVE_BOARD_IDS];
  const perBoard = Math.max(8, Math.ceil(limit / boards.length) + 4);

  const results = await Promise.all(
    boards.map(async (board) => {
      try {
        if (board === "remotive") {
          return await searchRemotive({
            titleNeedles,
            locNeedles,
            remoteOk: args.remoteOk,
            limit: perBoard,
          });
        }
        if (board === "remoteok") {
          return await searchRemoteOk({
            titleNeedles,
            locNeedles,
            remoteOk: args.remoteOk,
            limit: perBoard,
          });
        }
        if (board === "arbeitnow") {
          return await searchArbeitnow({
            titleNeedles,
            locNeedles,
            remoteOk: args.remoteOk,
            limit: perBoard,
          });
        }
      } catch {
        return [];
      }
      return [];
    })
  );

  const merged = results.flat();
  const byUrl = new Map<string, MatchedJob>();
  for (const job of merged) {
    const key = job.url || job.externalId;
    const prev = byUrl.get(key);
    if (!prev || job.score > prev.score) byUrl.set(key, job);
  }
  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((j) => ({
      externalId: j.externalId,
      title: j.title,
      company: j.company,
      location: j.location,
      workType: j.workType,
      url: j.url,
      source: j.source,
      descriptionSnippet: j.descriptionSnippet,
      score: j.score,
    }));
}

/** @deprecated use searchJobsAcrossBoards */
export async function searchRemotiveJobs(args: {
  jobTitles: string[];
  city?: string | null;
  country?: string | null;
  region?: string | null;
  remoteOk: boolean;
  limit?: number;
}): Promise<MatchedJob[]> {
  return searchJobsAcrossBoards({ ...args, enabledBoards: ["remotive"] });
}
