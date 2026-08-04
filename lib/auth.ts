import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/db';
import { getActiveSubscription, getSubscriptionTier, normalizeSubscriptionTier, type Tier } from '@/lib/subscription';

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
      customersViewerAdmin?: boolean;
      supportViewerAdmin?: boolean;
      liveChatAgentAdmin?: boolean;
      supportStaffName?: string | null;
      isCoachUser?: boolean;
      tier?: Tier | null;
      tradingBotOnDemand?: boolean;
      polymarketBotOnDemand?: boolean;
      propFirmBotOnDemand?: boolean;
      novaUltimateOnDemand?: boolean;
      novaJobAgentOnDemand?: boolean;
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

/** True if this DB user is marked as a coach user by owner/admin. */
export async function isCoachUserId(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const u = await (prisma as { user: { findUnique: (args: unknown) => Promise<{ coachUser: boolean } | null> } }).user.findUnique({
      where: { id: userId },
      select: { coachUser: true },
    });
    return !!u?.coachUser;
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

export async function buildJwtTokenForUserId(userId: string): Promise<string | null> {
  const fresh = await getAuthUserStateById(userId);
  if (!fresh) return null;
  const maxAge = 30 * 24 * 60 * 60;
  const { encode } = await import('next-auth/jwt');
  return encode({
    token: {
      sub: fresh.id,
      id: fresh.id,
      email: fresh.email,
      name: fresh.name,
      picture: fresh.image,
      walletAddress: fresh.walletAddress,
      isPaid: fresh.isPaid,
      tier: fresh.tier,
      isCoachUser: fresh.isCoachUser,
      customersViewerAdmin: fresh.customersViewerAdmin,
      supportViewerAdmin: fresh.supportViewerAdmin,
      liveChatAgentAdmin: fresh.liveChatAgentAdmin,
      supportStaffName: fresh.supportStaffName,
      tradingBotOnDemand: fresh.tradingBotOnDemand,
      polymarketBotOnDemand: fresh.polymarketBotOnDemand,
      propFirmBotOnDemand: fresh.propFirmBotOnDemand,
      novaUltimateOnDemand: fresh.novaUltimateOnDemand,
      novaJobAgentOnDemand: fresh.novaJobAgentOnDemand,
      ctScanOnDemand: fresh.ctScanOnDemand,
      memeCoinsTraderOnDemand: fresh.memeCoinsTraderOnDemand,
      novaConnectCommunityRep: fresh.novaConnectCommunityRep,
      novaConnectAllowedByAdmin: fresh.novaConnectAllowedByAdmin,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge,
  });
}

async function getAuthUserStateById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const isPaid = await getActiveSubscription(user.id);
  const tier = await getSubscriptionTier(user.id);
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    walletAddress: user.walletAddress ?? null,
    isPaid,
    tier,
    isCoachUser: !!(user as { coachUser?: boolean }).coachUser,
    customersViewerAdmin: !!(user as { customersViewerAdmin?: boolean }).customersViewerAdmin,
    supportViewerAdmin: !!(user as { supportViewerAdmin?: boolean }).supportViewerAdmin,
    liveChatAgentAdmin: !!(user as { liveChatAgentAdmin?: boolean }).liveChatAgentAdmin,
    supportStaffName: (user as { supportStaffName?: string | null }).supportStaffName ?? null,
    tradingBotOnDemand: !!(user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand,
    polymarketBotOnDemand: !!(user as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand,
    propFirmBotOnDemand: !!(user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand,
    novaUltimateOnDemand: !!(user as { novaUltimateOnDemand?: boolean }).novaUltimateOnDemand,
    novaJobAgentOnDemand: !!(user as { novaJobAgentOnDemand?: boolean }).novaJobAgentOnDemand,
    ctScanOnDemand: !!(user as { ctScanOnDemand?: boolean }).ctScanOnDemand,
    memeCoinsTraderOnDemand: !!(user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand,
    novaConnectCommunityRep: !!(user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep,
    novaConnectAllowedByAdmin: !!(user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin,
  };
}

async function upsertGoogleUser(params: { email: string; name?: string | null; image?: string | null }) {
  const email = params.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: params.name ?? email.split('@')[0] ?? 'User',
        image: params.image ?? undefined,
      },
    });
    const newUserId = user.id;
    void import('@/lib/send-welcome-email').then(({ sendWelcomeEmailToUser }) =>
      sendWelcomeEmailToUser(email, { userId: newUserId, source: "google" })
    );
  } else {
    const shouldUpdateName = !user.name && !!params.name;
    const shouldUpdateImage = !user.image && !!params.image;
    if (shouldUpdateName || shouldUpdateImage) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(shouldUpdateName ? { name: params.name } : {}),
          ...(shouldUpdateImage ? { image: params.image } : {}),
        },
      });
    }
  }
  return user;
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'email',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        otpCode: { label: '2FA code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const { verifyPasswordAndGetUser, verifyTwoFactorForUser, shouldRequireTwoFactor } = await import('@/lib/two-factor');
        const user = await verifyPasswordAndGetUser(credentials.email, credentials.password);
        if (!user) return null;
        if (await shouldRequireTwoFactor(user)) {
          const otp = credentials.otpCode?.trim() ?? '';
          if (!otp) throw new Error('2FA_REQUIRED');
          const ok = await verifyTwoFactorForUser(user, otp);
          if (!ok) return null;
        }
        const isPaid = await getActiveSubscription(user.id);
        const tier = await getSubscriptionTier(user.id);
        const tradingBotOnDemand = !!(user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand;
        const polymarketBotOnDemand = !!(user as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand;
        const propFirmBotOnDemand = !!(user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand;
        const novaUltimateOnDemand = !!(user as { novaUltimateOnDemand?: boolean }).novaUltimateOnDemand;
        const novaJobAgentOnDemand = !!(user as { novaJobAgentOnDemand?: boolean }).novaJobAgentOnDemand;
        const ctScanOnDemand = !!(user as { ctScanOnDemand?: boolean }).ctScanOnDemand;
        const memeCoinsTraderOnDemand = !!(user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand;
        const novaConnectCommunityRep = !!(user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep;
        const novaConnectAllowedByAdmin = !!(user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin;
        const isCoachUser = !!(user as { coachUser?: boolean }).coachUser;
        const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!fullUser) return null;
        return {
          id: fullUser.id,
          email: fullUser.email!,
          name: fullUser.name,
          image: fullUser.image,
          walletAddress: null,
          isPaid,
          tier,
          isCoachUser,
          tradingBotOnDemand,
          polymarketBotOnDemand,
          propFirmBotOnDemand,
          novaUltimateOnDemand,
          novaJobAgentOnDemand,
          ctScanOnDemand,
          memeCoinsTraderOnDemand,
          novaConnectCommunityRep,
          novaConnectAllowedByAdmin,
        };
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
        const novaUltimateOnDemand = !!(user as { novaUltimateOnDemand?: boolean }).novaUltimateOnDemand;
        const novaJobAgentOnDemand = !!(user as { novaJobAgentOnDemand?: boolean }).novaJobAgentOnDemand;
        const ctScanOnDemand = !!(user as { ctScanOnDemand?: boolean }).ctScanOnDemand;
        const memeCoinsTraderOnDemand = !!(user as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand;
        const novaConnectCommunityRep = !!(user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep;
        const novaConnectAllowedByAdmin = !!(user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin;
        const isCoachUser = !!(user as { coachUser?: boolean }).coachUser;
        return { id: user.id, email: user.email ?? null, name: user.name, image: user.image, walletAddress: user.walletAddress ?? credentials.walletAddress, isPaid, tier, isCoachUser, tradingBotOnDemand, polymarketBotOnDemand, propFirmBotOnDemand, novaUltimateOnDemand, novaJobAgentOnDemand, ctScanOnDemand, memeCoinsTraderOnDemand, novaConnectCommunityRep, novaConnectAllowedByAdmin };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const email = String(profile?.email ?? '').trim().toLowerCase();
        if (!email) return false;
        return true;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google') {
        const email = String((profile as { email?: string } | undefined)?.email ?? token.email ?? '').trim().toLowerCase();
        if (email) {
          const gUser = await upsertGoogleUser({
            email,
            name: (profile as { name?: string } | undefined)?.name ?? token.name ?? null,
            image: (profile as { picture?: string } | undefined)?.picture ?? token.picture ?? null,
          });
          const fresh = await getAuthUserStateById(gUser.id);
          if (fresh) {
            token.id = fresh.id;
            token.email = fresh.email;
            token.name = fresh.name;
            token.picture = fresh.image;
            token.walletAddress = fresh.walletAddress;
            token.isPaid = fresh.isPaid;
            token.tier = fresh.tier;
            token.isCoachUser = fresh.isCoachUser;
            token.customersViewerAdmin = fresh.customersViewerAdmin;
            token.supportViewerAdmin = fresh.supportViewerAdmin;
            token.liveChatAgentAdmin = fresh.liveChatAgentAdmin;
            token.supportStaffName = fresh.supportStaffName;
            token.tradingBotOnDemand = fresh.tradingBotOnDemand;
            token.polymarketBotOnDemand = fresh.polymarketBotOnDemand;
            token.propFirmBotOnDemand = fresh.propFirmBotOnDemand;
            token.novaUltimateOnDemand = fresh.novaUltimateOnDemand;
            token.novaJobAgentOnDemand = fresh.novaJobAgentOnDemand;
            token.ctScanOnDemand = fresh.ctScanOnDemand;
            token.memeCoinsTraderOnDemand = fresh.memeCoinsTraderOnDemand;
            token.novaConnectCommunityRep = fresh.novaConnectCommunityRep;
            token.novaConnectAllowedByAdmin = fresh.novaConnectAllowedByAdmin;
            return token;
          }
        }
      }

      if (!user && token?.email) {
        const email = String(token.email).trim().toLowerCase();
        if (email) {
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) {
            const fresh = await getAuthUserStateById(dbUser.id);
            if (fresh) {
              token.id = fresh.id;
              token.email = fresh.email;
              token.name = fresh.name;
              token.picture = fresh.image;
              token.walletAddress = fresh.walletAddress;
              token.isPaid = fresh.isPaid;
              token.tier = fresh.tier;
              token.isCoachUser = fresh.isCoachUser;
              token.customersViewerAdmin = fresh.customersViewerAdmin;
              token.tradingBotOnDemand = fresh.tradingBotOnDemand;
              token.polymarketBotOnDemand = fresh.polymarketBotOnDemand;
              token.propFirmBotOnDemand = fresh.propFirmBotOnDemand;
              token.novaUltimateOnDemand = fresh.novaUltimateOnDemand;
              token.novaJobAgentOnDemand = fresh.novaJobAgentOnDemand;
              token.ctScanOnDemand = fresh.ctScanOnDemand;
              token.memeCoinsTraderOnDemand = fresh.memeCoinsTraderOnDemand;
              token.novaConnectCommunityRep = fresh.novaConnectCommunityRep;
              token.novaConnectAllowedByAdmin = fresh.novaConnectAllowedByAdmin;
            }
          }
        }
      }

      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.walletAddress = (user as { walletAddress?: string | null }).walletAddress ?? null;
        token.isPaid = (user as { isPaid?: boolean }).isPaid ?? false;
        token.tier = (user as { tier?: Tier | null }).tier ?? null;
        token.isCoachUser = (user as { isCoachUser?: boolean }).isCoachUser ?? false;
        token.customersViewerAdmin = (user as { customersViewerAdmin?: boolean }).customersViewerAdmin ?? false;
        token.supportViewerAdmin = (user as { supportViewerAdmin?: boolean }).supportViewerAdmin ?? false;
        token.liveChatAgentAdmin = (user as { liveChatAgentAdmin?: boolean }).liveChatAgentAdmin ?? false;
        token.supportStaffName = (user as { supportStaffName?: string | null }).supportStaffName ?? null;
        token.tradingBotOnDemand = (user as { tradingBotOnDemand?: boolean }).tradingBotOnDemand ?? false;
        token.polymarketBotOnDemand = (user as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand ?? false;
        token.propFirmBotOnDemand = (user as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand ?? false;
        token.novaUltimateOnDemand = (user as { novaUltimateOnDemand?: boolean }).novaUltimateOnDemand ?? false;
        token.novaJobAgentOnDemand = (user as { novaJobAgentOnDemand?: boolean }).novaJobAgentOnDemand ?? false;
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
        let isCoachUser = (token as { isCoachUser?: boolean }).isCoachUser ?? false;
        let tradingBotOnDemand = (token.tradingBotOnDemand as boolean) ?? false;
        let polymarketBotOnDemand = (token.polymarketBotOnDemand as boolean) ?? false;
        let propFirmBotOnDemand = (token.propFirmBotOnDemand as boolean) ?? false;
        let novaUltimateOnDemand = (token.novaUltimateOnDemand as boolean) ?? false;
        let novaJobAgentOnDemand = (token.novaJobAgentOnDemand as boolean) ?? false;
        let ctScanOnDemand = (token.ctScanOnDemand as boolean) ?? false;
        let ctScanOnDemandExpiresAt: Date | string | null | undefined =
          (token as { ctScanOnDemandExpiresAt?: Date | string | null }).ctScanOnDemandExpiresAt ?? null;
        let memeCoinsTraderOnDemand = (token.memeCoinsTraderOnDemand as boolean) ?? false;
        let memeCoinsTraderOnDemandExpiresAt: Date | string | null | undefined =
          (token as { memeCoinsTraderOnDemandExpiresAt?: Date | string | null }).memeCoinsTraderOnDemandExpiresAt ?? null;
        let novaConnectCommunityRep = (token.novaConnectCommunityRep as boolean) ?? false;
        let novaConnectAllowedByAdmin = (token.novaConnectAllowedByAdmin as boolean) ?? false;
        let customersViewerAdmin = (token as { customersViewerAdmin?: boolean }).customersViewerAdmin ?? false;
        let supportViewerAdmin = (token as { supportViewerAdmin?: boolean }).supportViewerAdmin ?? false;
        let liveChatAgentAdmin = (token as { liveChatAgentAdmin?: boolean }).liveChatAgentAdmin ?? false;
        let supportStaffName = (token as { supportStaffName?: string | null }).supportStaffName ?? null;
        const owner = isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress);
        if (owner) {
          isPaid = true;
          tier = 'vip';
          tradingBotOnDemand = true;
          polymarketBotOnDemand = true;
          propFirmBotOnDemand = true;
          novaUltimateOnDemand = true;
          novaJobAgentOnDemand = true;
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
                      novaUltimateOnDemand: boolean;
                      novaJobAgentOnDemand: boolean;
                      ctScanOnDemand: boolean;
                      ctScanOnDemandExpiresAt: Date | null;
                      memeCoinsTraderOnDemand: boolean;
                      memeCoinsTraderOnDemandExpiresAt: Date | null;
                      novaConnectCommunityRep: boolean;
                      novaConnectAllowedByAdmin: boolean;
                      coachUser: boolean;
                      customersViewerAdmin: boolean;
                      supportViewerAdmin: boolean;
                      liveChatAgentAdmin: boolean;
                      supportStaffName: string | null;
                    } | null>;
                  };
                }
              ).user.findUnique({
                where: { id: uid },
                select: {
                  tradingBotOnDemand: true,
                  polymarketBotOnDemand: true,
                  propFirmBotOnDemand: true,
                  novaUltimateOnDemand: true,
                  novaJobAgentOnDemand: true,
                  ctScanOnDemand: true,
                  ctScanOnDemandExpiresAt: true,
                  memeCoinsTraderOnDemand: true,
                  memeCoinsTraderOnDemandExpiresAt: true,
                  novaConnectCommunityRep: true,
                  novaConnectAllowedByAdmin: true,
                  coachUser: true,
                  customersViewerAdmin: true,
                  supportViewerAdmin: true,
                  liveChatAgentAdmin: true,
                  supportStaffName: true,
                },
              });
              if (fresh) {
                tradingBotOnDemand = !!fresh.tradingBotOnDemand;
                polymarketBotOnDemand = !!fresh.polymarketBotOnDemand;
                propFirmBotOnDemand = !!fresh.propFirmBotOnDemand;
                novaUltimateOnDemand = !!fresh.novaUltimateOnDemand;
                novaJobAgentOnDemand = !!fresh.novaJobAgentOnDemand;
                ctScanOnDemand = !!fresh.ctScanOnDemand;
                ctScanOnDemandExpiresAt = fresh.ctScanOnDemandExpiresAt;
                memeCoinsTraderOnDemand = !!fresh.memeCoinsTraderOnDemand;
                memeCoinsTraderOnDemandExpiresAt = fresh.memeCoinsTraderOnDemandExpiresAt;
                novaConnectCommunityRep = !!fresh.novaConnectCommunityRep;
                novaConnectAllowedByAdmin = !!fresh.novaConnectAllowedByAdmin;
                isCoachUser = !!fresh.coachUser;
                customersViewerAdmin = !!fresh.customersViewerAdmin;
                supportViewerAdmin = !!fresh.supportViewerAdmin;
                liveChatAgentAdmin = !!fresh.liveChatAgentAdmin;
                supportStaffName = fresh.supportStaffName ?? null;
              }
            } catch {
              /* keep values derived from JWT */
            }
          }
        }
        if (isCoachUser) {
          isPaid = true;
          tier = "vip";
        }
        const normalizedTier = normalizeSubscriptionTier(tier as string | null);
        if (normalizedTier) tier = normalizedTier;
        session.user.isPaid = isPaid;
        session.user.isOwner = owner;
        session.user.isCoachUser = isCoachUser;
        session.user.customersViewerAdmin = owner ? false : customersViewerAdmin;
        session.user.supportViewerAdmin = owner ? false : supportViewerAdmin;
        session.user.liveChatAgentAdmin = owner ? false : liveChatAgentAdmin;
        session.user.supportStaffName = owner ? null : supportStaffName;
        session.user.tier = tier;
        session.user.tradingBotOnDemand = tradingBotOnDemand;
        session.user.polymarketBotOnDemand = polymarketBotOnDemand;
        session.user.propFirmBotOnDemand = propFirmBotOnDemand;
        session.user.novaUltimateOnDemand = novaUltimateOnDemand;
        session.user.novaJobAgentOnDemand = novaJobAgentOnDemand;
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
  events: {
    async signIn({ user, account }) {
      const userId = user?.id;
      if (!userId) return;
      const { recordLoginEvent } = await import("@/lib/login-events");
      await recordLoginEvent({
        userId,
        provider: account?.provider ?? "email",
      });
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/register', newUser: '/register' },
  secret: process.env.NEXTAUTH_SECRET,
};
