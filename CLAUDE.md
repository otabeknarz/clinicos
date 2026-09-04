# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ClinicOS — a multi-tenant SaaS for private clinics in Uzbekistan. Two independent projects,
deployed separately, no shared package or workspace:

```
clinicos-api/       NestJS 11 + PostgreSQL 17 + Prisma 7   (port 3000)
clinicos-frontend/  React 19 + TypeScript + Vite + Tailwind 4 (port 5173)
```

**All code comments, docs and user-facing strings are in Uzbek.** Match that when writing new
code — a stray English comment block reads as foreign in this codebase.

Neither project has `node_modules` checked out; run `npm install` in each before anything else.

## Commands

Run from inside the respective project directory.

### clinicos-api

```bash
npm install && cp .env.example .env
npm run db:up            # postgres 17 in docker, exposed on 5433 (not 5432)
npx prisma migrate dev   # ~35 tables
npm run db:seed          # wipes and reseeds: 2 clinics + demo data
npm run dev              # nest start --watch
```

| Command | Purpose |
|---|---|
| `npm run check` | typecheck → check:permissions → check:endpoints → build. Run before shipping. |
| `npm run test:isolation` | **The most important test.** Cross-tenant leak check. Needs a seeded DB. |
| `npm run smoke` | Hits every GET route as each of the 4 roles, looking for 500s. Server must be running. |
| `npm run gen:tenant-models` | Regenerates `src/prisma/tenant-models.ts` from the schema (Python). |

There is no unit-test framework — verification is these scripts. `test:isolation` and `smoke`
both require a running/seeded database; the other checks are static.

### clinicos-frontend

```bash
npm install && npm run dev   # works with NO backend (demo mode)
```

| Command | Purpose |
|---|---|
| `npm run check` | typecheck → oxlint → build. Run before shipping. |
| `npm run docs:api` | Regenerates `docs/API.md` from the `// GET /path` comments in `src/api/` (Python). |

To point at a real backend: put `VITE_API_URL=http://localhost:3000` in `.env`. That single
variable flips `USE_MOCK` in `src/api/client.ts` and every API function switches from generated
demo data to real HTTP. The backend's `CORS_ORIGIN` must list whatever port Vite actually picked.

Demo accounts (password `demo1234` everywhere): `admin@clinicos.uz` (platform superadmin),
`owner@shifomed.uz`, `reception@shifomed.uz`, `aziz.karimov@shifomed.uz`. The same three
clinic-level accounts exist under `@salomat.uz` — **two clinics exist on purpose**; isolation
cannot be tested with one.

## Three invariants

These are enforced in code, but new code must uphold them too. Long-form rationale is in
`clinicos-api/README.md`.

1. **Tenant filtering lives in the data layer, never in queries.** `clinicId` comes only from
   the JWT; a `clinicId` in a request body is stripped/overwritten. Never hand-write
   `where: { clinicId }`.
2. **Separation of duties.** Doctor records the visit, receptionist records the money, owner
   reconciles. Owner has no `visits.create`/`payments.create`; receptionist has no
   `visits.create` and no `cashcontrol.view`. Before adding a permission, ask whether the
   holder can now audit themselves.
3. **Money records are immutable.** There is no edit/delete endpoint for a payment and there
   must not be one — mistakes are corrected with a refund record. Same shape elsewhere:
   penalties are waived rather than deleted, impersonation is logged *before* entry.

## Backend architecture

**Request path:** `ContextMiddleware` (opens an empty AsyncLocalStorage holder) → `JwtAuthGuard`
(validates token, fills the holder) → `PermissionsGuard` (reads it) → controller → service → Prisma.
Both guards are registered globally in `app.module.ts` and **their order in the providers array is
load-bearing** — NestJS runs guards before interceptors, which is why the context is set in the
guard and not an interceptor.

**`src/prisma/tenant.extension.ts` is the single most important file.** A Prisma client extension
that injects `clinicId` into every operation on a tenant model. Things to know before touching it:

- `findUnique`/`findUniqueOrThrow` are rewritten to `findFirst`/`findFirstOrThrow` (Prisma rejects
  non-unique fields in a unique `where`).
- `update`/`delete` do an ownership pre-check, then run normally — they are *not* converted to
  `updateMany`/`deleteMany`, because callers expect a single record back.
- Cross-tenant hits surface as "not found", never "exists but not yours".
- Any Prisma operation not in its allowlist **throws** rather than passing through unfiltered.
  If Prisma adds an operation, this is where you handle it.

**Two clients, deliberately dissimilar names** (`src/prisma/prisma.service.ts`):

- `db.forCurrentClinic()` — everything inside a clinic. Services expose it as a private `db` getter.
- `db.acrossAllClinics()` — unfiltered. Only `platform/` (superadmin, `platform.*` permissions)
  and `auth/` (login must find a user before a clinic is known) may use it.

**Adding a table:** add the model to `prisma/schema.prisma`, then run `npm run gen:tenant-models`.
The `TENANT_MODELS`/`GLOBAL_MODELS` sets are generated from whether the model has a `clinicId`
column — do not hand-edit them. A model missed here is a model with no tenant filter.

