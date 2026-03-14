# Apply database migrations to production

When you add new Prisma migrations (e.g. new columns like `paymentTermsAcceptedAt`), production must run them once.

## 1. Get your production `DATABASE_URL`

- **Vercel:** Project → Settings → Environment Variables → copy `DATABASE_URL` (or the one you use for production).
- **Supabase:** Project Settings → Database → Connection string (URI).

## 2. Run the migration

In a terminal, from the project root:

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL = "postgresql://..."   # paste your production URL
npm run db:migrate:deploy
```

**Windows (CMD):**
```cmd
set DATABASE_URL=postgresql://...
npm run db:migrate:deploy
```

**macOS / Linux:**
```bash
export DATABASE_URL="postgresql://..."
npm run db:migrate:deploy
```

You should see something like:
```
Applying migration `20260227120000_add_payment_terms_and_stripe`
The following migration(s) have been applied:
...
```

## 3. Done

No need to redeploy the app. The new columns are in the database; refresh the sign-in page and the error should be gone.
