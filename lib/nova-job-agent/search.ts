export type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location: string;
  job_type: string;
  description: string;
  publication_date: string;
};

export type MatchedJob = {
  externalId: string;
  title: string;
  company: string;
  location: string;
  workType: string;
  url: string;
  source: "remotive";
  descriptionSnippet: string;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Search Remotive remote jobs and filter by title keywords / location prefs. */
export async function searchRemotiveJobs(args: {
  jobTitles: string[];
  city?: string | null;
  country?: string | null;
  region?: string | null;
  remoteOk: boolean;
  limit?: number;
}): Promise<MatchedJob[]> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 40);
  const res = await fetch("https://remotive.com/api/remote-jobs", {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Remotive API error (${res.status}).`);
  const data = (await res.json()) as { jobs?: RemotiveJob[] };
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  const titleNeedles = args.jobTitles.map(normalize).filter(Boolean);
  const locNeedles = [args.city, args.country, args.region]
    .map((x) => (x ? normalize(x) : ""))
    .filter(Boolean);

  const scored: { job: RemotiveJob; score: number }[] = [];
  for (const job of jobs) {
    const title = normalize(job.title || "");
    const loc = normalize(job.candidate_required_location || "");
    let score = 0;
    if (titleNeedles.length === 0) score += 1;
    for (const n of titleNeedles) {
      if (title.includes(n) || n.split(" ").every((w) => w.length < 3 || title.includes(w))) {
        score += 5;
      } else if (n.split(" ").some((w) => w.length > 3 && title.includes(w))) {
        score += 2;
      }
    }
    if (locNeedles.length === 0 || args.remoteOk) {
      if (/worldwide|anywhere|remote/i.test(job.candidate_required_location || "")) score += 1;
    }
    for (const n of locNeedles) {
      if (loc.includes(n)) score += 3;
    }
    if (score > 0) scored.push({ job, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ job }) => ({
    externalId: `remotive-${job.id}`,
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location || "Remote",
    workType: job.job_type || "full_time",
    url: job.url,
    source: "remotive" as const,
    descriptionSnippet: String(job.description || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600),
  }));
}
