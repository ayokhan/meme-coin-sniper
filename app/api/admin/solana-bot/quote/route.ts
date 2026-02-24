import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import axios from 'axios';

const JUPITER_QUOTE = 'https://quote-api.jup.ag/v6/quote';
const SOL_DECIMALS = 9;
const DEFAULT_TOKEN_DECIMALS = 6; // many meme coins use 6

/** POST - Get Jupiter quote for Solana swap (owner only). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const tokenMint = (body.tokenMint ?? '').trim();
    const direction = body.direction === 'sell' ? 'sell' : 'buy';
    const amountRaw = body.amount;
    const slippageBps = Math.min(5000, Math.max(1, Number(body.slippageBps) || 100));

    if (!tokenMint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenMint)) {
      return NextResponse.json({ success: false, error: 'Invalid token mint.' }, { status: 400 });
    }

    const amountNum = Number(amountRaw);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount.' }, { status: 400 });
    }

    const inputMint = direction === 'buy' ? 'So11111111111111111111111111111111111111112' : tokenMint;
    const outputMint = direction === 'buy' ? tokenMint : 'So11111111111111111111111111111111111111112';
    const amountInSmallestUnits =
      direction === 'buy'
        ? Math.floor(amountNum * Math.pow(10, SOL_DECIMALS))
        : Math.floor(amountNum * Math.pow(10, DEFAULT_TOKEN_DECIMALS));

    const res = await axios.get(JUPITER_QUOTE, {
      params: {
        inputMint,
        outputMint,
        amount: amountInSmallestUnits.toString(),
        slippageBps,
      },
      timeout: 15000,
    });

    const data = res.data;
    const inAmount = data?.inputMint && data?.inAmount ? data.inAmount : String(amountInSmallestUnits);
    const outAmount = data?.outAmount ?? '0';
    const priceImpactPct = data?.priceImpactPct != null ? String(data.priceImpactPct) : undefined;

    return NextResponse.json({
      success: true,
      quote: {
        inputMint,
        outputMint,
        inAmount,
        outAmount,
        priceImpactPct,
        otherAmountThreshold: data?.otherAmountThreshold,
      },
    });
  } catch (e: unknown) {
    const message = e && typeof e === 'object' && 'response' in e
      ? (e as { response?: { data?: { error?: string }; status?: number } }).response?.data?.error ?? `Jupiter API error`
      : e instanceof Error ? e.message : 'Failed to get quote';
    console.error('Solana bot quote error:', e);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
