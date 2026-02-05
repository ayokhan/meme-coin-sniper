# Auth & deployment setup

## 1. Database (required for sign-in)

The app uses Prisma with PostgreSQL. Ensure:

- **DATABASE_URL** is set in Vercel (e.g. from Vercel Postgres, Supabase, or Neon).
- Migrations are applied so the `User`, `Account`, and `Subscription` tables exist:

  ```bash
  npx prisma migrate deploy
  ```

  (Run this against your production DB or use your provider’s migration flow.)

If you see *"The table \`public.User\` does not exist"*, the database schema is missing. Create the database, set `DATABASE_URL`, then run `prisma migrate deploy` (or `prisma db push` for a quick sync).

---

## 2. Google sign-in ("OAuth client was not found" / 401 invalid_client)

This means Google doesn’t recognize your **GOOGLE_CLIENT_ID** (and **GOOGLE_CLIENT_SECRET**). Fix it in [Google Cloud Console](https://console.cloud.google.com/):

1. Open **APIs & Services → Credentials**.
2. Create or select a **OAuth 2.0 Client ID** (application type: **Web application**).
3. Under **Authorized redirect URIs**, add:
   - Production: `https://YOUR_VERCEL_DOMAIN/api/auth/callback/google`
   - Example: `https://meme-coin-sniper-git-main-ayo-khans-projects.vercel.app/api/auth/callback/google`
4. Copy the **Client ID** and **Client secret**.
5. In **Vercel → Project → Settings → Environment Variables**, set:
   - **GOOGLE_CLIENT_ID** = that Client ID  
   - **GOOGLE_CLIENT_SECRET** = that Client secret  
   (for Production, or “All Environments” if you use the same app everywhere.)
6. Redeploy the app.

The redirect URI must match exactly (no trailing slash, correct domain and path).

---

## 3. Owner full access (you as app owner)

To give your own account full access without a subscription and access to **Customers** (/admin/customers):

1. In **Vercel → Settings → Environment Variables**, add:
   - **Name:** `OWNER_EMAIL`  
   - **Value:** your email, e.g. `ayokhan2006@gmail.com`  
     For multiple owners use a comma-separated list: `email1@gmail.com,email2@gmail.com`  
     Use the **exact same email** you use to sign in (no extra spaces).
2. **Redeploy** the project (e.g. push a commit or “Redeploy” in Vercel). Env vars apply on the next deployment; existing runs keep the old env.
3. **Sign out and sign in again** so the new session includes `isOwner` and `isPaid`.

Any user whose email matches `OWNER_EMAIL` will be treated as having an active subscription (full access to paid tabs).

---

## 4. View customers (owner only)

Open **`/admin/customers`** when signed in with an owner email. That page lists all registered users with name, email, phone, country, experience (trading crypto), subscription plan, expiry date, and active status. You can **Delete** a customer (removes the user and their subscriptions; cannot be undone). Only users listed in `OWNER_EMAIL` can access it; others get "Not authorized."

---

## 5. Where is customer/data stored? (Supabase)

Your app uses **Supabase** (PostgreSQL) for the database. Customer and subscription data lives there, not in Vercel.

- **Vercel** = runs your app (hosting, serverless). It does not store User/Subscription rows.
- **Supabase** = database. To see or edit data:
  1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
  2. Open **Table Editor** to browse `User`, `Account`, `Subscription`, `Token`, `ScanLog`.
  3. Or use **SQL Editor** to run queries (e.g. `SELECT * FROM "User"`).

So to see “who registered” or “who has a subscription” outside the app, use Supabase. Inside the app, use **Customers** (`/admin/customers`) when signed in as owner.
