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
| `npm run check` | typecheck → check:permissions → check:endpoints → check:dto → build. Run before shipping. |
| `npm run test:isolation` | **The most important test.** Cross-tenant leak check. Needs a seeded DB. |
| `npm run test:crud` | Write-path regression: every PATCH is sent with one field and the rest must survive. Needs a running, seeded server. |
| `npm run check:dto` | Create/update DTO pairs must not drift. Static. |
| `npm run smoke` | Hits every GET route as each of the 4 roles, looking for 500s. Server must be running. |
| `npm run gen:tenant-models` | Regenerates `src/prisma/tenant-models.ts` from the schema (Python). |

There is no unit-test framework — verification is these scripts. `test:isolation` and `smoke`
both require a running/seeded database; the other checks are static.

The two generator scripts (`gen:tenant-models` here, `docs:api` in the frontend) are Python and
call `python3`. **On Windows `python3` is usually the Microsoft Store stub** — it prints nothing,
exits 0, and the file is silently left unchanged. `python` and `py` work; run the script directly
(`python scripts/gen-tenant-models.py`) rather than through npm when that happens.

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

`.claude/launch.json` starts this dev server on 5173 for the in-app browser preview — it is the
frontend only, the API is not part of it.

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

**Deployment is Coolify** (`deploy/README.md` is the step-by-step). One project, four resources
on one server: `clinicos-api` and `clinicos-frontend` both build from this repo with build pack
`Dockerfile` and base directory `/clinicos-api` / `/clinicos-frontend`, plus `clinicos-postgres`
and `clinicos-s3`. Two things that are easy to undo by accident:

- `docker-entrypoint.sh` runs `prisma migrate deploy` on **every** boot — never `migrate dev`,
  which is a development command and will recreate the database. Seeding and the first records
  are *not* in the entrypoint; they are a one-off `npm run bootstrap` by hand.
- The API's env vars are **runtime**, not build-time. Made build-time, `JWT_SECRET` would be
  baked into the image history.

A second, Coolify-free path (nginx + systemd) is kept in `deploy/nginx/` and `deploy/systemd/`.

**MinIO is deployed from `deploy/minio/docker-compose.yaml`, not a Dockerfile** — and it must
stay that way. A Dockerfile `VOLUME /data` creates an *anonymous* volume per container, so every
redeploy started with empty storage and silently lost every uploaded file (this happened once).
Coolify ignores `-v` in `custom_docker_run_options` for applications, and its storages API rejects
every `type` value we could find, so the named volume lives in the compose file.

**File storage** (`src/storage/`) is S3/MinIO with a **private bucket**. The DB stores a *key*
(`clinics/<clinicId>/<kind>/<uuid>.<ext>`), never a URL — the clinicId comes from the token, so
tenant isolation extends to files. `SignedUrlInterceptor` rewrites any `*Url` field whose value
looks like a key into a 15-minute signed URL on the way out; it checks the field *name* too,
because `POST /uploads` must return the raw `key`. Upload is server-side and sniffs magic bytes
(SVG rejected). With `S3_*` unset, uploads return 503 and everything else still works.

**Partial-update DTOs are hand-written, not `PartialType`.** Class field initializers survive
`plainToInstance`, so a create-DTO reused on PATCH silently resets defaulted fields (an archived
service would flip back to `active` when only `price` was sent). `npm run check:dto` enforces that
every `<X>InputDto` has an `Update<X>Dto` with the same fields, no required fields and no defaults;
a deliberate omission is declared with `ATAYLAB YO'Q: <field>` in the doc comment.

**Password change** (`POST /auth/password`) requires the current password and returns a *fresh
session*. Tokens carry a `pwd` claim (the `passwordChangedAt` epoch at issue time) which
`jwt.strategy.ts` compares exactly against the DB — not against `iat`, which is whole-second and
let a token issued in the same second as the change slip through. `POST /staff/:id/password`
revokes the target's sessions the same way. There is no mail service, so recovery goes through a person: owner resets staff
(`POST /staff/:id/password`), platform admin resets the clinic owner
(`POST /platform/tenants/:id/reset-owner-password`, audited), and
`npm run bootstrap -- reset-password` is the bottom turtle for the platform admin. All three
issue a one-time temporary password, revoke the target's sessions and set `mustChangePassword`.
Note the tradeoff: an admin who resets an owner's password can then sign in as them, which
sidesteps the view-only impersonation design — that is inherent to having a recovery path.

