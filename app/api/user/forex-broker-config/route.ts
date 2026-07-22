import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  FOREX_BROKER_IDS,
  deleteForexBrokerConfigForUser,
  listForexBrokerConfigsForUser,
  parseForexBrokerId,
  saveForexBrokerConfigForUser,
  updateForexBrokerDemoModeForUser,
  type ForexBrokerId,
  type ForexBrokerPlatform,
} from "@/lib/forex-broker-user-config";
import {
  createMetaApiAccount,
  deleteMetaApiAccount,
  deployMetaApiAccount,
  isMetaApiConfigured,
} from "@/lib/metaapi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function maskLogin(login: string): string {
  if (login.length <= 4) return "••" + login.slice(-2);
  return login.slice(0, 2) + "••••" + login.slice(-2);
}

function isValidBroker(v: unknown): v is ForexBrokerId {
  return parseForexBrokerId(v) != null;
}

/** GET — list connected forex brokers for current user (no passwords). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const rows = await listForexBrokerConfigsForUser(session.user.id);
    const connections = rows.map((r) => ({
      broker: r.broker,
      platform: r.platform,
      loginMasked: maskLogin(r.login),
      server: r.server,
      demoMode: r.demoMode,
      metaApiAccountId: r.metaApiAccountId ?? null,
      connected: !!r.metaApiAccountId,
    }));
    return NextResponse.json({ success: true, connections, metaApiConfigured: isMetaApiConfigured() });
  } catch (e) {
    console.error("forex-broker-config GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load." },
      { status: 500 }
    );
  }
}

/**
 * POST — save (or replace) a forex broker login.
 * Body: { broker, platform, login, password, server, demoMode?, provision? }
 * When provision is true (default) and METAAPI_TOKEN is set, provisions + deploys a MetaAPI account.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const broker = body.broker;
    if (!isValidBroker(broker)) {
      return NextResponse.json(
        { success: false, error: `broker must be one of: ${FOREX_BROKER_IDS.join(", ")}` },
        { status: 400 }
      );
    }
    const platform: ForexBrokerPlatform = body.platform === "mt4" ? "mt4" : "mt5";
    const login = String(body.login ?? "").trim();
    const password = String(body.password ?? "").trim();
    const server = String(body.server ?? "").trim();
    const demoMode = body.demoMode !== false;
    const provision = body.provision !== false;

    if (!login || !password || !server) {
      return NextResponse.json(
        { success: false, error: "login, password, and server are required." },
        { status: 400 }
      );
    }

    let metaApiAccountId: string | null = null;
    let warning: string | undefined;

    if (provision && isMetaApiConfigured()) {
      try {
        const account = await createMetaApiAccount({
          login,
          password,
          server,
          platform,
          name: `NovaStaris-${broker}-${session.user.id.slice(0, 8)}`,
        });
        metaApiAccountId = account.id;
        await deployMetaApiAccount(account.id).catch((e) => {
          warning = `Account created but deploy failed: ${e instanceof Error ? e.message : "unknown error"}. It will retry on next connection.`;
        });
      } catch (e) {
        warning = `Saved your login, but MetaAPI provisioning failed: ${e instanceof Error ? e.message : "unknown error"}. Check login/password/server and try again.`;
      }
    } else if (provision && !isMetaApiConfigured()) {
      warning = "Saved your login. MetaAPI is not configured on the server yet (METAAPI_TOKEN) — bots cannot trade until it is.";
    }

    await saveForexBrokerConfigForUser(session.user.id, {
      broker,
      platform,
      login,
      password,
      server,
      demo: demoMode,
      metaApiAccountId,
    });

    return NextResponse.json({
      success: true,
      connection: {
        broker,
        platform,
        loginMasked: maskLogin(login),
        server,
        demoMode,
        metaApiAccountId,
        connected: !!metaApiAccountId,
      },
      warning,
    });
  } catch (e) {
    console.error("forex-broker-config POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 500 }
    );
  }
}

/** DELETE — remove a saved forex broker connection. ?broker=vantage|tiomarkets */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const broker = new URL(request.url).searchParams.get("broker");
    if (!isValidBroker(broker)) {
      return NextResponse.json(
        { success: false, error: `broker must be one of: ${FOREX_BROKER_IDS.join(", ")}` },
        { status: 400 }
      );
    }

    const rows = await listForexBrokerConfigsForUser(session.user.id);
    const existing = rows.find((r) => r.broker === broker);
    if (existing?.metaApiAccountId && isMetaApiConfigured()) {
      await deleteMetaApiAccount(existing.metaApiAccountId).catch((e) => {
        console.warn("forex-broker-config DELETE: MetaAPI account delete failed:", e);
      });
    }

    await deleteForexBrokerConfigForUser(session.user.id, broker);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("forex-broker-config DELETE:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to remove." },
      { status: 500 }
    );
  }
}

/** PATCH — toggle demo/live for a saved broker. Body: { broker, demoMode }. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const broker = body.broker;
    if (!isValidBroker(broker)) {
      return NextResponse.json(
        { success: false, error: `broker must be one of: ${FOREX_BROKER_IDS.join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof body.demoMode !== "boolean") {
      return NextResponse.json({ success: false, error: "demoMode (boolean) is required." }, { status: 400 });
    }
    const updated = await updateForexBrokerDemoModeForUser(session.user.id, broker, body.demoMode);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Connect this broker first." }, { status: 400 });
    }
    return NextResponse.json({ success: true, demoMode: body.demoMode });
  } catch (e) {
    console.error("forex-broker-config PATCH:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update." },
      { status: 500 }
    );
  }
}
