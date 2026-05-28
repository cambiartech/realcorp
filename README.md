# Realcorp

Multi-tenant PropTech CRM & ERP (Next.js + PostgreSQL + Prisma + Auth.js).

## Prerequisites

- Node 20+
- Docker (for local Postgres) or any PostgreSQL 16+ instance

## Quick start

```bash
# 1. Database
docker compose up -d

# 2. Environment
cp .env.example .env
# Edit .env if needed — default matches docker-compose (port 5433)

# 3. Migrate & seed
npx prisma migrate dev
npm run db:seed

# 4. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Theme:** Default is **light** (white background, black primary). Use **Appearance** (top-right) to switch Light / Dark / System; preference is stored locally.

**Form errors:** Use `FormFieldError` and `FormAlert` from `src/components/form-message.tsx` only — red text and borders come from CSS variables (`--error`, `--error-bg`, `--error-border`) in `globals.css` for light and dark.

### Platform admin (after seed)

- **Email:** `admin@realcorp.com`
- **Password:** `Pass@123` by default — on live/staging set **`SEED_PLATFORM_PASSWORD`** when running `npm run db:seed` and do not commit that secret.

Sign in at `/login`, then open `/platform` → **Onboard new organization**.

### Onboarding a new org

1. `/platform/onboarding` — organization name, URL slug, org admin email, plan.
2. Creates `Tenant`, `TenantSettings`, and an `Invitation` (14-day expiry).
3. Copy the **invite link** from the success screen and send it to the admin (email integration later).
4. `/join?token=…` — stub until Sprint 1 (password + membership).

## Scripts

| Script          | Description                |
|-----------------|----------------------------|
| `npm run dev`   | Next.js dev                |
| `npm run build` | `prisma generate` + build  |
| `npm run db:migrate` | `prisma migrate dev`   |
| `npm run db:seed`    | Platform admin user    |
| `npm run db:studio`  | Prisma Studio          |

## Deploying to Netlify

Production deploys apply migrations automatically (`prisma migrate deploy` in `netlify.toml`).  
**Full checklist, env vars, and troubleshooting:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Prisma 7 + PostgreSQL

Runtime client uses `@prisma/adapter-pg` with `DATABASE_URL`. Migrations read the same URL from `prisma.config.ts` (loads `.env` via `dotenv`).

## Repo layout (high level)

- `src/app/platform/*` — Super Admin / platform console (protected by `isPlatformAdmin`).
- `src/app/login` — credentials sign-in.
- `src/app/join` — invite acceptance (stub).
- `src/auth.ts` — Auth.js v5 (JWT session + credentials).
- `prisma/schema.prisma` — tenants, users, invitations, inventory & deal skeleton.

Parent product specs live one level up: `../sprint-0.md`, `../tech-stack.md`, `../dashboard-spec-by-role.md`.
