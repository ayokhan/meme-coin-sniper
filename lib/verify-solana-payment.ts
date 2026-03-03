/**
 * Verify a Solana transaction sent USDC to our payment wallet.
 * Uses RPC getParsedTransaction and derives our USDC ATA for comparison.
 *
 * Env: SOLANA_RPC_URL (preferred) or HELIUS_API_KEY.
 * For reliable verification under load (avoid 429s), use a dedicated RPC:
 * - Helius paid tier (dashboard.helius.dev) or
 * - Another provider (QuickNode, Triton, etc.) and set SOLANA_RPC_URL.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const USDC_DECIMALS = 6;

function getRpcUrl(): string | null {
  const url = process.env.SOLANA_RPC_URL?.trim();
  if (url) return url;
  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  return null;
}

// Solana tx signatures are base58, typically 87–88 chars. Reject obviously invalid input so we don't hit the RPC.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
function isValidTxSignatureFormat(sig: string): boolean {
  const t = sig.trim();
  return t.length >= 80 && t.length <= 100 && BASE58.test(t);
}

/**
 * Verify that the transaction sent at least minAmountUsd USDC to recipientWallet.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function verifyUsdcPayment(
  txSignature: string,
  recipientWallet: string,
  usdcMint: string,
  minAmountUsd: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidTxSignatureFormat(txSignature)) {
    return { ok: false, error: 'Invalid or unknown transaction signature. Check the signature and try again.' };
  }

  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    return { ok: false, error: 'Solana RPC not configured. Set SOLANA_RPC_URL or HELIUS_API_KEY.' };
  }

  const connection = new Connection(rpcUrl);
  const minAmountRaw = BigInt(Math.floor(minAmountUsd * 10 ** USDC_DECIMALS));

  const fetchTx = () =>
    connection.getParsedTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

  let tx;
  try {
    tx = await fetchTx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('max usage')) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        tx = await fetchTx();
      } catch (retryErr) {
        return { ok: false, error: 'High load on our verification service. Try again in a minute or use a different network time.' };
      }
    } else if (msg.includes('not found') || msg.includes('could not find') || msg.includes('unknown')) {
      return { ok: false, error: 'Invalid or unknown transaction signature. Check the signature and try again.' };
    } else {
      return { ok: false, error: `Could not fetch transaction: ${msg}` };
    }
  }

  if (!tx?.meta) {
    return { ok: false, error: 'Transaction not found or not confirmed.' };
  }

  const meta = tx.meta;
  const preToken = meta.preTokenBalances ?? [];
  const postToken = meta.postTokenBalances ?? [];

  // Build full account key list (static + loaded from address lookup tables)
  const message = tx.transaction.message as { accountKeys: Array<{ pubkey: PublicKey | string }> };
  const staticKeys = message.accountKeys.map((acc) =>
    typeof acc.pubkey === 'string' ? acc.pubkey : (acc.pubkey as PublicKey).toBase58()
  );
  const loaded = meta.loadedAddresses as { writable?: (PublicKey | string)[]; readonly?: (PublicKey | string)[] } | undefined;
  const writable = loaded?.writable?.map((pk) => (typeof pk === 'string' ? pk : (pk as PublicKey).toBase58())) ?? [];
  const readonly = loaded?.readonly?.map((pk) => (typeof pk === 'string' ? pk : (pk as PublicKey).toBase58())) ?? [];
  const allAccountKeys: string[] = [...staticKeys, ...writable, ...readonly];

  // Our wallet's USDC Associated Token Account
  let ourAta: string;
  try {
    const mintPk = new PublicKey(usdcMint);
    const ownerPk = new PublicKey(recipientWallet);
    const ata = getAssociatedTokenAddressSync(mintPk, ownerPk);
    ourAta = ata.toBase58();
  } catch {
    return { ok: false, error: 'Invalid payment wallet or USDC mint.' };
  }

  // Find post-balance for our ATA and USDC mint
  let postAmountRaw = BigInt(0);
  let preAmountRaw = BigInt(0);

  for (const post of postToken) {
    if (post.mint !== usdcMint) continue;
    if (post.accountIndex >= allAccountKeys.length) continue;
    const tokenAccountKey = allAccountKeys[post.accountIndex];
    if (tokenAccountKey !== ourAta) continue;
    const amountStr = (post as { uiTokenAmount?: { amount?: string } }).uiTokenAmount?.amount ?? '0';
    postAmountRaw = BigInt(amountStr);
    const pre = preToken.find((p) => p.accountIndex === post.accountIndex && p.mint === usdcMint);
    const preAmount = (pre as { uiTokenAmount?: { amount?: string } } | undefined)?.uiTokenAmount?.amount;
    if (preAmount) preAmountRaw = BigInt(preAmount);
    break;
  }

  const received = postAmountRaw - preAmountRaw;
  if (received < minAmountRaw) {
    return {
      ok: false,
      error: `Insufficient or wrong payment. Expected at least ${minAmountUsd} USDC to ${recipientWallet}.`,
    };
  }

  return { ok: true };
}