**A doctor is hired through Staff, not Doctors.** The Doctors page is read-only — there is no
create form and `POST /doctors` has no caller in the UI. `StaffService.create` therefore opens a
`Doctor` row whenever `position === 'doctor'` and links `Staff.doctorId` + `User.doctorId`; the
update path keeps the two in sync and flips the doctor to `inactive` when the position changes
away (the row itself stays — visits, payments and appointments hang off it). Without that row a
"doctor" is invisible everywhere that matters: `GET /doctors` is empty, the receptionist cannot
attach one to an appointment, `visits.service` rejects the visit because `appointment.doctorId`
never matches a null `doctorId`, and percent-based pay computes against zero revenue. Migration
`20260906120000_shifokor_xodimga_yozuv` backfills clinics created before this.

**The clinic owner is also a `Staff` row.** `PlatformService.createTenant` opens one
(position `MANAGER`, "Klinika egasi") alongside the `User`, because "Mening profilim" and
"Mening ish jadvalim" read `GET /me/profile` / `GET /me/schedule`, both of which resolve
`Staff` by `userId` and 404 without it — a brand-new clinic had two dead pages on the owner's
first login. Migration `20260906180000_egasiga_xodim_yozuvi` backfills.

**A service's price can be set by the doctor instead of the catalog** (`Service.priceMode`,
`minPrice`/`maxPrice`, `Visit.price`). For surgery and the like the amount is not knowable before
the visit, so the owner gives a range, the doctor enters the amount when writing the visit, and
reception collects it. The payment ceiling then comes from `Visit.price` instead of the catalog, so
such a payment **must** carry `appointmentId` — without it there is no ceiling at all. Loyalty
discounts do not apply (the doctor already priced the case), and `DOCTOR_SET` forces `POSTPAID`.

**A visit can carry images** (`VisitImage`) — X-rays, tooth photos. Attached only while the visit is
being written, because there is no `PATCH /visits/:id` and there should not be. It is a separate
table rather than a `String[]` on `Visit` because `SignedUrlInterceptor` signs a **string** field
named `*Url`, not an array. Confidentiality needs no new permission: images ride along with
`visits.view`, which the receptionist does not have. `prepareMedicalImage` in `lib/image.ts` scales
to 1600px without cropping — `prepareAvatar` centre-crops to 256px, which would cut an X-ray in half.

**The ward (`src/ward/`) is the one module whose money has no catalog service.** `Room` / `Bed` /
`Admission`: a bed charge is the room's `dailyRate` × days lying in, so there is no `Service` row
to attribute it to and a naive per-service revenue report would drop a whole wing of the clinic.
Both reports that break revenue down by service therefore fold ward payments under the single
`WARD_KEY` / `WARD_LABEL` pair from `src/common/ward-revenue.ts` — it lives in `common/` precisely
because two callers must agree. Day counting here is the timezone trap below.

**Modules are a second gate, orthogonal to permissions** (`src/common/modules.ts`). A permission
answers "may this *person* do it"; a module answers "does this *clinic* have it at all" — a dental
clinic has no ward even though its owner holds `ward.manage`. `Clinic.disabledModules` stores the
**disabled** ones, so an empty array means everything is on: existing clinics are unaffected and a
newly added module works everywhere by default. `PermissionsGuard` rejects a route whose module is
off, deriving the module from the permission the route already declares (`MODULE_BY_PERMISSION`) —
per-route annotations would be forgotten on the next new route. The frontend needs no logic of its
own: `buildSession` strips blocked permissions from the session, so navigation, buttons and route
guards follow automatically. `check:permissions` does **not** cover this mapping.

**Deleting a clinic and archiving it are different acts.** Archive (`POST /platform/tenants/:id/archive`)
means "the customer left but may come back": the subscription goes `CANCELLED` and the clinic stays
in the platform list. Delete (`POST /platform/tenants/:id/delete`) sets `Clinic.deletedAt` and takes
it out of the list entirely — `GET /platform/tenants` hides deleted rows unless `status=deleted` is
asked for, which is a filter value, not a subscription status. Both keep every row: there is no
`DELETE` that removes patients, visits, payments or the audit log, and there must not be one.
The deleted check sits in `clinic-access.ts` *before* the subscription check, because a clinic can
be deleted without ever being archived.

**Debt is computed, never stored.** `GET /debts` derives it as price − payments, in two lists
(appointments and admissions). A stored balance column would drift from the payment rows and then
nobody could say which one was true. `DebtWaiver` writes off a hopeless debt without touching the
money: `paymentStatus` stays unpaid — it really was — and only the lists and the notification
filter the waived row out. `debts.waive` is owner-only for the same reason `payments.refund` is.

**The reception panel's unpaid list is the one part that is not "today".** Everything else on that
panel (counts, queue, cash) comes from the day's appointments; debt comes from a *separate* query
with no date bound. They were one query once, and yesterday's debt showed in the notification count
while being invisible on the panel. Do not merge them back.

**Ward money lives in `common/ward-revenue.ts`.** `wardBalance()` (planned vs actual days × daily
rate − paid) is called by both the payment ceiling and the debt list; written twice, one copy would
drift.

