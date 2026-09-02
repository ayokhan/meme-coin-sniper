import crypto from "node:crypto";
import type { GmgnCredentials } from "@/lib/gmgn-client-types";
import {
  detectGmgnSignAlgorithm,
  normalizeGmgnPrivateKeyPem,
  signGmgnMessage,
} from "@/lib/gmgn-private-key";
import { gmgnFetch } from "@/lib/gmgn-fetch";

export type { GmgnChain, GmgnCredentials, GmgnTrendingToken } from "@/lib/gmgn-client-types";

const GMGN_HOST = "https://openapi.gmgn.ai";

function buildAuthQuery() {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    client_id: crypto.randomUUID(),
  };
}

function buildUrl(base: string, query: Record<string, string | number | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) params.append(k, String(item));
    } else {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function buildMessage(
  subPath: string,
  queryParams: Record<string, string | number | string[]>,
  body: string,
  timestamp: number
) {
  const sortedQs = Object.keys(queryParams)
    .sort()
    .flatMap((k) => {
      const ek = encodeURIComponent(k);
      const v = queryParams[k];
      if (Array.isArray(v)) {
        return [...v].sort().map((item) => `${ek}=${encodeURIComponent(String(item))}`);
      }
      return [`${ek}=${encodeURIComponent(String(v))}`];
    })
    .join("&");
  return `${subPath}:${sortedQs}:${body}:${timestamp}`;
}

function sign(message: string, privateKeyPem: string, algorithm: "Ed25519" | "RSA-SHA256") {
  return signGmgnMessage(message, privateKeyPem, algorithm);
}

function parseGmgnError(json: Record<string, unknown>, status: number): string {
  const msg =
    (typeof json.message === "string" && json.message) ||
    (typeof json.error === "string" && json.error) ||
    (typeof json.reason === "string" && json.reason);
  if (msg && /source ip blocked/i.test(msg)) {
    const ip =
      (typeof json.source_ip === "string" && json.source_ip) ||
      msg.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1] ||
      null;
    return ip
      ? `GMGN blocked server IP ${ip}. Add it to your API key IP whitelist at gmgn.ai/ai → API Management.`
      : "GMGN blocked this server IP. Add NovaStaris egress IP to your API key whitelist at gmgn.ai/ai.";
  }
  if (msg) return msg;
  if (json.code != null) return `GMGN API error (code ${String(json.code)})`;
  return `GMGN API request failed (HTTP ${status})`;
}

async function gmgnExistGet<T>(
  subPath: string,
  queryExtra: Record<string, string | number | string[] | undefined>,
  apiKey: string
): Promise<T> {
  const { timestamp, client_id } = buildAuthQuery();
  const query = { ...queryExtra, timestamp, client_id };
  const url = buildUrl(`${GMGN_HOST}${subPath}`, query);
  let res: Response;
  try {
    res = await gmgnFetch(url, {
      method: "GET",
      headers: {
        "X-APIKEY": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "NovaStaris/1.0",
      },
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Could not reach GMGN API.");
  }
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`GMGN API returned a non-JSON response (HTTP ${res.status}).`);
  }
  if (json.code !== 0) {
    throw new Error(parseGmgnError(json, res.status));
  }
  return json.data as T;
}

async function gmgnSignedPost<T>(
  subPath: string,
  queryExtra: Record<string, string | number | string[] | undefined>,
  body: Record<string, unknown>,
  creds: GmgnCredentials
): Promise<T> {
  const pem = normalizeGmgnPrivateKeyPem(creds.privateKey);
  if (!pem) throw new Error("GMGN private key required for swap execution.");

  const { timestamp, client_id } = buildAuthQuery();
  const query = { ...queryExtra, timestamp, client_id } as Record<string, string | number | string[]>;
  const bodyStr = JSON.stringify(body);
  const message = buildMessage(subPath, query, bodyStr, timestamp);
  let signature: string;
  try {
    signature = sign(message, pem, detectGmgnSignAlgorithm(pem));
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Invalid GMGN private key.");
  }
  const url = buildUrl(`${GMGN_HOST}${subPath}`, query);

  let res: Response;
  try {
    res = await gmgnFetch(url, {
      method: "POST",
      headers: {
        "X-APIKEY": creds.apiKey,
        "X-Signature": signature,
        "Content-Type": "application/json",
        "User-Agent": "NovaStaris/1.0",
      },
      body: bodyStr,
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Could not reach GMGN API.");
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`GMGN API returned a non-JSON response (HTTP ${res.status}).`);
  }
  if (json.code !== 0) {
    throw new Error(parseGmgnError(json, res.status));
  }
  return json.data as T;
}

export function createGmgnOpenApiClient(creds: GmgnCredentials) {
  return {
    getTrendingSwaps(chain: string, interval: string, extra: Record<string, number | string> = {}) {
      return gmgnExistGet<{ rank?: unknown[] }>(
        "/v1/market/rank",
        { chain, interval, ...extra },
        creds.apiKey
      );
    },
    quoteOrder(params: {
      chain: string;
      from_address: string;
      input_token: string;
      output_token: string;
      input_amount: string;
      slippage: number;
    }) {
      return gmgnExistGet<unknown>("/v1/trade/quote", params, creds.apiKey);
    },
    swap(params: Record<string, unknown>) {
      return gmgnSignedPost<unknown>("/v1/trade/swap", {}, params, creds);
    },
  };
}
