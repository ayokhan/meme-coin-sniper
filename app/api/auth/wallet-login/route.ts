import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActiveSubscription } from '@/lib/subscription';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/** Verify a Solana message signature. Message must be the one we issued (e.g. "NovaStaris login: nonce"). */
function verifySignature(message: string, signature: string, walletAddress: string): boolean {
  try {
    const pubkey = new PublicKey(walletAddress);
    const sig = bs58.decode(signature);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pubkey.toBytes());
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const walletAddress = (body.walletAddress ?? body.wallet ?? '').toString().trim();
    const message = (body.message ?? '').toString();
    const signature = (body.signature ?? '').toString();

    if (!walletAddress || !message || !signature) {
      return NextResponse.json({ success: false, error: 'Wallet address, message, and signature are required.' }, { status: 400 });
    }

    if (!verifySignature(message, signature, walletAddress)) {
      return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 401 });
    }

    // Optional: ensure message is our login challenge (e.g. starts with "NovaStaris login:")
    if (!message.includes('NovaStaris')) {
      return NextResponse.json({ success: false, error: 'Invalid message.' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          name: `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`,
        },
      });
    }

    const isPaid = await getActiveSubscription(user.id);
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, isPaid },
      // Client can use this with a custom session or we use NextAuth signIn with credentials passing a token
    });
  } catch (e) {
    console.error('Wallet login error:', e);
    return NextResponse.json({ success: false, error: 'Login failed.' }, { status: 500 });
  }
}
