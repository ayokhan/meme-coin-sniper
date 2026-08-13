import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

function isValidBscAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

function validateAddressByChain(contractAddress: string, chain: string): { ok: boolean; error?: string } {
  const addr = contractAddress.trim();
  if (chain === 'bsc' || chain === 'ethereum') {
    if (!isValidBscAddress(addr)) return { ok: false, error: 'Invalid EVM address. Use 0x followed by 40 hex characters.' };
  } else {
    if (!isValidSolanaAddress(addr)) return { ok: false, error: 'Invalid Solana address.' };
  }
  return { ok: true };
}

/** GET /api/pins — list current user's pinned tokens with latest analysis */
export async function GET() {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Sign in to view pins.', locked: true }, { status: 401 });
    }

    const pins = await (prisma as unknown as { pinnedToken: { findMany: (args: { where: { userId: string }; orderBy: { pinnedAt: string } }) => Promise<{ contractAddress: string; chain: string; symbol: string | null; name: string | null; pinnedAt: Date; lastAnalyzedAt: Date | null; analysisResult: unknown }[]> } }).pinnedToken.findMany({
      where: { userId },
      orderBy: { pinnedAt: 'desc' },
    });

    const list = pins.map((p) => ({
      contractAddress: p.contractAddress,
      chain: p.chain ?? 'solana',
      symbol: p.symbol,
      name: p.name,
      pinnedAt: p.pinnedAt.toISOString(),
      lastAnalyzedAt: p.lastAnalyzedAt?.toISOString() ?? null,
      analysisResult: p.analysisResult as Record<string, unknown> | null,
    }));

    return NextResponse.json({ success: true, pins: list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load pins';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST /api/pins — add a pin (contractAddress required; symbol/name optional) */
export async function POST(request: Request) {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Sign in to pin tokens.', locked: true }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = (body.contractAddress ?? body.ca ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing contractAddress.' }, { status: 400 });
    }
    const chain =
      body.chain === 'bsc' ? 'bsc' : body.chain === 'ethereum' ? 'ethereum' : 'solana';
    const validation = validateAddressByChain(contractAddress, chain);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const symbol = typeof body.symbol === 'string' ? body.symbol : null;
    const name = typeof body.name === 'string' ? body.name : null;

    await (prisma as unknown as { pinnedToken: { upsert: (args: unknown) => Promise<unknown> } }).pinnedToken.upsert({
      where: {
        userId_contractAddress: { userId, contractAddress },
      },
      create: {
        userId,
        contractAddress,
        chain,
        symbol,
        name,
        lastAnalyzedAt: null,
        analysisResult: null,
      },
      update: {
        chain,
        symbol: symbol ?? undefined,
        name: name ?? undefined,
        lastAnalyzedAt: null,
        analysisResult: null,
      },
    });

    return NextResponse.json({ success: true, message: 'Pinned. Next AI update in ~3 min.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to pin';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE /api/pins?contractAddress=xxx — remove a pin */
export async function DELETE(request: Request) {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Sign in to manage pins.', locked: true }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contractAddress = (searchParams.get('contractAddress') ?? searchParams.get('ca') ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing contractAddress query.' }, { status: 400 });
    }
    // Accept Solana mint or EVM 0x so unpinning works across chains
    if (!isValidSolanaAddress(contractAddress) && !isValidBscAddress(contractAddress)) {
      return NextResponse.json({ success: false, error: 'Invalid contract address.' }, { status: 400 });
    }

    await (prisma as unknown as { pinnedToken: { deleteMany: (args: { where: { userId: string; contractAddress: string } }) => Promise<unknown> } }).pinnedToken.deleteMany({
      where: { userId, contractAddress },
    });

    return NextResponse.json({ success: true, message: 'Unpinned.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to unpin';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
