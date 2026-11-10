# Project rules: AgencyOS (Next.js 16 + Supabase Auth/Storage + Postgres/Drizzle)

Follow production-web-builder standards. The owner is not a programmer: you are responsible for security and quality by default.

## Security (never break)
- Identity, organization and role come only from `getAuthContext()` / `requireAuth()` — never from request input.
- Every server action uses `authedAction(schema, handler)` (or `publicAction` for login/register/etc.). Every route handler calls `requireAuth()`.
- Every query on org data filters by `ctx.orgId` and checks role/project access via `src/server/services/access.ts`. Other orgs' records → `NotFoundError` (404), never 403.
- Clients must never receive internal notes, budgets, tasks, internal comments or internal files. Filter on the server.
- New org-owned tables: add `organization_id`, composite FKs `(organization_id, x_id)`, indexes, and an RLS policy in a migration.
- Zod schemas live in `src/lib/validations/*` and use `.strict()`. Optional text fields are `""`, converted with `nn()`.
- Money: `numeric` columns + `src/lib/money.ts` (BigInt cents). Never floats.
- No secrets in client code. Server-only modules import `"server-only"`. Only `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/APP_URL` are public.
- Rate limit sensitive actions with `enforceRateLimit` (Postgres-backed).
- Never render user HTML; external links go through `safeExternalUrl`, redirects through `safeNextPath`.
- Errors: throw `AppError` subclasses; unknown errors are logged and return a generic message with a reference.

## Code
- Business logic in `src/server/services/*` (takes `db` + `ctx`, testable). Actions/pages stay thin.
- Server Components by default; `"use client"` only for interactivity.
- Reuse `components/ui/*` and `components/shared/*`. Keep files focused (aim ≤ 300 lines).
- Schema changes only via `npm run db:generate` + `npm run db:migrate`. Destructive changes: stop and explain, prefer soft delete.
- New npm package? Explain why and verify it's real and popular first.

## Workflow
- Plan first (pages, data, access rules, limits, edge cases).
- Before committing: `npm run typecheck && npm run lint && npm test` (and `npx playwright test` for UI flows).
- Add tests for auth, cross-org/cross-client access (404) and validation on every new service.
- Never weaken a test or remove a check to make an error go away.
