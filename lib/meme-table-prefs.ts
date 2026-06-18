export type MemeTableSortKey =
  | "score"
  | "age"
  | "liquidity"
  | "volume24h"
  | "pct5m"
  | "pct1h"
  | "pct6h"
  | "pct24h"
  | "price";

export type MemeTableSortDir = "asc" | "desc";

const LS_KEY = "novastaris-meme-table-sort";

export function loadMemeTableSort(): { key: MemeTableSortKey; dir: MemeTableSortDir } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { key: "age", dir: "desc" };
    const parsed = JSON.parse(raw) as { key?: MemeTableSortKey; dir?: MemeTableSortDir };
    const key = parsed.key ?? "age";
    const dir = parsed.dir === "asc" ? "asc" : "desc";
    return { key, dir };
  } catch {
    return { key: "age", dir: "desc" };
  }
}

export function saveMemeTableSort(key: MemeTableSortKey, dir: MemeTableSortDir): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ key, dir }));
  } catch {
    /* ignore */
  }
}

export type MemeSortableToken = {
  viralScore: number;
  launchedAt: string;
  liquidity: number | null;
  volume24h?: number | null;
  priceUSD: number | null;
  pct5m?: number | null;
  pct1h?: number | null;
  pct6h?: number | null;
  pct24h?: number | null;
  txnsBuys24h?: number | null;
  txnsSells24h?: number | null;
};

export function sortMemeTokens<T extends MemeSortableToken>(
  tokens: T[],
  key: MemeTableSortKey,
  dir: MemeTableSortDir
): T[] {
  const mul = dir === "asc" ? 1 : -1;
  const num = (v: number | null | undefined, missing = dir === "asc" ? Infinity : -Infinity) =>
    v == null || Number.isNaN(v) ? missing : v;

  return [...tokens].sort((a, b) => {
    let av = 0;
    let bv = 0;
    switch (key) {
      case "score":
        av = a.viralScore;
        bv = b.viralScore;
        break;
      case "age":
        av = new Date(a.launchedAt).getTime();
        bv = new Date(b.launchedAt).getTime();
        break;
      case "liquidity":
        av = num(a.liquidity);
        bv = num(b.liquidity);
        break;
      case "volume24h":
        av = num(a.volume24h);
        bv = num(b.volume24h);
        break;
      case "pct5m":
        av = num(a.pct5m);
        bv = num(b.pct5m);
        break;
      case "pct1h":
        av = num(a.pct1h);
        bv = num(b.pct1h);
        break;
      case "pct6h":
        av = num(a.pct6h);
        bv = num(b.pct6h);
        break;
      case "pct24h":
        av = num(a.pct24h);
        bv = num(b.pct24h);
        break;
      case "price":
        av = num(a.priceUSD);
        bv = num(b.priceUSD);
        break;
      default:
        break;
    }
    return (av - bv) * mul;
  });
}
