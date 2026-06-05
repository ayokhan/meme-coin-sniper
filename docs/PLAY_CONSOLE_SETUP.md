# Play Console setup — NovaStaris

Use this while creating the app in [Google Play Console](https://play.google.com/console).

**App ID (package name):** `ai.novastaris.app` — must match exactly when you create the app.

---

## Step 1: Finish developer account

If the banner still says “finish setting up your developer account”, complete identity verification and payment first.

---

## Step 2: Create app

| Field | Value |
|--------|--------|
| App name | NovaStaris |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |

Decline Play App Signing enrollment **only if** you want to manage keys yourself. **Recommended:** enroll in **Google Play App Signing** (Google holds the upload key; easier recovery).

---

## Step 3: Store listing (Main store listing)

**Short description** (max 80 characters):

```
AI trading intelligence for meme coins, crypto futures, and prediction markets.
```

**Full description:**

```
NovaStaris is your AI-powered crypto trading workspace.

• Meme coin discovery and wallet tracking
• Crypto futures and perps intelligence
• Prediction market tools and analysis
• Community and live market insights

Sign in with your existing NovaStaris account from novastaris.ai. Subscriptions and billing are managed on the web — the app gives you mobile access to the same dashboard.

NovaStaris provides research and intelligence tools only. It is not a broker and does not execute trades on your behalf.
```

**App category:** Finance (or Productivity if Finance triggers extra review)

**Contact email:** your support email (same as on novastaris.ai)

**Privacy policy URL:** `https://novastaris.ai/privacy`

**Terms URL (optional):** `https://novastaris.ai/terms`

### Graphics (required before publish)

| Asset | Size | How to get it |
|--------|------|----------------|
| App icon | 512×512 PNG | Export NovaStaris logo |
| Feature graphic | 1024×500 PNG | Banner with logo + tagline |
| Phone screenshots | Min 2, 16:9 or 9:16 | Capture from emulator (you already have a good home screen shot) |

---

## Step 4: App content (required forms)

### Privacy policy
URL: `https://novastaris.ai/privacy`

### Ads
Select **No**, unless you add ad SDKs later.

### Content rating
Start questionnaire → category **Utility, Productivity, Communication, or Other** → answer honestly (no violence, gambling app itself, etc.). NovaStaris is a finance *information* app.

### Target audience
**18+** recommended (crypto/finance content).

### Data safety (summary — adjust if your analytics differ)

| Data type | Collected? | Purpose |
|-----------|------------|---------|
| Email address | Yes | Account / sign-in |
| Name | Optional | Profile |
| User IDs | Yes | Authentication |
| App interactions | Yes | Analytics / product improvement |
| Crash logs | Maybe | Stability (if enabled) |

**Data encrypted in transit:** Yes  
**Users can request deletion:** Yes (via support / account settings on web)  
**Data shared with third parties:** Declare Stripe, Vercel, analytics providers as applicable

### Financial features
Declare that the app provides **financial information or news**, not brokerage or money transmission.

---

## Step 5: Upload the bundle (Internal testing first)

1. **Release → Testing → Internal testing**
2. **Create new release**
3. Upload: `android/app/build/outputs/bundle/release/app-release.aab`
4. Release name: `1.0.0 (1)` — first release
5. Release notes: `Initial Android release — NovaStaris mobile access to novastaris.ai`
6. Add yourself as an **internal tester** (Release → Testers → create email list)
7. **Review release → Start rollout**

Install from the **internal testing link** on your phone (not sideload the AAB directly).

---

## Step 6: After internal test passes

1. Promote to **Closed testing** or **Production**
2. Complete any remaining “Policy” checklist items in the dashboard
3. Submit for review (typically 1–3 days)

---

## Keystore reminder

Your upload keystore lives at `android/novastaris-release.keystore` (not in git).  
Passwords are in `android/keystore.properties` (local only). **Back both up** — you need them for every future update.

If you enrolled in Play App Signing, Google re-signs for users; you still need your upload key for new builds.

---

## Subscriptions note

Do **not** add a prominent “Subscribe with Stripe” flow inside the Android app for the same digital access. Users who subscribed on the web should **sign in** in the app. That matches Google’s usual pattern for v1.