**Suspension is enforced in two places** (`common/clinic-access.ts`): at login and in
`jwt.strategy.ts` on every request, so an already-issued 12h token stops working immediately.
`PAST_DUE` deliberately does not block. Superadmins are exempt — their "clinic" is the platform
record and has no subscription.

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

**Every context in `src/store/` is two files on purpose** — `AuthContext.tsx` (the provider
component) and `auth-context.ts` (the `createContext` call, the hook and the value type); same for
theme and toast. React Fast Refresh requires a file to export *either* components *or* plain
values; mixed, the context object is recreated on edit and the app throws "useAuth must be used
inside AuthProvider". Keep new contexts split the same way.

**i18n**: Uzbek ships in the bundle, Russian and English load on demand (`src/i18n/`). Formatting
(`src/lib/format.ts`) follows the selected language.

Path alias `@/` → `src/`, configured in both `vite.config.ts` and `tsconfig.app.json`.

## Traps

- **Day boundaries are the server's local midnight.** `startOfDay`/`endOfDay` use
  `setHours(0,0,0,0)`, so the reception dashboard's "today", daily attendance, shift closure,
  cash control and ward day counting all follow the *container's* timezone. `TZ=Asia/Tashkent`
  is **not set anywhere in the repo** — not in the Dockerfile, not in `docker-compose.yml`, not
  in `.env.example` — so it has to be set in the deployment environment by hand; a container
  built from this repo runs UTC, the day rolls over at 05:00 local, and everything between
  midnight and 05:00 lands on the previous day. A `Clinic.timezone` column *does* exist
  (`schema.prisma`, default `Asia/Tashkent`, returned by `clinic.service.ts`) but nothing reads
  it for date math — the product is single-country by design. Tests must build dates
  in local time too: `new Date().toISOString().slice(0,10)` is UTC and disagrees with the server
  after 19:00 local, which made `test:crud` count 2 ward days instead of 3.
- **A page can be broken while `smoke` passes.** `smoke` only flags `>= 500`, but the frontend
  renders its error state for *any* non-OK response — a legitimate-looking 404 (`/me/profile`
  with no `Staff` row) is a dead page. When a page "just errors", check the status code, not
  only the logs.
- **Not every page is wired to the API.** `AttendanceTab` read `getDb()` (the demo store)
  directly until it was pointed at `GET /attendance?from=&to=`; the tab worked in demo mode and
  broke against a real backend. Grep for `@/mock/db` outside `src/mock/` and `src/api/` before
  trusting that a screen is connected.
- **Anything role-shaped is invisible in demo mode.** The mock layer answers from a client-side
  context, so role casing, token handling, and impersonation all "work" until a real backend is
  connected. `AuthService.buildSession` returned the raw Prisma `Role` (`SUPERADMIN`) against a
  contract that is lowercase, which silently sent every non-owner role to the wrong home page.
  Drive each of the four roles against the API before believing a change.
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
| `clinicos-frontend/docs/API.md` | The endpoint contract, generated (its own header carries the current count) |
| `clinicos-frontend/docs/DATABASE.md` | Tables, relations, and why each decision was made |
| `clinicos-frontend/src/types/models.ts` | Request/response shapes — the frontend↔backend contract |
| `clinicos-api/src/common/permissions.ts` | Roles and permissions (authoritative) |
| `OQING.md` | Project-level onboarding (Uzbek) |

## Known gaps (intentional, needed before production)

Row Level Security in the database (application-layer filtering is the only layer today),
backups, no UI for reading the audit log, no self-service password recovery (a person must
reset it for you — there is no mail service), the patient-feedback endpoints are deliberately closed
until rate limiting exists (phone-number enumeration risk), and penalty rules are stored but
never applied — the background job doesn't exist. Debt has no due dates or reminders: only the
outstanding balance is tracked, deliberately — deadlines turn it into a payment-plan feature.
`check:permissions` compares permission names but knows nothing about module gating, so a module
that is off is only caught by driving the app or by `test:crud`.

**Impersonation** issues a separate 30-minute token carrying `impersonationId`; `jwt.strategy.ts`
resolves the target `clinicId` from the log row and swaps in `IMPERSONATION_PERMISSIONS` (view-only
— no `manage`, no `chat.use`, no `platform.*`). Exit lives in its own `ImpersonationController`
because `PlatformController` is blanket-gated on `platform.view`, which an impersonating user does
not have; it takes no id and closes only the caller's own session. The frontend parks the platform
token under `clinicos.session.platformToken` and swaps back on exit or when the short token expires.

**`check:permissions` compares permission *names* only**, not the role→permission mapping. A page
that calls an endpoint its role lacks (as `DoctorHome` did with `GET /doctors/:id`) passes every
static check and only shows up when you drive the app as that role.
