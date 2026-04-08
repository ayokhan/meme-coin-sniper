import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/db';
import { getActiveSubscription, getSubscriptionTier, type Tier } from '@/lib/subscription';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      walletAddress?: string | null;
      isPaid: boolean;
      isOwner?: boolean;
      tier?: Tier | null;
      tradingBotOnDemand?: boolean;
      polymarketBotOnDemand?: boolean;
      propFirmBotOnDemand?: boolean;
      ctScanOnDemand?: boolean;
      ctScanOnDemandExpiresAt?: Date | string | null;
      memeCoinsTraderOnDemand?: boolean;
      memeCoinsTraderOnDemandExpiresAt?: Date | string | null;
      novaConnectCommunityRep?: boolean;
      novaConnectAllowedByAdmin?: boolean;
    };
  }
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || !process.env.OWNER_EMAIL) return false;
  const ownerEmails = process.env.OWNER_EMAIL.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return ownerEmails.includes(email.toLowerCase().trim());
}

export function isOwnerWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress || !process.env.OWNER_WALLET_ADDRESSES) return false;
  const ownerWallets = process.env.OWNER_WALLET_ADDRESSES.split(',')
    .map((w) => w.trim())
    .filter(Boolean);
  return ownerWallets.some((w) => w === walletAddress.trim());
}

/** True if session belongs to an owner (by OWNER_EMAIL or OWNER_WALLET_ADDRESSES). */
export function isOwnerSession(session: { user?: { email?: string | null; walletAddress?: string | null } } | null): boolean {
  return !!session?.user && (isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress));
}

/** True if this DB user is an owner (same rules as session). Used to gate server env Blofin keys. */
export async function isOwnerUserId(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const u = await (prisma as { user: { findUnique: (args: unknown) => Promise<{ email: string | null; walletAddress: string | null } | null> } }).user.findUnique({
      where: { id: userId },
      select: { email: true, walletAddress: true },
    });
    if (!u) return false;
    return isOwnerEmail(u.email) || isOwnerWallet(u.walletAddress);
  } catch {
    return false;
  }
}

/** True if session can use Trading Bot: owner or VIP with on-demand access. */
export function canAccessTradingBot(session: { user?: { email?: string | null; walletAddress?: string | null; tier?: Tier | string | null; tradingBotOnDemand?: boolean } } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress)) return true;
  return session.user.tier === 'vip' && !!(session.user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand;
}

/** True if session can use Nova Prop Firm Bot: owner or VIP with on-demand access. */
export function canAccessPropFirmBot(
  session: { user?: { email?: string | null; walletAddress?: string | null; tier?: Tier | string | null; propFirmBotOnDemand?: boolean } } | null
): boolean {
  if (!session?.user) return false;
  if (isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress)) return true;
  return session.user.tier === 'vip' && !!(session.user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand;
}

/** True if session can access CT Scan (Twitter tracker): owner OR VIP with on-demand enabled. */
export function canAccessCtScan(
  session: { user?: { email?: string | null; walletAddress?: string | null; tier?: Tier | string | null; ctScanOnDemand?: boolean; ctScanOnDemandExpiresAt?: Date | string | null } } | null
): boolean {
  if (!session?.user) return false;
  if (isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress)) return true;
  const expiresAtRaw = (session.user as { ctScanOnDemandExpiresAt?: Date | string | null }).ctScanOnDemandExpiresAt;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const onDemandActive = !!(session.user as { ctScanOnDemand?: boolean }).ctScanOnDemand && (!expiresAt || expiresAt.getTime() > Date.now());
  return session.user.tier === 'vip' && onDemandActive;
}

/** True if session can access Meme Coins Traders (Wallet Tracker → Meme): owner OR VIP with on-demand enabled. */
export function canAccessMemeCoinsTrader(
  session: { user?: { email?: string | null; walletAddress?: string | null; tier?: Tier | string | null; memeCoinsTraderOnDemand?: boolean; memeCoinsTraderOnDemandExpiresAt?: Date | string | null } } | null
): boolean {
  if (!session?.user) return false;
  if (isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress)) return true;
  const expiresAtRaw = (session.user as { memeCoinsTraderOnDemandExpiresAt?: Date | string | null }).memeCoinsTraderOnDemandExpiresAt;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const onDemandActive =
    !!(session.user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand && (!expiresAt || expiresAt.getTime() > Date.now());
  return session.user.tier === 'vip' && onDemandActive;
}

