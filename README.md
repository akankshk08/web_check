# AgencyOS

**One workspace. Every project. Every client.**

AgencyOS is a multi-tenant SaaS for digital agencies, web studios and software companies. Each agency gets a private workspace to run clients, projects, tasks, milestone approvals, files, invoices and website maintenance — with a separate portal for its clients.

## Quick start (easiest way to run it on your computer)

AgencyOS needs a database and a login service before it can run. The simplest way is a free Supabase project, which provides both. You only need Node.js 22 (from [nodejs.org](https://nodejs.org)) and a free [supabase.com](https://supabase.com) account.

1. **Create a Supabase project** at supabase.com → *New project*. Choose a database password and keep it somewhere safe.
2. **Allow sign-ups without email confirmation (for local testing):** Supabase → *Authentication* → *Sign In / Providers* → *Email* → turn **off** "Confirm email". Turn it back on before going live.
3. **Create the settings file.** In the project folder, run:

   ```bash
   npm install
   ```

   ```bash
   cp .env.example .env
   ```

   (On Windows Command Prompt use `copy .env.example .env`.) Open `.env` in a text editor and fill in:

   | Setting | Where to find it in Supabase |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (keep secret) |
   | `DATABASE_URL` | *Connect* button → Connection string → **Transaction pooler** (port 6543); replace `[YOUR-PASSWORD]` with your database password |
   | `CRON_SECRET` | Any random text, at least 32 characters |

4. **Check the setup.** This tells you in plain English if anything is missing:

   ```bash
   npm run doctor
   ```

5. **Create the database tables:**

   ```bash
   npm run db:migrate
   ```

6. **(Optional) Add sample data** with ready-made logins (password `Password123!`, e.g. `owner@northwind.test`):

   ```bash
   SEED_ALLOW_REMOTE=true npm run db:seed
   ```

   Only do this on a test project, never on your real one.

7. **Start the app:**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and click **Start free** to create your agency. Leave the terminal open while you use the app.

File uploads also need a **private** storage bucket called `attachments` (Supabase → *Storage* → *New bucket*, leave "Public" off).

## Contents

- [What's included](#whats-included)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Security model](#security-model)
- [Local development](#local-development)
- [Tests](#tests)
- [Deploying to production (Vercel + Supabase)](#deploying-to-production-vercel--supabase)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)

## What's included

| Area | Features |
|---|---|
| Marketing site | `/`, `/features`, `/pricing`, `/about`, `/contact` (contact form sends via Resend when configured) |
| Auth | Register an agency, sign in, forgot/reset password, email confirmation, invitation links (`/invite/[token]`), workspace switcher for people in several agencies |
| Agency dashboard | Active/completed projects, pending/overdue tasks, pending approvals, clients; charts for project status, monthly completions and revenue; recent activity, upcoming deadlines, recent projects, team workload — all from the database |
| Clients | Create, edit, archive/restore, search, filter, detail page with projects, invoices, support tickets, portal users and invitations; duplicate emails blocked |
| Projects | Create/edit/archive, team assignment, budget, dates, priority, status, automatic progress from tasks, search/sort/filter, discussion (internal or shared with the client), activity feed |
| Tasks | Kanban board (drag-and-drop **and** a keyboard-friendly "Move to" control) and list view, subtasks, comments, attachments, filters, time logging |
| Milestones | Create/edit/delete, deliverables, submit for client review, client approval / change requests / feedback, full review history |
| Team | Invite by email, roles, finance access, remove members, profiles with assigned projects, open tasks and hours, workload |
| Employee area | My work, my tasks, my projects, my calendar, timesheets |
| Client portal | Dashboard, projects with timeline, milestone review, deliverables, shared files, discussion, invoices (with PDF), support tickets, profile, notifications |
| Files | Private Supabase Storage bucket, permission-checked uploads, 60-second signed download links, type/size validation |
| Notifications | In-app (deduplicated) + email via Resend for assignments, deadlines, new projects, reviews, approvals, change requests, comments, invitations |
| Invoicing | Exact decimal maths, per-agency invoice numbers, draft → sent → partially paid → paid / overdue / cancelled, manual payments, PDF download |
| Delivery & maintenance | Production URL, hosting and domain providers, domain/SSL expiry dates, deployment date, handover notes, maintenance log. **Information is entered by your team — nothing is monitored automatically.** |
| Reports | Date-filtered: projects, tasks, revenue by month, outstanding invoices, employee workload, completion trends |
| Calendar | Month view of task, milestone and project deadlines (agency-wide or personal) |

### Roles

| | Owner | Admin | Employee | Client |
|---|:-:|:-:|:-:|:-:|
| Workspace settings, transfer ownership | ✅ | settings only | — | — |
| Invite/remove admins, grant finance access | ✅ | — | — | — |
| Invite/remove employees | ✅ | ✅ | — | — |
| Clients, projects, tasks, milestones | ✅ | ✅ | assigned projects only (view, update own tasks) | — |
| Invoices | ✅ | if granted by owner | — | own, non-draft only |
| Reports, maintenance, support tickets | ✅ | ✅ | — | own tickets |
| Approve milestones | — | — | — | ✅ (approvers on their client account) |

## Tech stack

Next.js 16 (App Router, Server Components, Server Actions, Route Handlers) · React 19 · TypeScript (strict) · Tailwind CSS 4 with shadcn/ui-style components on Radix · Lucide icons · PostgreSQL · Drizzle ORM + Drizzle Kit · Supabase Auth · Supabase Storage · Zod · React Hook Form · Recharts · Resend · @react-pdf/renderer · Vitest · Playwright · Vercel.

## How it works

```
Browser ──► proxy.ts (refresh Supabase session, redirect signed-out users)
        ──► Server Component page / Server Action / Route Handler
              1. getAuthContext(): verify the user with Supabase Auth, load memberships from Postgres
              2. validate input with a strict Zod schema
              3. call a service in src/server/services/* — every query is scoped to the user's organization
                 and checked against their role (owner/admin/employee/client)
              4. write changes in a transaction + an audit entry (activity_logs)
              5. send deduplicated notifications (and emails via Resend, never blocking the action)
        ◄── HTML / { ok, data } / { ok: false, error } (safe message, never stack traces)
```

What can fail and how it's handled: invalid input → field errors on the form; no permission or another agency's record → "not found"; too many attempts → "Too many attempts" (HTTP 429); database/email/storage problems → a generic message with a reference id (details only in server logs).

## Security model

- **Identity comes only from the session.** Organization, user and role are never taken from request input. The active workspace cookie is only a preference and is honored only if the user is an active member.
- **Every server action and route handler re-checks auth** (`authedAction`, `requireAuth`). The proxy and hidden buttons are convenience only.
- **Tenant isolation, three layers:**
  1. Every service query filters by `organization_id` and role (employees: project membership; clients: their client account).
  2. **Composite foreign keys** (`(organization_id, id)`) make it impossible at the database level to link, e.g., a project to another agency's client.
  3. **Row Level Security** is enabled on every table (`0001_row_level_security.sql`). Anything reaching Postgres through Supabase's public Data API sees only rows the signed-in user may see, and can't write anything.
- **Clients never see internal data**: internal notes, budgets, tasks, internal comments and internal files are filtered on the server.
- **Files**: private bucket; uploads get a one-time signed token only after an access check; the server verifies the stored object's size before publishing it; downloads redirect to a 60-second signed URL issued after an access check.
- **Invitations**: 32-byte random tokens, only a SHA-256 hash stored, single use (row lock), 7-day expiry, bound to the invited email.
- **Rate limits** (Postgres-backed, so they work across serverless instances): login, registration, password reset, invitations, uploads, support tickets, contact form.
- **Money** uses `numeric` columns and integer-cent `BigInt` maths — no floating point.
- **Headers**: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy (see `next.config.ts`).
- **Secrets**: the service-role key, database URL, Resend key and cron secret are server-only (`server-only` imports, validated by Zod at first use). Only the Supabase URL and anon key reach the browser.
- **Passwords** are handled entirely by Supabase Auth; the `users` table stores no password data.

## Local development

Requirements: Node 22, PostgreSQL 16, Docker (for the local Supabase Auth server).

```bash
npm ci
cp .env.example .env
```

1. Create the databases:

   ```bash
   createdb agencyos && createdb agencyos_test
   ```

2. Start the local Supabase stack (**dev/test only**): the official Supabase Auth (GoTrue) container plus a small gateway on `:54321` that forwards `/auth/v1` to it and emulates the few Supabase Storage endpoints AgencyOS uses (files go to `.local-storage/`). The script prints the anon and service-role keys — put them in `.env`.

   ```bash
   DB=agencyos scripts/local-supabase/start.sh
   ```

   ```bash
   node scripts/local-supabase/gateway.mjs
   ```

   Alternatively, point `.env` at a real (development) Supabase project.

3. Apply migrations and load development seed data:

   ```bash
   npm run db:migrate
   ```

   ```bash
   npm run db:seed
   ```

   The seed creates three agencies (Northwind Digital 5 staff / 10 clients / 15 projects; Pixel & Pine Studio 12 / 25 / 40; Bytecraft Labs 3 / 4 / 6). Sign in with password `Password123!` as `owner@`, `admin@`, `employee@` or `client@` + `northwind.test`, `pixelpine.test` or `bytecraft.test`. The seed refuses to run against production databases.

4. Run the app:

   ```bash
   npm run dev
   ```

Without `RESEND_API_KEY`, emails are skipped and logged; invitation links are also shown in the UI so you can copy them.

### Database changes

Edit `src/db/schema/*`, then generate a migration and apply it:

```bash
npm run db:generate -- --name describe_change
```

```bash
npm run db:migrate
```

Drizzle migrations are forward-only. To roll back, write a new migration that reverses the change; for destructive changes, take a backup first.

## Tests

```bash
npm test
```

Runs **56 unit and integration tests** against the real `agencyos_test` Postgres database (set `TEST_DATABASE_URL` to override). They cover every mandatory scenario:

1. Agency A cannot access Agency B's projects (plus clients, invoices, milestones, cross-org links rejected by the database).
2. Employees cannot use admin functions; admins without finance access can't see invoices.
3. Clients cannot access other clients' projects.
4. Clients approve only their own milestones, only when submitted, only with approval rights; staff can't approve on their behalf.
5. Unauthorized file access is rejected (other agencies, unassigned employees, other clients, internal files, unfinished uploads).
6. Employees can update their assigned tasks (and not others').
7. Admins can create and assign projects.
8. Invoice totals are exact (and payments never overpay).
9. Invitations can't be reused after acceptance, expiry, revocation, or by another email.

Plus Row Level Security checks run as Supabase's `authenticated`/`anon` roles, notification dedupe, rate limiting (429), and strict validation (extra fields like `role` are rejected).

End-to-end tests (Playwright) drive a real browser against the running app with Supabase Auth:

```bash
npm run build && npm start
```

```bash
npx playwright test --trace off
```

They cover registration, client/project creation, inviting and onboarding an employee, invitation reuse, task assignment and status updates, the full milestone review cycle in the client portal, invoice totals/sending/payment/PDF, file upload and cross-agency download rejection, login rate limiting, and phone-width layout. If you use a pre-installed Chromium, set `PW_CHROMIUM_PATH`.

## Deploying to production (Vercel + Supabase)

1. **Supabase project**
   - Create a project. Turn on **Point-in-Time Recovery / daily backups** (Settings → Database → Backups).
   - **Auth** → URL configuration: Site URL = your domain; add `https://your-domain/auth/callback` to Redirect URLs. Keep "Confirm email" on. Configure custom SMTP so confirmation and password-reset emails are delivered reliably.
   - **Storage** → create a bucket named `attachments`, **Private**, file size limit 25 MB. Do not add public policies.
2. **Database migrations** — run once per release from your machine or CI, using the *direct* connection string (port 5432):

   ```bash
   DATABASE_MIGRATION_URL="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres" npm run db:migrate
   ```

   Never run `npm run db:seed` against production.
3. **Resend** — verify your sending domain and create an API key.
4. **Vercel** — import the repository and set environment variables (Production):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://your-domain` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `DATABASE_URL` | Supabase **pooled** connection string (Transaction mode, port 6543) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (secret) |
   | `SUPABASE_STORAGE_BUCKET` | `attachments` |
   | `RESEND_API_KEY` | Resend key (secret) |
   | `EMAIL_FROM` | e.g. `AgencyOS <notifications@your-domain>` |
   | `CONTACT_EMAIL` | where contact-form messages go |
   | `CRON_SECRET` | 32+ random characters (`openssl rand -hex 32`) |

5. **Cron** — `vercel.json` schedules `/api/cron/daily` (deadline reminders + overdue invoices) at 07:00 UTC. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
6. **Monitoring** — point an uptime monitor at `/api/health` (checks the database).
7. Deploy, register your agency at `/register`, and invite your team.

**Rollback:** use Vercel's "Instant Rollback" for code. Migrations are forward-only, so keep them backward compatible (add columns before removing old ones) and restore from a Supabase backup if a data change goes wrong.

## Project structure

```
src/
  app/                    routes: (marketing), (auth), app/ (agency), portal/ (client), api/, auth/
  components/
    ui/                   design-system primitives (button, input, card, dialog, table…)
    shared/ layout/       page header, filters, pagination, charts, sidebar, header…
    <feature>/            client components per feature (forms, dialogs)
  db/
    schema/               Drizzle tables, enums, relations
    migrations/           SQL migrations (0001 = Row Level Security)
    seed.ts               development seed data
  lib/                    env validation, money, dates, file rules, Zod schemas, Supabase clients
  server/
    auth/                 session → AuthContext, role permissions, page/action guards
    services/             business logic (all org-scoped, all permission-checked)
    actions/              server actions (thin: auth + validation + service + revalidate)
    pdf/  storage.ts  email.ts  rate-limit.ts  errors.ts
  proxy.ts                session refresh + sign-in redirects
tests/                    Vitest unit + integration tests
e2e/                      Playwright end-to-end tests
scripts/local-supabase/   dev/test-only local Auth + Storage emulation
```

## Known limitations

- **Storage in local dev/CI is emulated.** The Supabase Storage server image couldn't be pulled in the build environment, so local runs and end-to-end tests use a small stand-in for the Storage endpoints. The production code uses the official Supabase client against real Supabase Storage; do one manual upload/download check after your first deploy.
- **No payment gateway** — payments are recorded manually, as specified.
- **No automatic monitoring** of websites, domains or SSL — dates are entered by the team.
- **Pricing page plans are informational**; billing isn't implemented.
- Lists are paginated where they can grow large (clients, projects, invoices, notifications, activity). Some secondary lists (e.g. tasks within a project, support tickets) are capped at a few hundred rows.
- The not-found page for a forbidden or missing record is rendered with HTTP 200 inside layouts that stream (content is never leaked).
