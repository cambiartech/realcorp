# Deploying Realcorp on Netlify

Netlify does **not** read `.env` or `.env.local` from the repo (and you should never commit secrets). All production config lives in **Netlify → Site configuration → Environment variables**.

## Repo layout

If the Git repo root is the parent folder (`boerp/`), set in Netlify:

| Setting | Value |
|---------|--------|
| **Base directory** | `realcorp` |
| **Build command** | *(leave empty to use `netlify.toml`)* |
| **Publish directory** | *(leave empty — Next.js plugin handles this)* |

If the Netlify site connects only to the `realcorp/` folder, base directory can stay blank.

## What runs on every deploy

From `netlify.toml`:

```bash
npx prisma migrate deploy && npm run build
```

1. **`prisma migrate deploy`** — applies any pending SQL migrations in `prisma/migrations/` to production Postgres. Safe to run repeatedly (only applies what is missing).
2. **`npm run build`** — `prisma generate` + `next build`.

Migrations run **during the build**, not after. If a migration fails, the deploy fails — check the build log.

**Seeding is not automatic.** `db:seed` / `db:seed-demo` are manual, one-off commands (see below).

## Required environment variables (Netlify UI)

Set these for **Production** (and **Deploy previews** if you use them).

### Database (Supabase / Postgres)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | **Pooled** connection for app runtime (Supabase: port **6543**, `?pgbouncer=true`) |
| `DIRECT_URL` | **Direct** connection for migrations (Supabase: port **5432**, no pgbouncer) |

Example (Supabase):

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

`prisma.config.ts` uses `DIRECT_URL` for migrate only. **Runtime** (`src/lib/db.ts`) uses `DATABASE_URL` (pooled) — never `DIRECT_URL`.

### Auth

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Auth.js signing secret — `openssl rand -base64 32` |

### App URL

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public site URL, e.g. `https://app.realcoerp.ng` — used for invite links, emails, metadata |

### Email (optional but recommended)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender |
| `RESEND_FROM_NAME` | Display name |
| `RESEND_FROM_REPLY_TO_EMAIL` | Reply-to (optional) |

### File uploads (optional)

Either set all three, or a single `CLOUDINARY_URL`:

| Variable | Purpose |
|----------|---------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |
| `CLOUDINARY_FOLDER` | Root folder (default `realcorp`) |

### AI offer letters (optional)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` or `GROQ_API_KEY` | HR offer-letter draft API |

## Verify production is up to date

### 1. Check the latest deploy build log

Netlify → **Deploys** → latest deploy → **Deploy log**.

Look for:

```text
Applying migration `20260525100000_tasks_module`
...
All migrations have been successfully applied.
```

If you only see `No pending migrations to apply`, the DB schema is current.

### 2. Compare migration status locally (read-only check)

From your machine, with production `DIRECT_URL` (never commit this):

```bash
cd realcorp
DIRECT_URL="postgresql://..." npx prisma migrate status
```

Should report: **Database schema is up to date**.

### 3. Apply migrations manually (if deploy skipped them)

Only if Netlify build command was overridden or an old deploy is live:

```bash
cd realcorp
DIRECT_URL="postgresql://..." npx prisma migrate deploy
```

Then trigger **Deploy site** in Netlify (or push a commit).

## Getting production error logs (Netlify)

Browser errors like `This page couldn't load` with a digest mean the failure happened in a server function.

### Netlify UI

1. Open **Netlify → Site → Logs**.
2. Filter by:
   - **Runtime** / **Functions**
   - Your production site
   - Time window around the error
3. Search for the failing route (for example `/${tenantSlug}` or `/projects`) and for:
   - `Error:`
   - `digest`
   - `projects:createProject`

### Build vs runtime

- **Build logs**: migration/build failures (`prisma migrate deploy`, `next build`).
- **Runtime logs**: request-time crashes after deploy (what you need for `This page couldn't load`).

### CLI option (optional)

Use Netlify CLI if preferred:

```bash
netlify logs --functions
```

(Requires `netlify login` and selecting the site.)

### 4. One-time production seed (platform admin only)

**Not** run on every deploy. First go-live only:

```bash
DIRECT_URL="postgresql://..." SEED_PLATFORM_PASSWORD="your-strong-password" npm run db:seed
```

Demo tenant data (`npm run db:seed-demo`) is for local/staging — do not run on production unless intentional.

## Common reasons production lags behind local

| Symptom | Likely cause |
|---------|----------------|
| Missing tables/columns | Deploy used old commit, or build command in Netlify UI overrides `netlify.toml` (must include `prisma migrate deploy`) |
| Migrate failed silently | Unlikely — failed migrate fails the build; check failed deploys |
| `DIRECT_URL` missing | Migrations may fail against pooled URL; build should error |
| Wrong base directory | Builds old/wrong folder without latest migrations |
| Env vars only on Production | Preview deploys hit a different DB or miss secrets |
| Features work locally, not prod | Missing `NEXT_PUBLIC_APP_URL`, Cloudinary, or Resend on Netlify |

## Netlify UI checklist

1. **Site configuration → Build & deploy → Build settings**  
   - Base directory: `realcorp` (if monorepo)  
   - Build command: empty *(use `netlify.toml`)* or explicitly:  
     `npx prisma migrate deploy && npm run build`

2. **Environment variables**  
   - All variables above set for **Production**  
   - Redeploy after adding/changing vars (**Deploys → Trigger deploy → Clear cache and deploy**)

3. **Deploys**  
   - Production branch matches your main branch  
   - Latest deploy is **Published**, not an older successful deploy

## Local vs production commands

| Task | Local dev | Production (Netlify) |
|------|-----------|----------------------|
| Create migration | `npm run db:migrate` | — (commit migration SQL, push, deploy) |
| Apply migrations | `npx prisma migrate dev` | `prisma migrate deploy` (automatic in build) |
| Seed platform user | `npm run db:seed` | Manual once with prod `DIRECT_URL` |
| Demo data | `npm run db:seed-demo` | Staging only |

## Security

- Never commit `.env`, `.env.local`, or database passwords.  
- Set strong `AUTH_SECRET` and `SEED_PLATFORM_PASSWORD` in Netlify / CLI only.  
- Rotate Supabase password if `.env` was ever exposed in git history.
