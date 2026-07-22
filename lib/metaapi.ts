/**
 * MetaAPI (metaapi.cloud) REST client — MT4/MT5 account provisioning + trading.
 * Docs: https://metaapi.cloud/docs/provisioning/ and https://metaapi.cloud/docs/client/
 * Requires METAAPI_TOKEN (account access token from MetaAPI dashboard).
 */
import crypto from "crypto";

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

function region(): string {
  return process.env.METAAPI_REGION?.trim() || "new-york";
}

function clientBase(): string {
  return `https://mt-client-api-v1.${region()}.agiliumtrade.ai`;
}

export function isMetaApiConfigured(): boolean {
  return !!process.env.METAAPI_TOKEN;
}

function getToken(): string {
  const token = process.env.METAAPI_TOKEN;
  if (!token) throw new Error("METAAPI_TOKEN not set. Required for MetaAPI (MT4/MT5) accounts.");
  return token;
}

function transactionId(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function metaApiFetch<T>(
  url: string,
  init: RequestInit & { includeTransactionId?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "auth-token": getToken(),
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.includeTransactionId) {
    headers["transaction-id"] = transactionId();
  }
  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) {
    const message =
      (json as { message?: string })?.message ||
      (typeof json === "string" ? json : null) ||
      `MetaAPI request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

export type MetaApiPlatform = "mt4" | "mt5";

export type CreateMetaApiAccountInput = {
  login: string;
  password: string;
  server: string;
  platform: MetaApiPlatform;
  name?: string;
  magic?: number;
};

/** Optional shared MetaAPI provisioning profile (when broker .dat is not in MetaAPI's known list). */
function provisioningProfileId(platform: MetaApiPlatform): string | undefined {
  const key =
    platform === "mt4"
      ? process.env.METAAPI_PROVISIONING_PROFILE_MT4
      : process.env.METAAPI_PROVISIONING_PROFILE_MT5;
  const id = key?.trim();
  return id || undefined;
}

/** Provision a new MetaAPI trading account (links a broker MT4/MT5 login to MetaAPI cloud). */
export async function createMetaApiAccount(
  input: CreateMetaApiAccountInput
): Promise<{ id: string }> {
  const profileId = provisioningProfileId(input.platform);
  const body: Record<string, unknown> = {
    login: input.login,
    password: input.password,
    server: input.server,
    platform: input.platform,
    name: input.name || `NovaStaris-${input.platform.toUpperCase()}-${Date.now()}`,
    magic: input.magic ?? 0,
    type: "cloud-g2",
    riskManagementApiEnabled: false,
  };
  if (profileId) body.provisioningProfileId = profileId;
  return metaApiFetch<{ id: string }>(`${PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    body: JSON.stringify(body),
    includeTransactionId: true,
  });
}

/** Fuzzy search MetaAPI's known MT servers (helps when .dat / server name is wrong). */
export async function searchKnownMtServers(
  platform: MetaApiPlatform,
  query: string
): Promise<Record<string, string[]>> {
  const version = platform === "mt4" ? 4 : 5;
  const q = encodeURIComponent(query.trim());
  if (!q) return {};
  try {
    return await metaApiFetch<Record<string, string[]>>(
      `${PROVISIONING_BASE}/known-mt-servers/${version}/search?query=${q}`,
      { method: "GET" }
    );
  } catch {
    return {};
  }
}

/** Flatten known-server search into a short unique list for UI hints. */
export function flattenKnownServerSuggestions(
  byBroker: Record<string, string[]>,
  limit = 12
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const servers of Object.values(byBroker)) {
    for (const s of servers ?? []) {
      const name = String(s).trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export type MetaApiAccount = {
  id: string;
  login?: string;
  server?: string;
  platform?: string;
  state?: string;
  connectionStatus?: string;
  [key: string]: unknown;
};

export async function getMetaApiAccount(accountId: string): Promise<MetaApiAccount> {
  return metaApiFetch<MetaApiAccount>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    method: "GET",
  });
}

export async function deployMetaApiAccount(accountId: string): Promise<void> {
  await metaApiFetch<unknown>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}/deploy`, {
    method: "POST",
  });
}

export async function undeployMetaApiAccount(accountId: string): Promise<void> {
  await metaApiFetch<unknown>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}/undeploy`, {
    method: "POST",
  });
}

export async function deleteMetaApiAccount(accountId: string): Promise<void> {
  await metaApiFetch<unknown>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    method: "DELETE",
  });
}

export type MetaApiAccountInformation = {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  [key: string]: unknown;
};