**Audit logging** is declarative: `@Audit(action, entityType)` from
`src/common/audit.interceptor.ts` on a route, written by `AuditService` (global `AuditModule`).
The row is written **before** the handler runs, so a failed audit write fails the request and a
probe for someone else's record is logged even when it 404s — same precedent as the impersonation
log, which is created before entry. Login is audited separately (`recordLogin`), outside the
tenant filter, because no request context exists yet on a `@Public()` route; that one never blocks
the login.

**Permissions are duplicated on purpose** — `clinicos-api/src/common/permissions.ts` (the real
check, via `@RequirePermission('...')`) and `clinicos-frontend/src/lib/permissions.ts` +
the `Permission` union in `clinicos-frontend/src/types/models.ts` (button visibility only).
`npm run check:permissions` keeps the two lists from drifting.

**Enum casing boundary.** DB is `CHECKED_IN`, the API contract is `checked_in`. Convert with
`toApi`/`toDb` from `src/common/api-enum.ts` **in the service layer**. Never return a raw Prisma
row from a service — a future schema column (a password hash, say) would leak automatically.

**Modules** follow `*.controller.ts` (routes + `@RequirePermission`) / `*.service.ts` (logic,
enum + shape mapping) / `*.dto.ts` (class-validator input). Several controllers use
`@Controller()` with no prefix and declare full paths on the handlers (`payments`, `visits`,
`staff`, `analytics`, `bonuses`, `penalties`, `feedback`, `cash-control`, `users`, `forecast`).
All routes are closed by default; `@Public()` opens one.

`ValidationPipe` runs with `whitelist: true` globally — undeclared body fields are dropped, which
is what stops a client from smuggling `clinicId` or `role` into a create.

## Frontend architecture

**`src/api/` is the only place `fetch` exists.** Every module there exports functions that branch
on `USE_MOCK`: real `request()` call, or a query against the in-memory mock DB. Each function is
preceded by a `// GET /path` comment — those comments are the source for both `docs/API.md` and
the backend's `check:endpoints`, so keep them exact.

**Demo mode** (`src/mock/`): a seed is generated once in memory; only user edits ("overrides")
are persisted to `localStorage` under `clinicos.mock.v1`. Clear that key for a fresh state.

**Client-side permissions are not security.** `can()` hides buttons. Anything reachable from the
browser console must be re-checked server-side.

**Data loading** goes through `useAsync(loader, deps)` (`src/lib/useAsync.ts`), which handles the
loading/error/data triple and drops stale responses. Pages are lazy-loaded in `App.tsx`; routes
are permission-gated there and the sidebar is built from `src/components/layout/navigation.ts`.

**i18n**: Uzbek ships in the bundle, Russian and English load on demand (`src/i18n/`). Formatting
(`src/lib/format.ts`) follows the selected language.

Path alias `@/` → `src/`, configured in both `vite.config.ts` and `tsconfig.app.json`.

## Traps

- **The frontend token lives in `localStorage`, and the session survives a reload only because
  of that.** In mock mode `me()` restores from a stored `userId` with no token, so anything that
  breaks token persistence is invisible until a real backend is connected. Test session restore
  against the API, never against demo mode.
- **Stay on Prisma 7.10.0.** The `latest` tag currently points at a release candidate.
- **`incremental` is off in `clinicos-api/tsconfig.json` on purpose.** With it on, `tsc --noEmit`
  marks the build as done and the subsequent `nest build` emits nothing.
- `main.ts` imports `dotenv/config` on its first line because `PrismaService` reads
  `process.env.DATABASE_URL` inside `super()`, before `ConfigModule` is up.
- `AuthService.login` verifies against a dummy hash when the email is unknown, to keep response
  timing constant. Email is unique per clinic, not globally.

## Reference docs

| File | Contents |
|---|---|
| `clinicos-frontend/docs/API.md` | The endpoint contract (~134 endpoints), generated |
| `clinicos-frontend/docs/DATABASE.md` | Tables, relations, and why each decision was made |
| `clinicos-frontend/src/types/models.ts` | Request/response shapes — the frontend↔backend contract |
| `clinicos-api/src/common/permissions.ts` | Roles and permissions (authoritative) |
| `OQING.md` | Project-level onboarding (Uzbek) |

## Known gaps (intentional, needed before production)

Row Level Security in the database (application-layer filtering is the only layer today),
backups, no UI for reading the audit log, the patient-feedback endpoints are deliberately closed
until rate limiting exists (phone-number enumeration risk), and penalty rules are stored but
never applied — the background job doesn't exist.

**Impersonation is half-wired.** `POST /platform/tenants/:id/impersonate` writes the log row but
returns no token, and `AuthService.buildSession` signs only `{sub, clinicId}` — so the
`payload.impersonationId` branch in `jwt.strategy.ts` is unreachable. Against a real backend a
superadmin who "enters" a clinic keeps their own `clinicId` and gets 403 on every clinic route.
It appears to work in demo mode only because the mock layer trusts the client-side `apiContext()`.
