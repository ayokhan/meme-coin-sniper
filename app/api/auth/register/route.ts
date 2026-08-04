import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';
import { applyReferralOnSignup } from '@/lib/referral-commission';
import { normalizeReferralCode } from '@/lib/referral-program';
import { readReferralCodeFromCookies } from '@/lib/referral-cookie-server';
import { geoFromRequest } from '@/lib/login-events';
import { sendWelcomeEmailToUser } from '@/lib/send-welcome-email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email ?? '').toString().trim().toLowerCase();
    const password = (body.password ?? '').toString();
    const name = (body.name ?? '').toString().trim() || email.split('@')[0];
    const preferredName = (body.preferredName ?? '').toString().trim() || undefined;
    const avatarUrl = (body.avatarUrl ?? '').toString().trim() || undefined;
    const phone = (body.phone ?? '').toString().trim() || undefined;
    const country = (body.country ?? '').toString().trim() || undefined;
    const experienceTradingCrypto = (body.experienceTradingCrypto ?? '').toString().trim() || undefined;
    const newsletterOptIn = Boolean(body.newsletterOptIn);
    const novaConnectOptIn = body.novaConnectOptIn === undefined ? true : Boolean(body.novaConnectOptIn);
    const geo = geoFromRequest(request);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Valid email is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralFromBody = normalizeReferralCode((body.referralCode ?? body.ref ?? '').toString());
    const referralFromCookie = await readReferralCodeFromCookies();
    const referralCode = referralFromBody ?? referralFromCookie;

    const created = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        name,
        phone,
        country,
        registeredCountry: geo.country ?? undefined,
        registeredCity: geo.city ?? undefined,
        registeredIpHash: geo.ipHash ?? undefined,
        experienceTradingCrypto,
        newsletterOptIn,
        novaConnectOptIn,
        novaConnectDisplayName: preferredName,
        novaConnectAvatarUrl: avatarUrl,
      } as any,
    });

    if (referralCode) {
      await applyReferralOnSignup(created.id, referralCode);
    }

    // Auto welcome; never block signup if mail fails
    void sendWelcomeEmailToUser(created.email);

    return NextResponse.json({ success: true, message: 'Account created. You can sign in.' });
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ success: false, error: 'Registration failed.' }, { status: 500 });
  }
}
