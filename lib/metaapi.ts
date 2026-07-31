/**
 * MetaAPI (metaapi.cloud) REST client — MT4/MT5 account provisioning + trading.
 * Docs: https://metaapi.cloud/docs/provisioning/ and https://metaapi.cloud/docs/client/
 * Requires METAAPI_TOKEN (account access token from MetaAPI dashboard).
 *
 * Customer-facing UI must never mention MetaAPI — use {@link toUserFacingForexBridgeError}.
 */
import crypto from "crypto";

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

/** In-memory cache: MetaAPI account id → region (e.g. new-york, vint-hill). */
const accountRegionCache = new Map<string, string>();

function defaultRegion(): string {
  return process.env.METAAPI_REGION?.trim() || "new-york";
}

function clientBaseForRegion(reg: string): string {
  const r = (reg || defaultRegion()).trim().toLowerCase();
  return `https://mt-client-api-v1.${r}.agiliumtrade.ai`;
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

/**
 * Rewrite bridge/vendor errors into short customer-safe copy (no MetaAPI / vendor URLs).
 */
export function toUserFacingForexBridgeError(raw: string | null | undefined): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return "Could not reach your broker right now. Tap Refresh and try again.";
  const lower = msg.toLowerCase();

  if (
    lower.includes("not connected to broker") ||
    lower.includes("does not match the account region") ||
    lower.includes("request url you use does not match")
  ) {
    return "Your broker link is still connecting. Wait 20–30 seconds, then tap Refresh. If it keeps failing, Disconnect and connect again.";
  }
  if (lower.includes("undeployed") || (lower.includes("deploy") && lower.includes("connection"))) {
    return "Your broker link is starting up. Tap Refresh in a few seconds.";
  }
  if (lower.includes(".dat file") || lower.includes("e_srv_not_found") || lower.includes("server name")) {
    const suggested = msg.match(/Suggested server names:\s*([^.]+)/i)?.[1]?.trim();
    return suggested
      ? `Server name not recognized. Try one of: ${suggested}. Or copy the exact name from MT4/MT5.`
      : "Server name not recognized. Copy the exact server name from your MT4/MT5 terminal and try again.";
  }
  if (lower.includes("unauthorized") || lower.includes("invalid password") || lower.includes("wrong password")) {
    return "Login or password was rejected by the broker. Check your MT4/MT5 credentials and try again.";
  }
  if (
    lower.includes("not enough money") ||
    lower.includes("no money") ||
    lower.includes("not enough margin") ||
    lower.includes("insufficient funds") ||
    lower.includes("trade_retcode_no_money")
  ) {
    return "Not enough free margin on your MT account for this lot size. Lower Lot size (try 0.01), deposit more funds, or raise account leverage at your broker — then Save and retry.";
  }
  if (lower.includes("unknown symbol") || lower.includes("symbol not found") || lower.includes("market is closed")) {
    if (lower.includes("unknown symbol") || lower.includes("symbol not found")) {
      return "Unknown symbol on your MT account. Your broker may use a different name (e.g. NVDA.US, USTEC for NAS100). Pick a Market Watch symbol your MT terminal can trade, or check Market Watch in MT5.";
    }
  }
  if (lower.includes("metaapi_token") || lower.includes("not configured")) {
    return "Broker trading is temporarily unavailable. Please try again later or contact support.";
  }

  let cleaned = msg
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/\bmetaapi\b/gi, "connection")
    .replace(/\([^)]*[0-9a-f]{8,}[^)]*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length > 180) cleaned = cleaned.slice(0, 177) + "…";
  return cleaned || "Could not reach your broker right now. Tap Refresh and try again.";
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
    signal: AbortSignal.timeout(25000),
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
      `Broker bridge request failed (${res.status})`;
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

function provisioningProfileId(platform: MetaApiPlatform): string | undefined {
  const key =
    platform === "mt4"
      ? process.env.METAAPI_PROVISIONING_PROFILE_MT4
      : process.env.METAAPI_PROVISIONING_PROFILE_MT5;
  const id = key?.trim();
  return id || undefined;
}

