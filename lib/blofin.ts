/**
 * Blofin REST API client for futures (demo + live).
 * Docs: https://docs.blofin.com
 * Auth: path + method + timestamp + nonce + body -> HMAC-SHA256 -> hex -> base64
 */

const LIVE_BASE = "https://openapi.blofin.com";
const DEMO_BASE = "https://demo-trading-openapi.blofin.com";

function getBaseUrl(demo: boolean): string {
  return demo ? DEMO_BASE : LIVE_BASE;
}

import crypto from "crypto";

function createHmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function sign(secret: string, method: string, path: string, body: string): { sign: string; timestamp: string; nonce: string } {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const prehash = path + method + timestamp + nonce + body;
  const hexSig = createHmacSha256Hex(secret, prehash);
  const base64 = Buffer.from(hexSig, "utf8").toString("base64");
  return { sign: base64, timestamp, nonce };
}

export type BlofinConfig = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  demo: boolean;
  brokerId?: string;
};

export function getConfig(): BlofinConfig | null {
  const apiKey = process.env.BLOFIN_API_KEY;
  const secretKey = process.env.BLOFIN_SECRET_KEY;
  const passphrase = process.env.BLOFIN_PASSPHRASE;
  if (!apiKey || !secretKey || !passphrase) return null;
  const demo = process.env.BLOFIN_DEMO_MODE === "true";
  const brokerId = process.env.BLOFIN_BROKER_ID?.trim() || undefined;
  return { apiKey, secretKey, passphrase, demo, brokerId };
}

/** Signed request to Blofin private API. demoOverride: when set, use this for base URL. configOverride: use this instead of env. */
async function privateRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  demoOverride?: boolean,
  configOverride?: BlofinConfig | null
): Promise<{ code: string; msg: string; data?: T }> {
  const config = configOverride ?? getConfig();
  if (!config) throw new Error("Blofin API keys not configured");
  const useDemo = demoOverride !== undefined ? demoOverride : config.demo;
  const base = getBaseUrl(useDemo);
  const pathWithQuery = path.startsWith("/") ? path : `/${path}`;
  const url = base + pathWithQuery;
  const bodyStr = body ? JSON.stringify(body) : "";
  const { sign: signVal, timestamp, nonce } = sign(config.secretKey, method, pathWithQuery, bodyStr);
  const headers: Record<string, string> = {
    "ACCESS-KEY": config.apiKey,
    "ACCESS-SIGN": signVal,
    "ACCESS-TIMESTAMP": timestamp,
    "ACCESS-NONCE": nonce,
    "ACCESS-PASSPHRASE": config.passphrase,
    "Content-Type": "application/json",
  };
  if (config.brokerId) headers["broker-id"] = config.brokerId;
  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" && bodyStr ? bodyStr : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
  return { code: json.code ?? String(res.status), msg: json.msg ?? "", data: json.data };
}

function assertBlofinOk(out: { code: string; msg: string }, label: string): void {
  if (out.code !== "0") {
    throw new Error(out.msg?.trim() || `Blofin ${label} failed (code ${out.code}). Check API keys and Demo/Live mode.`);
  }
}

/** Public request (no auth). demoOverride: use bot's mode when provided. configOverride: use this instead of env. */
async function publicRequest<T>(path: string, demoOverride?: boolean, configOverride?: BlofinConfig | null): Promise<{ code: string; msg: string; data?: T }> {
  const config = configOverride ?? getConfig();
  const demo = demoOverride !== undefined ? demoOverride : config?.demo ?? false;
  const base = config ? getBaseUrl(demo) : getBaseUrl(demo);
  const url = base + (path.startsWith("/") ? path : `/${path}`);
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
  return { code: json.code ?? String(res.status), msg: json.msg ?? "", data: json.data };
}

