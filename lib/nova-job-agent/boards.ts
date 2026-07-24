export type JobBoardId =
  | "remotive"
  | "remoteok"
  | "arbeitnow"
  | "linkedin"
  | "indeed"
  | "wellfound"
  | "glassdoor";

export type JobBoardMeta = {
  id: JobBoardId;
  label: string;
  blurb: string;
  /** Live search via public API right now. */
  live: boolean;
};

export const JOB_BOARDS: JobBoardMeta[] = [
  {
    id: "remotive",
    label: "Remotive",
    blurb: "Remote-friendly roles (live search).",
    live: true,
  },
  {
    id: "remoteok",
    label: "RemoteOK",
    blurb: "Remote tech & ops roles (live search).",
    live: true,
  },
  {
    id: "arbeitnow",
    label: "Arbeitnow",
    blurb: "European & remote listings (live search).",
    live: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    blurb: "Coming soon — open job URL to apply manually.",
    live: false,
  },
  {
    id: "indeed",
    label: "Indeed",
    blurb: "Coming soon — open job URL to apply manually.",
    live: false,
  },
  {
    id: "wellfound",
    label: "Wellfound",
    blurb: "Coming soon — startup roles (manual apply).",
    live: false,
  },
  {
    id: "glassdoor",
    label: "Glassdoor",
    blurb: "Coming soon — manual apply via job URL.",
    live: false,
  },
];

export const LIVE_BOARD_IDS: JobBoardId[] = JOB_BOARDS.filter((b) => b.live).map((b) => b.id);

export const DEFAULT_ENABLED_BOARDS: JobBoardId[] = ["remotive", "remoteok", "arbeitnow"];

export function normalizeBoardIds(raw: unknown): JobBoardId[] {
  const allowed = new Set(JOB_BOARDS.map((b) => b.id));
  const list = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  const out = list.filter((id): id is JobBoardId => allowed.has(id as JobBoardId));
  return out.length ? out : [...DEFAULT_ENABLED_BOARDS];
}

export function boardLabel(id: string): string {
  return JOB_BOARDS.find((b) => b.id === id)?.label ?? id;
}