/** Provision a new trading account on the bridge (links a broker MT4/MT5 login). */
export async function createMetaApiAccount(
  input: CreateMetaApiAccountInput
): Promise<{ id: string }> {
  const profileId = provisioningProfileId(input.platform);
  const reg = defaultRegion();
  const body: Record<string, unknown> = {
    login: input.login,
    password: input.password,
    server: input.server,
    platform: input.platform,
    name: input.name || `NovaStaris-${input.platform.toUpperCase()}-${Date.now()}`,
    magic: input.magic ?? 0,
    type: "cloud-g2",
    /** Pin region so client API URLs match (avoids region-mismatch errors). */
    region: reg,
    riskManagementApiEnabled: false,
  };
  if (profileId) body.provisioningProfileId = profileId;
  const created = await metaApiFetch<{ id: string }>(`${PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    body: JSON.stringify(body),
    includeTransactionId: true,
  });
  if (created?.id) accountRegionCache.set(created.id, reg);
  return created;
}

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
  region?: string;
  [key: string]: unknown;
};

export async function getMetaApiAccount(accountId: string): Promise<MetaApiAccount> {
  const acc = await metaApiFetch<MetaApiAccount>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    method: "GET",
  });
  const reg = typeof acc.region === "string" && acc.region.trim() ? acc.region.trim() : defaultRegion();
  accountRegionCache.set(accountId, reg);
  return acc;
}

export async function resolveMetaApiAccountRegion(accountId: string): Promise<string> {
  const cached = accountRegionCache.get(accountId);
  if (cached) return cached;
  try {
    const acc = await getMetaApiAccount(accountId);
    return typeof acc.region === "string" && acc.region.trim() ? acc.region.trim() : defaultRegion();
  } catch {
    return defaultRegion();
  }
}

async function clientBaseForAccount(accountId: string): Promise<string> {
  const reg = await resolveMetaApiAccountRegion(accountId);
  return clientBaseForRegion(reg);
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
  accountRegionCache.delete(accountId);
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
    const base = await clientBaseForAccount(accountId);
    const data = await metaApiFetch<MetaApiAccountInformation>(
      `${base}/users/current/accounts/${accountId}/account-information`,
      { method: "GET" }
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load account information" };
  }
}

/** Deploy if needed and wait until the cloud terminal reports connected (or timeout). */
export async function ensureMetaApiAccountReady(
  accountId: string,
  maxWaitMs = 45000
): Promise<{ ready: boolean; state?: string; connectionStatus?: string; region?: string; error?: string }> {
  const started = Date.now();
  let lastState = "";
  let lastConn = "";
  let lastRegion = "";
  let deployAttempted = false;
  try {
    while (Date.now() - started < maxWaitMs) {
      const acc = await getMetaApiAccount(accountId);
      lastState = String(acc.state ?? "");
      lastConn = String(acc.connectionStatus ?? "");
      lastRegion = typeof acc.region === "string" ? acc.region : lastRegion;
      const connected =
        lastConn === "CONNECTED" ||
        lastConn === "CONNECTED_TO_BROKER" ||
        lastConn.toUpperCase().includes("CONNECTED");
      if (lastState === "DEPLOYED" && connected) {
        return { ready: true, state: lastState, connectionStatus: lastConn, region: lastRegion };
      }
      if (
        !deployAttempted ||
        lastState === "UNDEPLOYED" ||
        lastState === "DEPLOY_FAILED" ||
        (lastState === "DEPLOYED" && lastConn === "DISCONNECTED" && Date.now() - started > 8000)
      ) {
        deployAttempted = true;
        await deployMetaApiAccount(accountId).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    return {
      ready: false,
      state: lastState,
      connectionStatus: lastConn,
      region: lastRegion,
      error: toUserFacingForexBridgeError(
        `undeployed connection=${lastConn || "?"} state=${lastState || "?"}`
      ),
    };
  } catch (e) {
    return {
      ready: false,
      state: lastState,
      connectionStatus: lastConn,
      region: lastRegion,
      error: toUserFacingForexBridgeError(e instanceof Error ? e.message : "Failed to check broker connection"),
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
    const base = await clientBaseForAccount(accountId);
    const res = await metaApiFetch<MetaApiPosition[]>(
      `${base}/users/current/accounts/${accountId}/positions`,
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

export async function getMetaApiOrders(accountId: string): Promise<MetaApiOrder[]> {
  try {
    const base = await clientBaseForAccount(accountId);
    const res = await metaApiFetch<MetaApiOrder[]>(
      `${base}/users/current/accounts/${accountId}/orders`,
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

export async function getMetaApiHistoryDeals(
  accountId: string,
  startTimeIso: string,
  endTimeIso: string,
  limit = 500
): Promise<MetaApiDeal[]> {
  try {
    const base = await clientBaseForAccount(accountId);
    const start = encodeURIComponent(startTimeIso);
    const end = encodeURIComponent(endTimeIso);
    const res = await metaApiFetch<MetaApiDeal[]>(
      `${base}/users/current/accounts/${accountId}/history-deals/time/${start}/${end}?limit=${Math.min(1000, Math.max(1, limit))}`,
      { method: "GET" }
    );
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

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

export async function getMetaApiSymbolPrice(
  accountId: string,
  symbol: string
): Promise<{ bid: number; ask: number; last: number } | null> {
  try {
    const base = await clientBaseForAccount(accountId);
    const res = await metaApiFetch<{ bid?: number; ask?: number }>(
      `${base}/users/current/accounts/${accountId}/symbols/${encodeURIComponent(symbol)}/current-price`,
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

/** List symbols available on this MT account (for resolving NVDA → broker-specific name). */
export async function getMetaApiSymbols(accountId: string): Promise<string[]> {
  try {
    const base = await clientBaseForAccount(accountId);
    const res = await metaApiFetch<string[] | { symbols?: string[] }>(
      `${base}/users/current/accounts/${accountId}/symbols`,
      { method: "GET" }
    );
    if (Array.isArray(res)) return res.filter((s) => typeof s === "string" && s.length > 0);
    if (res && Array.isArray(res.symbols)) {
      return res.symbols.filter((s) => typeof s === "string" && s.length > 0);
    }
    return [];
  } catch {
    return [];
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
    const base = await clientBaseForAccount(input.accountId);
    const body: Record<string, unknown> = {
      actionType: input.side === "buy" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL",
      symbol: input.symbol,
      volume: input.volume,
    };
    if (input.stopLoss != null && Number.isFinite(input.stopLoss) && input.stopLoss > 0) {
      body.stopLoss = input.stopLoss;
    }
    if (input.takeProfit != null && Number.isFinite(input.takeProfit) && input.takeProfit > 0) {
      body.takeProfit = input.takeProfit;
    }
    if (input.clientId) body.clientId = input.clientId;
    const res = await metaApiFetch<{
      orderId?: string;
      positionId?: string;
      numericCode?: number;
      stringCode?: string;
      message?: string;
    }>(`${base}/users/current/accounts/${input.accountId}/trade`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res?.stringCode && res.stringCode !== "TRADE_RETCODE_DONE" && !res.orderId && !res.positionId) {
      return { ok: false, error: toUserFacingForexBridgeError(res.message || res.stringCode) };
    }
    return { ok: true, orderId: res?.orderId, positionId: res?.positionId };
  } catch (e) {
    return {
      ok: false,
      error: toUserFacingForexBridgeError(e instanceof Error ? e.message : "Order failed"),
    };
  }
}

/** Attach or update SL/TP on an open MT position (broker-side protection). */
export async function modifyMetaApiPositionStops(input: {
  accountId: string;
  positionId: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
}): Promise<MetaApiTradeResult> {
  try {
    const base = await clientBaseForAccount(input.accountId);
    const body: Record<string, unknown> = {
      actionType: "POSITION_MODIFY",
      positionId: input.positionId,
    };
    if (input.stopLoss != null && Number.isFinite(input.stopLoss) && input.stopLoss > 0) {
      body.stopLoss = input.stopLoss;
    }
    if (input.takeProfit != null && Number.isFinite(input.takeProfit) && input.takeProfit > 0) {
      body.takeProfit = input.takeProfit;
    }
    if (body.stopLoss == null && body.takeProfit == null) {
      return { ok: false, error: "No stop loss or take profit to set." };
    }
    const res = await metaApiFetch<{ orderId?: string; message?: string; stringCode?: string }>(
      `${base}/users/current/accounts/${input.accountId}/trade`,
      { method: "POST", body: JSON.stringify(body) }
    );
    if (res?.stringCode && res.stringCode !== "TRADE_RETCODE_DONE" && !res.orderId) {
      return { ok: false, error: toUserFacingForexBridgeError(res.message || res.stringCode) };
    }
    return { ok: true, orderId: res?.orderId };
  } catch (e) {
    return {
      ok: false,
      error: toUserFacingForexBridgeError(e instanceof Error ? e.message : "Modify stops failed"),
    };
  }
}

export async function closeMetaApiPosition(input: {
  accountId: string;
  positionId: string;
}): Promise<MetaApiTradeResult> {
  try {
    const base = await clientBaseForAccount(input.accountId);
    const res = await metaApiFetch<{ orderId?: string; message?: string; stringCode?: string }>(
      `${base}/users/current/accounts/${input.accountId}/trade`,
      {
        method: "POST",
        body: JSON.stringify({ actionType: "POSITION_CLOSE_ID", positionId: input.positionId }),
      }
    );
    return { ok: true, orderId: res?.orderId };
  } catch (e) {
    return {
      ok: false,
      error: toUserFacingForexBridgeError(e instanceof Error ? e.message : "Close failed"),
    };
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