function verifyWalletSignature(message: string, signature: string, walletAddress: string): boolean {
  try {
    const pubkey = new PublicKey(walletAddress);
    const sig = bs58.decode(signature);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pubkey.toBytes());
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'email',
      name: 'Email',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user?.hashedPassword) return null;
        const bcrypt = await import('bcrypt');
        const ok = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!ok) return null;
        const isPaid = await getActiveSubscription(user.id);
        const tier = await getSubscriptionTier(user.id);
        const tradingBotOnDemand = !!(user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand;
        const polymarketBotOnDemand = !!(user as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand;
        const propFirmBotOnDemand = !!(user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand;
        const ctScanOnDemand = !!(user as { ctScanOnDemand?: boolean }).ctScanOnDemand;
        const memeCoinsTraderOnDemand = !!(user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand;
        const novaConnectCommunityRep = !!(user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep;
        const novaConnectAllowedByAdmin = !!(user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin;
        return { id: user.id, email: user.email!, name: user.name, image: user.image, walletAddress: null, isPaid, tier, tradingBotOnDemand, polymarketBotOnDemand, propFirmBotOnDemand, ctScanOnDemand, memeCoinsTraderOnDemand, novaConnectCommunityRep, novaConnectAllowedByAdmin };
      },
    }),
    CredentialsProvider({
      id: 'wallet',
      name: 'Wallet',
      credentials: {
        walletAddress: { label: 'Wallet', type: 'text' },
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.walletAddress || !credentials?.message || !credentials?.signature) return null;
        if (!credentials.message.includes('NovaStaris login:')) return null;
        const ok = verifyWalletSignature(
          credentials.message,
          credentials.signature,
          credentials.walletAddress
        );
        if (!ok) return null;
        let user = await prisma.user.findUnique({ where: { walletAddress: credentials.walletAddress } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              walletAddress: credentials.walletAddress,
              name: `${credentials.walletAddress.slice(0, 4)}…${credentials.walletAddress.slice(-4)}`,
            },
          });
        }
        const isPaid = await getActiveSubscription(user.id);
        const tier = await getSubscriptionTier(user.id);
        const tradingBotOnDemand = !!(user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand;
        const polymarketBotOnDemand = !!(user as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand;
        const propFirmBotOnDemand = !!(user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand;
        const ctScanOnDemand = !!(user as { ctScanOnDemand?: boolean }).ctScanOnDemand;
        const memeCoinsTraderOnDemand = !!(user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand;
        const novaConnectCommunityRep = !!(user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep;
        const novaConnectAllowedByAdmin = !!(user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin;
        return { id: user.id, email: user.email ?? null, name: user.name, image: user.image, walletAddress: user.walletAddress ?? credentials.walletAddress, isPaid, tier, tradingBotOnDemand, polymarketBotOnDemand, propFirmBotOnDemand, ctScanOnDemand, memeCoinsTraderOnDemand, novaConnectCommunityRep, novaConnectAllowedByAdmin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.walletAddress = (user as { walletAddress?: string | null }).walletAddress ?? null;
        token.isPaid = (user as { isPaid?: boolean }).isPaid ?? false;
        token.tier = (user as { tier?: Tier | null }).tier ?? null;
        token.tradingBotOnDemand = (user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand ?? false;
        token.polymarketBotOnDemand = (user as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand ?? false;
        token.propFirmBotOnDemand = (user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand ?? false;
        token.ctScanOnDemand = (user as { ctScanOnDemand?: boolean }).ctScanOnDemand ?? false;
        token.memeCoinsTraderOnDemand = (user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand ?? false;
        token.novaConnectCommunityRep = (user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep ?? false;
        token.novaConnectAllowedByAdmin = (user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string | null;
        session.user.name = token.name as string | null;
        session.user.image = token.picture as string | null;
        session.user.walletAddress = token.walletAddress as string | null;
        let isPaid = (token.isPaid as boolean) ?? false;
        let tier = (token.tier as Tier | null) ?? null;
        let tradingBotOnDemand = (token.tradingBotOnDemand as boolean) ?? false;
        let polymarketBotOnDemand = (token.polymarketBotOnDemand as boolean) ?? false;
        let propFirmBotOnDemand = (token.propFirmBotOnDemand as boolean) ?? false;
        let ctScanOnDemand = (token.ctScanOnDemand as boolean) ?? false;
        let ctScanOnDemandExpiresAt: Date | string | null | undefined =
          (token as { ctScanOnDemandExpiresAt?: Date | string | null }).ctScanOnDemandExpiresAt ?? null;
        let memeCoinsTraderOnDemand = (token.memeCoinsTraderOnDemand as boolean) ?? false;
        let memeCoinsTraderOnDemandExpiresAt: Date | string | null | undefined =
          (token as { memeCoinsTraderOnDemandExpiresAt?: Date | string | null }).memeCoinsTraderOnDemandExpiresAt ?? null;
        let novaConnectCommunityRep = (token.novaConnectCommunityRep as boolean) ?? false;
        let novaConnectAllowedByAdmin = (token.novaConnectAllowedByAdmin as boolean) ?? false;
        const owner = isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress);
        if (owner) {
          isPaid = true;
          tier = 'vip';
          tradingBotOnDemand = true;
          polymarketBotOnDemand = true;
          propFirmBotOnDemand = true;
          ctScanOnDemand = true;
          ctScanOnDemandExpiresAt = null;
          memeCoinsTraderOnDemand = true;
          memeCoinsTraderOnDemandExpiresAt = null;
        } else {
          const uid = token.id as string | undefined;
          if (uid) {
            try {
              const fresh = await (
                prisma as {
                  user: {
                    findUnique: (args: unknown) => Promise<{
                      tradingBotOnDemand: boolean;
                      polymarketBotOnDemand: boolean;
                      propFirmBotOnDemand: boolean;
                      ctScanOnDemand: boolean;
                      ctScanOnDemandExpiresAt: Date | null;
                      memeCoinsTraderOnDemand: boolean;
                      memeCoinsTraderOnDemandExpiresAt: Date | null;
                      novaConnectCommunityRep: boolean;
                      novaConnectAllowedByAdmin: boolean;
                    } | null>;
                  };
                }
              ).user.findUnique({
                where: { id: uid },
                select: {
                  tradingBotOnDemand: true,
                  polymarketBotOnDemand: true,
                  propFirmBotOnDemand: true,
                  ctScanOnDemand: true,
                  ctScanOnDemandExpiresAt: true,
                  memeCoinsTraderOnDemand: true,
                  memeCoinsTraderOnDemandExpiresAt: true,
                  novaConnectCommunityRep: true,
                  novaConnectAllowedByAdmin: true,
                },
              });
              if (fresh) {
                tradingBotOnDemand = !!fresh.tradingBotOnDemand;
                polymarketBotOnDemand = !!fresh.polymarketBotOnDemand;
                propFirmBotOnDemand = !!fresh.propFirmBotOnDemand;
                ctScanOnDemand = !!fresh.ctScanOnDemand;
                ctScanOnDemandExpiresAt = fresh.ctScanOnDemandExpiresAt;
                memeCoinsTraderOnDemand = !!fresh.memeCoinsTraderOnDemand;
                memeCoinsTraderOnDemandExpiresAt = fresh.memeCoinsTraderOnDemandExpiresAt;
                novaConnectCommunityRep = !!fresh.novaConnectCommunityRep;
                novaConnectAllowedByAdmin = !!fresh.novaConnectAllowedByAdmin;
              }
            } catch {
              /* keep values derived from JWT */
            }
          }
        }
        session.user.isPaid = isPaid;
        session.user.isOwner = owner;
        session.user.tier = tier;
        session.user.tradingBotOnDemand = tradingBotOnDemand;
        session.user.polymarketBotOnDemand = polymarketBotOnDemand;
        session.user.propFirmBotOnDemand = propFirmBotOnDemand;
        session.user.ctScanOnDemand = ctScanOnDemand;
        session.user.ctScanOnDemandExpiresAt = ctScanOnDemandExpiresAt ?? null;
        session.user.memeCoinsTraderOnDemand = memeCoinsTraderOnDemand;
        session.user.memeCoinsTraderOnDemandExpiresAt = memeCoinsTraderOnDemandExpiresAt ?? null;
        session.user.novaConnectCommunityRep = novaConnectCommunityRep;
        session.user.novaConnectAllowedByAdmin = novaConnectAllowedByAdmin;
      }
      return session;
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/register', newUser: '/register' },
  secret: process.env.NEXTAUTH_SECRET,
};
