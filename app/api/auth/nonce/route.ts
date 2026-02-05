import { NextResponse } from 'next/server';

/** GET ?wallet=xxx - returns a message for the user to sign with their Solana wallet. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.trim();
  if (!wallet) {
    return NextResponse.json({ success: false, error: 'Wallet address required.' }, { status: 400 });
  }
  const nonce = crypto.randomUUID();
  const message = `NovaStaris login: ${Date.now()}:${nonce}`;
  return NextResponse.json({ success: true, message });
}
