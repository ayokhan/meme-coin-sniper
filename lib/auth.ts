import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/db';
import { getActiveSubscription } from '@/lib/subscription';

declare module 'next-auth' {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null; isPaid: boolean };
  }
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
        return { id: user.id, email: user.email!, name: user.name, image: user.image, isPaid };
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
        return { id: user.id, email: user.email ?? null, name: user.name, image: user.image, isPaid };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user: authUser, account }) {
      if (account?.provider === 'google' && authUser.email) {
        let user = await prisma.user.findUnique({ where: { email: authUser.email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: authUser.email,
              name: authUser.name ?? undefined,
              image: authUser.image ?? undefined,
            },
          });
        }
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: account.providerAccountId,
            },
          },
          create: {
            userId: user.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token ?? undefined,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at ?? undefined,
          },
          update: {},
        });
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.isPaid = (user as { isPaid?: boolean }).isPaid ?? false;
      }
      if (account?.provider === 'google' && profile?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: profile.email } });
        if (dbUser) {
          token.id = dbUser.id;
          const isPaid = await getActiveSubscription(dbUser.id);
          token.isPaid = isPaid;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string | null;
        session.user.name = token.name as string | null;
        session.user.image = token.picture as string | null;
        session.user.isPaid = (token.isPaid as boolean) ?? false;
      }
      return session;
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/register', newUser: '/register' },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true, // required for Vercel (uses host header for callbacks)
};