/** Map our timeframe to Blofin bar (e.g. 1D -> 1D, 1h -> 1H) */
export function toBlofinBar(timeframe: string): string {
  const t = timeframe.trim();
  if (t === "1D" || t === "1d") return "1D";
  if (t === "1h" || t === "1H") return "1H";
  if (t === "4h" || t === "4H") return "4H";
  if (["1m", "3m", "5m", "15m", "30m", "2H", "6H", "8H", "12H", "3D", "1W", "1M"].includes(t)) return t;
  return "15m";
}

/** Candlestick: [ts, open, high, low, close, vol, volCurrency, volCurrencyQuote, confirm] */
export type Candle = [string, string, string, string, string, string, string, string, string];

/** GET /api/v1/market/candles. demoOverride: use bot mode when provided. options.config: per-user config. */
export async function getCandles(instId: string, bar: string, limit = 100, demoOverride?: boolean, options?: { config?: BlofinConfig | null }): Promise<Candle[]> {
  const path = `/api/v1/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const out = await publicRequest<Candle[]>(path, demoOverride, options?.config);
  if (out.code !== "0" || !out.data) return [];
  return out.data;
}

/** GET /api/v1/asset/balances?accountType=futures */
export async function getFuturesBalance(): Promise<{ currency: string; available: string; balance: string }[]> {
  const out = await privateRequest<{ details?: { currency: string; available: string; balance: string }[] }>(
    "GET",
    "/api/v1/asset/balances?accountType=futures"
  );
  if (out.code !== "0" || !out.data) return [];
  const d = out.data as { details?: { currency: string; available: string; balance: string }[] };
  return d.details ?? [];
}

/** Get position size from object. Blofin uses "positions" (plural); others use pos, sz, position, size. */
function getPosSize(h: Record<string, unknown>): string {
  const v = h.positions ?? h.pos ?? h.sz ?? h.position ?? h.size;
  return v != null ? String(v) : "0";
}

/** Position row: posSide is long/short for display; rawPositionSide is what Blofin returned (e.g. "net") for close-position API. Optional liqPx/margin when API provides them. mgnRatio = Blofin's margin ratio (risk metric). */
export type PositionRow = {
  instId: string;
  posSide: string;
  pos: string;
  avgPx: string;
  rawPositionSide?: string;
  liqPx?: string | null;
  margin?: string | null;
  imr?: string | null;
  mgnRatio?: string | null;
  /** Unrealized PnL in quote (e.g. USDT) when Blofin returns it */
  upl?: string | null;
  /** ROE ratio as decimal (e.g. -0.2623 → -26.23% on Blofin UI) */
  unrealizedPnlRatio?: string | null;
  leverage?: string | null;
  marginMode?: string | null;
  /** Mark / last price on position row when API returns it */
  markPx?: string | null;
};

/** Extract positions array from Blofin API response (various shapes). Blofin: data[] with positions, averagePrice, positionSide (net). Picks liqPx, margin, imr when present. */
function extractPositionsList(data: unknown): PositionRow[] {
  if (!data || typeof data !== "object") return [];
  const raw = data as Record<string, unknown>;
  const list =
    raw.holdings ?? raw.positions ?? raw.data ?? (Array.isArray(raw) ? raw : []);
  if (!Array.isArray(list)) return [];
  const result: PositionRow[] = [];
  for (const h of list) {
    if (!h || typeof h !== "object") continue;
    const obj = h as Record<string, unknown>;
    const posStr = getPosSize(obj);
    if (parseFloat(posStr) === 0) continue;
    const instId = String(obj.instId ?? obj.inst_id ?? obj.symbol ?? "");
    const positionSide = String(obj.positionSide ?? obj.posSide ?? obj.pos_side ?? obj.side ?? "").toLowerCase();
    const rawPositionSide = positionSide === "net" ? "net" : (positionSide || "net");
    const posSide =
      positionSide === "net"
        ? (parseFloat(posStr) >= 0 ? "long" : "short")
        : String(obj.posSide ?? obj.pos_side ?? obj.side ?? "long");
    const avgPx = String(obj.averagePrice ?? obj.avgPx ?? obj.avg_px ?? obj.avgPrice ?? obj.entryPrice ?? "0");
    const liqPx = obj.liqPx ?? obj.liquidationPrice ?? obj.liq_price ?? null;
    const margin = obj.margin ?? obj.marginBalance ?? obj.margin_balance ?? null;
    const imr = obj.imr ?? obj.initialMargin ?? obj.initial_margin ?? null;
    const mgnRatio = obj.mgnRatio ?? obj.marginRatio ?? obj.margin_ratio ?? null;
    const uplRaw =
      obj.upl ?? obj.unrealizedPnl ?? obj.unrealizedPnL ?? obj.unrealized_pnl ?? obj.uPnl ?? obj.profit ?? null;
    const ratioRaw =
      obj.unrealizedPnlRatio ?? obj.uplRatio ?? obj.unrealized_pnl_ratio ?? obj.pnlRatio ?? null;
    const leverageRaw = obj.leverage ?? obj.lever ?? null;
    const marginModeRaw = obj.marginMode ?? obj.margin_mode ?? null;
    const markPxRaw = obj.markPx ?? obj.mark_px ?? obj.markPrice ?? obj.last ?? obj.lastPrice ?? null;
    result.push({
      instId,
      posSide,
      pos: posStr,
      avgPx,
      rawPositionSide,
      liqPx: liqPx != null ? String(liqPx) : undefined,
      margin: margin != null ? String(margin) : imr != null ? String(imr) : undefined,
      imr: imr != null ? String(imr) : undefined,
      mgnRatio: mgnRatio != null ? String(mgnRatio) : undefined,
      upl: uplRaw != null && uplRaw !== "" ? String(uplRaw) : undefined,
      unrealizedPnlRatio: ratioRaw != null && ratioRaw !== "" ? String(ratioRaw) : undefined,
      leverage: leverageRaw != null && leverageRaw !== "" ? String(leverageRaw) : undefined,
      marginMode: marginModeRaw != null && marginModeRaw !== "" ? String(marginModeRaw) : undefined,
      markPx: markPxRaw != null && markPxRaw !== "" ? String(markPxRaw) : undefined,
    });
  }
  return result;
}

const normInstId = (s: string) => (s || "").replace(/-/g, "").toUpperCase();

/** GET /api/v1/account/positions - open positions. options.demo: use bot mode so close/PNL match run. options.config: per-user config. */
export async function getPositions(instId?: string, options?: { demo?: boolean; config?: BlofinConfig | null }): Promise<PositionRow[]> {
  // For non-broker and some accounts, filtered-by-instId returns empty. Fetch all first, then filter.
  const path = "/api/v1/account/positions";
  const out = await privateRequest<unknown>("GET", path, undefined, options?.demo, options?.config);
  assertBlofinOk(out, "positions");
  if (out.data == null) return [];
  const all = extractPositionsList(out.data);
  if (!instId) return all;
  const target = normInstId(instId);
  const filtered = all.filter((h) => normInstId(h.instId ?? "") === target);
  if (filtered.length > 0) return filtered;
  // Try with instId in query in case response differs when filtering
  const pathFiltered = `/api/v1/account/positions?instId=${encodeURIComponent(instId)}`;
  const out2 = await privateRequest<unknown>("GET", pathFiltered, undefined, options?.demo, options?.config);
  if (out2.code === "0" && out2.data != null) {
    const byInst = extractPositionsList(out2.data);
    if (byInst.length > 0) return byInst;
  }
  return [];
}

/** GET /api/v1/market/tickers - last price. demoOverride: use bot mode. options.config: per-user config. */
export async function getTicker(instId: string, demoOverride?: boolean, options?: { config?: BlofinConfig | null }): Promise<{ last: string } | null> {
  const out = await publicRequest<{ last: string }[]>(
    `/api/v1/market/tickers?instId=${encodeURIComponent(instId)}`,
    demoOverride,
    options?.config
  );
  if (out.code !== "0" || !out.data?.length) return null;
  return Array.isArray(out.data) ? out.data[0] : null;
}

/** Set leverage. options.demo / options.config: use bot mode and per-user keys when provided. */
export async function setLeverage(
  instId: string,
  leverage: number,
  marginMode: "isolated" | "cross",
  options?: { demo?: boolean; config?: BlofinConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Blofin API keys not configured" };
  const body: Record<string, unknown> = { instId, leverage: String(leverage), marginMode };
  if (config.brokerId) body.brokerId = config.brokerId;
  const out = await privateRequest("POST", "/api/v1/account/set-leverage", body, options?.demo, options?.config);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  return { ok: true };
}

/**
 * Close position via Blofin dedicated endpoint (POST /api/v1/trade/close-position).
 * Uses a market order to close the full position for instId + positionSide. options.demo: use bot mode.
 */
export async function closePositionViaApi(
  instId: string,
  marginMode: "isolated" | "cross",
  positionSide: "long" | "short" | "net",
  options?: { demo?: boolean; config?: BlofinConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Blofin API keys not configured" };
  const body: Record<string, unknown> = { instId, marginMode, positionSide };
  if (config.brokerId) body.brokerId = config.brokerId;
  const out = await privateRequest<{ instId?: string; positionSide?: string }>("POST", "/api/v1/trade/close-position", body, options?.demo, options?.config);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  return { ok: true };
}

/** Cancel an open order by instId and orderId. options.demo: use bot mode. options.config: per-user keys. */
export async function cancelOrder(
  instId: string,
  orderId: string,
  options?: { demo?: boolean; config?: BlofinConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Blofin API keys not configured" };
  const body: Record<string, unknown> = { instId, orderId };
  if (config.brokerId) body.brokerId = config.brokerId;
  const out = await privateRequest<{ orderId?: string }>("POST", "/api/v1/trade/cancel-order", body, options?.demo, options?.config);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  return { ok: true };
}

/** Place limit order. options.config: per-user config. */
export async function placeLimitOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  price: string,
  marginMode: "isolated" | "cross" = "cross",
  options?: { demo?: boolean; config?: BlofinConfig | null }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Blofin API keys not configured" };
  const body: Record<string, unknown> = {
    instId,
    marginMode,
    positionSide: "net",
    side,
    orderType: "limit",
    size,
    price: String(price),
  };
  if (config.brokerId) body.brokerId = config.brokerId;
  const out = await privateRequest<{ orderId?: string }[] | { orderId?: string }>("POST", "/api/v1/trade/order", body, options?.demo, options?.config);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  const data = out.data;
  const orderId = Array.isArray(data) ? data[0]?.orderId : (data as { orderId?: string } | undefined)?.orderId;
  return { ok: true, orderId };
}

/** Place market order. options.config: per-user config. */
export async function placeMarketOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross" = "cross",
  options?: { demo?: boolean; reduceOnly?: boolean; config?: BlofinConfig | null }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Blofin API keys not configured" };
  const body: Record<string, unknown> = {
    instId,
    marginMode,
    positionSide: "net",
    side,
    orderType: "market",
    size,
  };
  if (config.brokerId) body.brokerId = config.brokerId;
  if (options?.reduceOnly) body.reduceOnly = true;
  const out = await privateRequest<{ orderId?: string }[] | { orderId?: string }>("POST", "/api/v1/trade/order", body, options?.demo, options?.config);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  const data = out.data;
  const orderId = Array.isArray(data) ? data[0]?.orderId : (data as { orderId?: string } | undefined)?.orderId;
  return { ok: true, orderId };
}

/** Place TP/SL order. options.config: per-user config. */
export async function placeTPSLOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross",
  entryPrice: number,
  tpPct: number,
  slPct: number,
  options?: { demo?: boolean; config?: BlofinConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Blofin API keys not configured" };
  const isLong = side === "buy";
  const tpPrice = isLong
    ? entryPrice * (1 + tpPct / 100)
    : entryPrice * (1 - tpPct / 100);
  const slPrice = isLong
    ? entryPrice * (1 - slPct / 100)
    : entryPrice * (1 + slPct / 100);
  const body: Record<string, unknown> = {
    instId,
    marginMode,
    positionSide: "net",
    side,
    size,
    reduceOnly: "true",
    tpTriggerPrice: String(roundPrice(tpPrice)),
    tpOrderPrice: "-1",
    slTriggerPrice: String(roundPrice(slPrice)),
    slOrderPrice: "-1",
  };
  if (config.brokerId) body.brokerId = config.brokerId;
  const path = "/api/v1/trade/order-tpsl";
  const out = await privateRequest<{ tpslId?: string }>("POST", path, body, options?.demo, options?.config);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  return { ok: true };
}

function roundPrice(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return p;
  const scale = p >= 1000 ? 1 : p >= 1 ? 2 : 4;
  return Math.round(p * Math.pow(10, scale)) / Math.pow(10, scale);
}

/** Get instrument info. options.config: per-user config. */
export async function getInstrument(instId: string, options?: { demo?: boolean; config?: BlofinConfig | null }): Promise<{ minSize: string; contractValue: string; settleCurrency: string } | null> {
  const out = await publicRequest<{ instId: string; minSize: string; contractValue: string; settleCurrency: string }[]>(
    `/api/v1/market/instruments?instId=${encodeURIComponent(instId)}`,
    options?.demo,
    options?.config
  );
  if (out.code !== "0" || !out.data?.length) return null;
  const d = out.data[0];
  return { minSize: d.minSize, contractValue: d.contractValue, settleCurrency: d.settleCurrency };
}

/** Normalize open-order row from Blofin response. */
function mapOpenOrder(o: Record<string, unknown>): { orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; createdAt?: string } {
  return {
    orderId: String(o.orderId ?? o.order_id ?? ""),
    instId: String(o.instId ?? o.inst_id ?? ""),
    side: String(o.side ?? ""),
    orderType: String(o.orderType ?? o.order_type ?? ""),
    size: String(o.size ?? o.sz ?? "0"),
    price: String(o.price ?? "0"),
    state: String(o.state ?? o.status ?? "live"),
    createdAt: o.createTime != null ? String(o.createTime) : (o.create_time != null ? String(o.create_time) : undefined),
  };
}

/** GET open (pending/live) orders. options.demo: use bot mode. options.config: per-user keys. Tries Blofin orders then orders-pending. */
export async function getOpenOrders(options?: {
  demo?: boolean;
  instId?: string;
  limit?: number;
  config?: BlofinConfig | null;
}): Promise<
  { orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; createdAt?: string }[]
> {
  const limit = options?.limit ?? 50;
  const base = options?.instId ? `instId=${encodeURIComponent(options.instId)}&limit=${limit}` : `limit=${limit}`;
  const paths = [`/api/v1/trade/orders?${base}`, `/api/v1/trade/orders-pending?${base}`];
  let lastErr = "";
  for (const path of paths) {
    const out = await privateRequest<unknown>("GET", path, undefined, options?.demo, options?.config);
    if (out.code !== "0") {
      lastErr = out.msg?.trim() || out.code;
      continue;
    }
    const raw = out.data;
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown[] }).data)
        ? (raw as { data: Record<string, unknown>[] }).data
        : raw && typeof raw === "object" && Array.isArray((raw as { orders?: unknown[] }).orders)
          ? (raw as { orders: Record<string, unknown>[] }).orders
          : [];
    return list.map((o) => mapOpenOrder(o));
  }
  if (lastErr) throw new Error(`${lastErr} (open orders). Check API keys and Demo/Live mode.`);
  return [];
}

/** GET order history (filled/canceled). options.demo: use bot mode. options.config: per-user keys. Includes pnl when present (e.g. closing orders). */
export async function getOrderHistory(options?: {
  demo?: boolean;
  instId?: string;
  limit?: number;
  config?: BlofinConfig | null;
}): Promise<
  {
    orderId: string;
    instId: string;
    side: string;
    orderType: string;
    size: string;
    price: string;
    state: string;
    fillPrice?: string;
    averagePrice?: string;
    leverage?: string;
    createdAt?: string;
    pnl?: string;
  }[]
> {
  const limit = options?.limit ?? 50;
  const path = options?.instId
    ? `/api/v1/trade/orders-history?instId=${encodeURIComponent(options.instId)}&limit=${limit}`
    : `/api/v1/trade/orders-history?limit=${limit}`;
  const out = await privateRequest<{ orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; fillPrice?: string; createTime?: string; pnl?: string }[]>(
    "GET",
    path,
    undefined,
    options?.demo,
    options?.config
  );
  assertBlofinOk(out, "order history");
  if (!out.data) return [];
  type OrderRow = {
    orderId?: string;
    instId?: string;
    side?: string;
    orderType?: string;
    size?: string;
    price?: string;
    state?: string;
    fillPrice?: string;
    averagePrice?: string;
    leverage?: string;
    createTime?: string;
    pnl?: string;
  };
  const list: OrderRow[] = Array.isArray(out.data) ? (out.data as OrderRow[]) : ((out.data as { data?: OrderRow[] })?.data ?? []);
  return list.map((o) => ({
    orderId: String(o.orderId ?? ""),
    instId: String(o.instId ?? ""),
    side: String(o.side ?? ""),
    orderType: String(o.orderType ?? ""),
    size: String(o.size ?? "0"),
    price: String(o.price ?? "0"),
    state: String(o.state ?? ""),
    fillPrice: o.fillPrice != null && o.fillPrice !== "" ? String(o.fillPrice) : undefined,
    averagePrice: o.averagePrice != null && o.averagePrice !== "" ? String(o.averagePrice) : undefined,
    leverage: o.leverage != null && o.leverage !== "" ? String(o.leverage) : undefined,
    createdAt: o.createTime != null ? String(o.createTime) : undefined,
    pnl: o.pnl != null && o.pnl !== "" ? String(o.pnl) : undefined,
  }));
}

export type BlofinFillHistoryRow = {
  instId: string;
  tradeId: string;
  orderId: string;
  fillPrice: string;
  fillSize: string;
  fillPnl: string;
  positionSide: string;
  side: string;
  fee: string;
  ts: string;
};

/** GET /api/v1/trade/fills-history — closing fills include fillPnl. */
export async function getFillsHistory(options?: {
  demo?: boolean;
  instId?: string;
  limit?: number;
  config?: BlofinConfig | null;
}): Promise<BlofinFillHistoryRow[]> {
  const limit = Math.min(100, options?.limit ?? 50);
  const q = new URLSearchParams({ limit: String(limit) });
  if (options?.instId) q.set("instId", options.instId);
  const path = `/api/v1/trade/fills-history?${q.toString()}`;
  const out = await privateRequest<unknown>("GET", path, undefined, options?.demo, options?.config);
  assertBlofinOk(out, "fills history");
  if (!out.data) return [];
  type Row = {
    instId?: string;
    tradeId?: string;
    orderId?: string;
    fillPrice?: string;
    fillSize?: string;
    fillPnl?: string;
    positionSide?: string;
    side?: string;
    fee?: string;
    ts?: string;
  };
  const list: Row[] = Array.isArray(out.data) ? (out.data as Row[]) : ((out.data as { data?: Row[] })?.data ?? []);
  return list.map((r) => ({
    instId: String(r.instId ?? ""),
    tradeId: String(r.tradeId ?? ""),
    orderId: String(r.orderId ?? ""),
    fillPrice: String(r.fillPrice ?? "0"),
    fillSize: String(r.fillSize ?? "0"),
    fillPnl: String(r.fillPnl ?? "0"),
    positionSide: String(r.positionSide ?? ""),
    side: String(r.side ?? ""),
    fee: String(r.fee ?? "0"),
    ts: String(r.ts ?? ""),
  }));
}

export function isBlofinConfigured(): boolean {
  return !!(
    process.env.BLOFIN_API_KEY &&
    process.env.BLOFIN_SECRET_KEY &&
    process.env.BLOFIN_PASSPHRASE
  );
}