export type MetaApiFetchResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getMetaApiAccountInformation(
  accountId: string
): Promise<MetaApiAccountInformation | null> {
  const res = await getMetaApiAccountInformationDetailed(accountId);
  return res.ok ? res.data : null;
}

export async function getMetaApiAccountInformationDetailed(
  accountId: string
): Promise<MetaApiFetchResult<MetaApiAccountInformation>> {
  try {
    const data = await metaApiFetch<MetaApiAccountInformation>(
      `${clientBase()}/users/current/accounts/${accountId}/account-information`,
      { method: "GET" }
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load account information" };
  }
}

/** Deploy if needed and wait until MetaAPI reports the account is connected (or timeout). */
export async function ensureMetaApiAccountReady(
  accountId: string,
  maxWaitMs = 20000
): Promise<{ ready: boolean; state?: string; connectionStatus?: string; error?: string }> {
  const started = Date.now();
  let lastState = "";
  let lastConn = "";
  try {
    while (Date.now() - started < maxWaitMs) {
      const acc = await getMetaApiAccount(accountId);
      lastState = String(acc.state ?? "");
      lastConn = String(acc.connectionStatus ?? "");
      const connected =
        lastConn === "CONNECTED" ||
        lastConn === "CONNECTED_TO_BROKER" ||
        lastConn.toUpperCase().includes("CONNECTED");
      if (lastState === "DEPLOYED" && connected) {
        return { ready: true, state: lastState, connectionStatus: lastConn };
      }
      if (lastState === "UNDEPLOYED" || lastState === "DEPLOY_FAILED") {
        await deployMetaApiAccount(accountId).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return {
      ready: false,
      state: lastState,
      connectionStatus: lastConn,
      error: `MetaAPI account not ready yet (state=${lastState || "?"}, connection=${lastConn || "?"}). Try Refresh again in a few seconds.`,
    };
  } catch (e) {
    return {
      ready: false,
      state: lastState,
      connectionStatus: lastConn,
      error: e instanceof Error ? e.message : "Failed to check MetaAPI account status",
    };
  }
}

export type MetaApiPosition = {
  id: string;
  symbol: string;
  type: "POSITION_TYPE_BUY" | "POSITION_TYPE_SELL";
  volume: number;
  openPrice: number;
  currentPrice?: number;
  profit?: number;
  stopLoss?: number;
  takeProfit?: number;
  clientId?: string;
  [key: string]: unknown;
};

export async function getMetaApiPositions(accountId: string): Promise<MetaApiPosition[]> {
  try {
    const res = await metaApiFetch<MetaApiPosition[]>(
      `${clientBase()}/users/current/accounts/${accountId}/positions`,
      { method: "GET" }
    );
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export type MetaApiOrder = {
  id: string;
  symbol: string;
  type: string;
  state?: string;
  volume?: number;
  currentVolume?: number;
  openPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  time?: string;
  [key: string]: unknown;
};

/** Pending / working orders (limit, stop, etc.). */
export async function getMetaApiOrders(accountId: string): Promise<MetaApiOrder[]> {
  try {
    const res = await metaApiFetch<MetaApiOrder[]>(
      `${clientBase()}/users/current/accounts/${accountId}/orders`,
      { method: "GET" }
    );
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export type MetaApiDeal = {
  id: string;
  type: string;
  entryType: string;
  symbol: string;
  volume: number;
  price: number;
  profit: number;
  commission?: number;
  swap?: number;
  time: string;
  positionId?: string;
  orderId?: string;
  [key: string]: unknown;
};

/** History deals for a time window (ISO start inclusive, end exclusive). */
export async function getMetaApiHistoryDeals(
  accountId: string,
  startTimeIso: string,
  endTimeIso: string,
  limit = 500
): Promise<MetaApiDeal[]> {
  try {
    const start = encodeURIComponent(startTimeIso);
    const end = encodeURIComponent(endTimeIso);
    const res = await metaApiFetch<MetaApiDeal[]>(
      `${clientBase()}/users/current/accounts/${accountId}/history-deals/time/${start}/${end}?limit=${Math.min(1000, Math.max(1, limit))}`,
      { method: "GET" }
    );
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

/** Pair IN/OUT deals into closed round-trips for records + share cards. */
export function pairMetaApiClosedTrades(deals: MetaApiDeal[]): Array<{
  id: string;
  symbol: string;
  side: "long" | "short";
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  openedAt: string | null;
  closedAt: string;
}> {
  const byPos = new Map<string, MetaApiDeal[]>();
  for (const d of deals) {
    const pid = String(d.positionId ?? d.id);
    if (!byPos.has(pid)) byPos.set(pid, []);
    byPos.get(pid)!.push(d);
  }
  const out: Array<{
    id: string;
    symbol: string;
    side: "long" | "short";
    volume: number;
    openPrice: number;
    closePrice: number;
    profit: number;
    commission: number;
    swap: number;
    openedAt: string | null;
    closedAt: string;
  }> = [];

  for (const [pid, list] of byPos) {
    const sorted = [...list].sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const entries = sorted.filter((d) => d.entryType === "DEAL_ENTRY_IN" || d.entryType === "DEAL_ENTRY_INOUT");
    const exits = sorted.filter(
      (d) =>
        d.entryType === "DEAL_ENTRY_OUT" ||
        d.entryType === "DEAL_ENTRY_OUT_BY" ||
        d.entryType === "DEAL_ENTRY_INOUT"
    );
    if (exits.length === 0) continue;
    const open = entries[0] ?? sorted[0];
    const close = exits[exits.length - 1];
    const profit = exits.reduce((s, d) => s + (Number(d.profit) || 0), 0);
    const commission = sorted.reduce((s, d) => s + (Number(d.commission) || 0), 0);
    const swap = sorted.reduce((s, d) => s + (Number(d.swap) || 0), 0);
    const buyOpen = String(open?.type ?? "").includes("BUY");
    out.push({
      id: pid,
      symbol: close.symbol || open?.symbol || "—",
      side: buyOpen ? "long" : "short",
      volume: Number(close.volume) || Number(open?.volume) || 0,
      openPrice: Number(open?.price) || 0,
      closePrice: Number(close.price) || 0,
      profit: profit + commission + swap,
      commission,
      swap,
      openedAt: open?.time ? String(open.time) : null,
      closedAt: String(close.time),
    });
  }

  return out.sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

/** Best-effort current bid/ask/last for a symbol. Returns null if unavailable. */
export async function getMetaApiSymbolPrice(
  accountId: string,
  symbol: string
): Promise<{ bid: number; ask: number; last: number } | null> {
  try {
    const res = await metaApiFetch<{ bid?: number; ask?: number }>(
      `${clientBase()}/users/current/accounts/${accountId}/symbols/${encodeURIComponent(symbol)}/current-price`,
      { method: "GET" }
    );
    const bid = res?.bid;
    const ask = res?.ask;
    if (bid == null || ask == null || !Number.isFinite(bid) || !Number.isFinite(ask)) return null;
    return { bid, ask, last: (bid + ask) / 2 };
  } catch {
    return null;
  }
}

export type PlaceMetaApiMarketOrderInput = {
  accountId: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  clientId?: string;
};

export type MetaApiTradeResult = {
  ok: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
};

export async function placeMetaApiMarketOrder(
  input: PlaceMetaApiMarketOrderInput
): Promise<MetaApiTradeResult> {
  try {
    const body = {
      actionType: input.side === "buy" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL",
      symbol: input.symbol,
      volume: input.volume,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      clientId: input.clientId,
    };
    const res = await metaApiFetch<{
      orderId?: string;
      positionId?: string;
      numericCode?: number;
      stringCode?: string;
      message?: string;
    }>(`${clientBase()}/users/current/accounts/${input.accountId}/trade`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res?.stringCode && res.stringCode !== "TRADE_RETCODE_DONE" && !res.orderId && !res.positionId) {
      return { ok: false, error: res.message || res.stringCode };
    }
    return { ok: true, orderId: res?.orderId, positionId: res?.positionId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "MetaAPI order failed" };
  }
}

export async function closeMetaApiPosition(input: {
  accountId: string;
  positionId: string;
}): Promise<MetaApiTradeResult> {
  try {
    const res = await metaApiFetch<{ orderId?: string; message?: string; stringCode?: string }>(
      `${clientBase()}/users/current/accounts/${input.accountId}/trade`,
      {
        method: "POST",
        body: JSON.stringify({ actionType: "POSITION_CLOSE_ID", positionId: input.positionId }),
      }
    );
    return { ok: true, orderId: res?.orderId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "MetaAPI close failed" };
  }
}

export async function closeMetaApiPositionsBySymbol(input: {
  accountId: string;
  symbol: string;
}): Promise<MetaApiTradeResult> {
  const positions = await getMetaApiPositions(input.accountId);
  const matches = positions.filter((p) => p.symbol === input.symbol);
  if (matches.length === 0) return { ok: true };
  let lastError: string | undefined;
  for (const pos of matches) {
    const res = await closeMetaApiPosition({ accountId: input.accountId, positionId: pos.id });
    if (!res.ok) lastError = res.error;
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
}
