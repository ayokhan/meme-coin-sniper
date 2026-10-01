import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { checkGoHuntingRefreshLimit } from "@/lib/go-hunting-refresh-limit";
import {
  chainsForView,
  getChainRows,
  GO_HUNTING_CHAINS,
  isGoHuntingChain,
  isGoHuntingTabView,
  mergeChainRows,
  parseSurgeWindow,
  type GoHuntingChainFilter,
  type GoHuntingRow,
  type GoHuntingTabView,
} from "@/lib/go-hunting-multichain";
import type { GoHuntingChain } from "@/lib/go-hunting-views";

export const maxDuration = 60;

const VIEW_LABELS: Record<GoHuntingTabView, string> = {
  new_pairs: "New pairs",
  final_stretch: "Final Stretch",
  migrated: "Migrated",
  trending: "Trending",
  surge: "Surge",
};

const COUNT_WAIT_MS = 1500;

function rowLimit(view: GoHuntingTabView, isPaid: boolean): number {
  if (view === "trending") return isPaid ? 160 : 20;
  if (view === "surge") return 160;
  return isPaid ? 300 : 50;
}

/** Resolve within `ms` or give up (the fetch keeps warming the cache in the background). */
async function settleWithin<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewParam = searchParams.get("view");
    const view: GoHuntingTabView = isGoHuntingTabView(viewParam) ? viewParam : "new_pairs";
    const chainParam = searchParams.get("chain");
    const chain: GoHuntingChainFilter = isGoHuntingChain(chainParam) ? chainParam : "all";
    const window = parseSurgeWindow(searchParams.get("window"));

    const { isPaid } = await getSessionAndSubscription();
    if (view === "surge" && !isPaid) {
      return NextResponse.json({ success: false, error: "Subscribe to access Surge.", locked: true }, { status: 403 });
    }

    const limitCheck = await checkGoHuntingRefreshLimit(request);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: limitCheck.message,
          limitReached: true,
          retryAfterSeconds: limitCheck.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(limitCheck.retryAfterSeconds) } }
      );
    }

    const limit = rowLimit(view, isPaid);
    const selected = chainsForView(view, chain);
    const countable = chainsForView(view, "all");
    const fetches = new Map<GoHuntingChain, Promise<GoHuntingRow[]>>();
    for (const c of new Set([...selected, ...countable])) fetches.set(c, getChainRows(c, view, window));

    const perChain = await Promise.all(selected.map((c) => fetches.get(c)!));
    const tokens = mergeChainRows(view, perChain, limit);

    const chainCounts: Partial<Record<GoHuntingChain, number | null>> = {};
    await Promise.all(
      GO_HUNTING_CHAINS.map(async (c) => {
        const p = fetches.get(c);
        if (!p) return;
        const rows = selected.includes(c) ? await p : await settleWithin(p, COUNT_WAIT_MS);
        chainCounts[c] = rows ? Math.min(rows.length, limit) : null;
      })
    );

    const scope = chain === "all" ? (view === "final_stretch" ? "Solana + BSC" : "all chains") : chain;
    return NextResponse.json({
      success: true,
      tokens,
      view,
      chain,
      window,
      chainCounts,
      allCount: Math.min(limit, countable.reduce((sum, c) => sum + (chainCounts[c] ?? 0), 0)),
      description: `Go Hunting · ${VIEW_LABELS[view]} · ${scope}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Go Hunting failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
