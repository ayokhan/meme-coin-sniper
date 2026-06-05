# NovaStaris Android (Google Play)

Capacitor wraps a native Android shell that loads **https://novastaris.ai**. Your web app stays on Vercel; the Play Store app is a WebView client.

## Google Play Console: which account type?

| Option | Choose when |
|--------|-------------|
| **Yourself** | Solo developer, no registered company yet. Fastest to start today. Developer name shows as your personal name. |
| **An organization → A company or business** | NovaStaris is a registered business (LLC, Ltd, etc.). Better for brand trust and some restricted categories. Requires business verification (D-U-N-S or similar). |

**Recommendation for today:** pick **Yourself** if you do not have a verified company entity yet. You can still publish NovaStaris and accept payments for existing web subscribers. Switch or add an organization account later if you formalize the business.

**Note:** Some app categories (certain finance/government apps) require an organization. NovaStaris as a trading *intelligence* SaaS (not a broker) usually works on a personal account, but read Google’s “Learn more” on that screen if Play flags your category during setup.

Pay the **$25** registration fee, complete identity verification, then continue below.

---

## Prerequisites (Windows)

1. [Android Studio](https://developer.android.com/studio) (includes SDK Manager)
2. **JDK 17** (Android Studio usually bundles this)
3. Google Play Console account (above)
4. Optional: physical Android phone with USB debugging for testing

---

## Project commands

From repo root:

```powershell
npm install
npm run cap:sync
npm run cap:open:android
```

- `cap:sync` — copies `public/` assets and Capacitor config into `android/`
- `cap:open:android` — opens the project in Android Studio

The app loads production via `capacitor.config.ts`:

```ts
server: { url: "https://novastaris.ai" }
```

To point at a preview URL temporarily, change `server.url`, run `npm run cap:sync`, rebuild.

---

## First run (Android Studio)

1. **File → Open** → select the `android/` folder in this repo.
2. Wait for Gradle sync to finish.
3. Connect a phone or start an emulator (**Pixel 7** API 34+ recommended).
4. Click **Run ▶** (green triangle).

You should see the NovaStaris splash, then the live dashboard.

---

## App icon & splash (before Play upload)

1. In Android Studio: **File → New → Image Asset**
2. Target: **Launcher Icons** → replace `ic_launcher`
3. Use a **512×512** NovaStaris logo (PNG, no transparency issues for adaptive icon)
4. For splash: edit `android/app/src/main/res/drawable*/splash.png` or use Capacitor Splash Screen plugin settings in `capacitor.config.ts`

Also add store assets in Play Console:

- **512×512** hi-res icon
- **Phone screenshots** (至少 2): capture from emulator or device

---

## Build a signed release (AAB for Play Store)

### 1. Create a keystore (once)

```powershell
keytool -genkey -v -keystore novastaris-release.keystore -alias novastaris -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore and passwords safely. **Never commit** `.keystore` / `.jks` files (already in `.gitignore`).

### 2. Configure signing in Android Studio

1. **Build → Generate Signed App Bundle / APK**
2. Choose **Android App Bundle**
3. Select your keystore, alias, passwords
4. Build variant: **release**
5. Output: `android/app/release/app-release.aab`

Or set up `signingConfigs` in `android/app/build.gradle` for repeat builds (keep secrets local).

---

## Upload to Google Play

1. Play Console → **Create app**
2. **Internal testing** track (fastest validation)
3. Upload **app-release.aab**
4. Complete required forms:
   - **Privacy policy:** `https://novastaris.ai/privacy`
   - **Data safety** (declare account, analytics, etc.)
   - **Content rating** questionnaire
   - **Target audience**
5. Add testers (email list) for internal test
6. Roll out internal test → install from Play Store link on your phone

**Production** review typically takes **1–3 days** after internal test looks good.

---

## Subscriptions (important)

The Android app should **sign in** users who subscribed on **https://novastaris.ai/subscribe** (Stripe on web).

Avoid a prominent “Subscribe via Stripe” button inside the app that bypasses Google Play Billing for the same digital access—Google may reject or restrict that. Existing web subscribers logging in is the usual pattern for v1.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank white screen | Check phone has internet; confirm `novastaris.ai` loads in Chrome |
| Login/session lost | WebView cookies; ensure users sign in inside the app; test NextAuth flow |
| Gradle sync failed | Install SDK Platform 34+ in SDK Manager |
| App shows old site | `npm run cap:sync` and rebuild; WebView loads live URL (no stale bundle for main UI) |

---

## Files added

| Path | Purpose |
|------|---------|
| `capacitor.config.ts` | App ID, name, production URL |
| `android/` | Native Android project |
| `public/index.html` | Capacitor placeholder (runtime uses remote URL) |
| `public/manifest.json` | Web manifest (optional PWA hints) |

App ID: **`ai.novastaris.app`**
