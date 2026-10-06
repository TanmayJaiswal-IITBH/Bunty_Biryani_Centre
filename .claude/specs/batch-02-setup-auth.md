# Batch 2 — Project setup, database, migrations + seed, admin authentication

| | |
|---|---|
| Status | Built and verified 2026-10-04. One check is left for the owner: run `pnpm admin:create` in PowerShell (§13). Deviations found while building are marked **(as built)**. |
| Depends on | Batch 1 (§4 stack, §5 layout, §7 schema, §9 security, §11 config) |
| Brief sections | §20 Database, §22 Authentication, §23 Technology, §24 design foundations, §26 login rate limit |
| Endpoints | `GET /api/health`, `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me` |

## 1. Goal

A running skeleton that every later batch only adds to:

- `pnpm dev` serves a branded customer shell at `http://localhost:5173` and a working vendor login at `/admin/login`, backed by a real Postgres database.
- `pnpm build && pnpm start` runs the same app as one Node process on one port, the way production will (brief §23).
- The first migration creates the whole Batch 1 schema with its hand-written checks, sequence and settings row.
- Seeds, the admin CLI, lint, typecheck and the test harness (unit + integration against real Postgres) all work.

## 2. Scope

**In:** tooling and scripts; local Postgres; env validation; Prisma schema + `init` migration; `seed-initial`, `seed-dev`; admin CLI; Express skeleton (middleware, errors, logging, health, static + SPA fallback, graceful shutdown, clock); shared basics (`enums`, `limits`, `errors`, `money`, `time`, `phone`, auth schema); admin auth end to end; Vite + Tailwind with design tokens, fonts and logo; router with the admin guard; base UI primitives; test harness.

**Out:** menu, delivery options, orders, dashboard data, admin management screens (Batches 3–6). Routes for those screens are not created yet, apart from the `/` placeholder that Batch 3 replaces.

## 3. Tooling

### 3.1 Files

| File | Content |
|---|---|
| `package.json` | `"type": "module"`, `"engines": { "node": ">=24 <25" }`, `"packageManager": "pnpm@<current>"`, scripts (§3.2), dependencies from Batch 1 §4 pinned exactly |
| `.nvmrc` | `24` |
| `.gitignore` | `node_modules`, `dist`, `src/server/generated`, `.env`, `.env.*` **(as built: except `.env.example`, `.env.test` and `.env.e2e`, which are committed)**, `coverage`, `playwright-report`, `test-results`, `*.tsbuildinfo` |
| `.prettierignore` | **(as built)** `node_modules`, `dist`, `coverage`, `pnpm-lock.yaml`, `src/server/generated`, `prisma/migrations`, `.claude`, `README.md` |
| `prisma.config.ts` | Prisma 7 CLI config exactly as Batch 1 §7.2: schema and migrations paths, `datasource.url` from `DATABASE_URL`; loads `.env` with `process.loadEnvFile()` only when `DATABASE_URL` is unset and the file exists |
| `.gitattributes` | `* text=auto eol=lf` (the owner's machine is Windows; keeps diffs and shell files clean) |
| `.editorconfig` | 2 spaces, LF, final newline |
| `tsconfig.base.json` | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes: false`, `target: ES2023`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, `isolatedModules`, `resolveJsonModule`, **(as built) `types: []`**: TypeScript 6 no longer loads every `@types/*` package, so each config lists what it needs |
| `tsconfig.json` | **(as built)** a solution file: `files: []` and `references` to the three configs below, so the editor and typescript-eslint's `projectService` pick the right settings per file |
| `tsconfig.client.json` | **(as built; was `tsconfig.json`)** extends base; `include: ["src/client", "src/shared"]`; `module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `types: ["vite/client"]`, `noEmit`, path alias `@shared/*` → `src/shared/*` |
| `tsconfig.server.json` | extends base; `include: ["src/server", "src/shared", "scripts", "prisma/*.ts"]`; `module: NodeNext`, `moduleResolution: NodeNext`, `rootDir: "."`, `outDir: "dist/node"`, `lib: ["ES2023"]`, `types: ["node"]` |
| `tsconfig.test.json` | **(as built)** extends base; `include: ["tests", "*.config.ts", "src/server", "src/shared", "scripts", "prisma/*.ts"]`; Bundler resolution, DOM + node types, `allowImportingTsExtensions`, `noEmit`. The server config emits to `dist`, so it can't include tests |
| `eslint.config.js` | flat config: `typescript-eslint` recommended-type-checked, `react-hooks`, plus `no-restricted-imports` rules from §3.3; ignores `dist` and `src/server/generated` |
| `.prettierrc` | `{ "singleQuote": true, "printWidth": 100 }` |
| `vite.config.ts` | §8.1 |
| `vitest.config.ts` | §10.1 |
| `docker-compose.yml`, `docker/init-test-db.sql` | §4 |
| `.env.example` | §4.2 |

The server compiles to `dist/node/src/server/index.js`; CLI scripts and the initial seed compile alongside it (`dist/node/scripts/…`, `dist/node/prisma/seed-initial.js`), so production never needs `tsx`.

### 3.2 Scripts

Scripts must work in PowerShell, cmd and bash: no `VAR=value cmd` prefixes, no `rm -rf`. Env files are loaded with Node's `--env-file`; tests read `.env.test` from `vitest.config.ts`.

| Script | Command | Purpose |
|---|---|---|
| `postinstall` | `prisma generate` | Prisma 7 generates the client into `src/server/generated/prisma` (Batch 1 §7.2); a fresh clone, CI and the Render build all get it on install |
| `dev` | `pnpm run "/^dev:/"` | runs `dev:server` and `dev:client` in parallel **(as built: verified on pnpm 12, which runs regex-matched scripts in parallel; `pnpm run dev:server dev:client` does not work, because pnpm 12 passes the second name to the first script as an argument)** |
| `dev:server` | `tsx watch --env-file=.env src/server/index.ts` | API on :3000 |
| `dev:client` | `vite` | client on :5173, proxies `/api` |
| `build` | `pnpm build:client && pnpm build:server` | |
| `build:client` | `vite build` | → `dist/client` |
| `build:server` | `prisma generate && tsc -p tsconfig.server.json` | → `dist/node` |
| `start` | `node dist/node/src/server/index.js` | production; env from the platform |
| `start:local` | `node --env-file=.env dist/node/src/server/index.js` | try the production build locally |
| `db:migrate` | `prisma migrate dev && prisma generate` | apply migrations in dev (Prisma 7's `migrate dev` no longer regenerates the client) |
| `db:generate` | `prisma generate` | regenerate the client after a schema change |
| `db:migrate:create` | `prisma migrate dev --create-only` | new migration for review |
| `db:deploy` | `prisma migrate deploy` | production / CI |
| `db:seed` | `tsx --env-file=.env prisma/seed-dev.ts` | dev data (includes initial data) |
| `db:seed:initial` | `node dist/node/prisma/seed-initial.js` | production initial locations + slots |
| `admin:create` | `tsx --env-file=.env scripts/admin-create.ts` | dev |
| `admin:create:prod` | `node dist/node/scripts/admin-create.js` | production shell |
| `admin:reset-password` | `tsx --env-file=.env scripts/admin-reset-password.ts` | dev |
| `admin:reset-password:prod` | `node dist/node/scripts/admin-reset-password.js` | production shell |
| `test` | `vitest run` | unit + integration |
| `test:watch` | `vitest` | |
| `lint` | `eslint .` | |
| `typecheck` | `tsc -p tsconfig.client.json && tsc -p tsconfig.server.json --noEmit && tsc -p tsconfig.test.json` | **(as built)** all three projects |
| `format` | `prettier --write .` | |

### 3.3 Import boundaries (ESLint `no-restricted-imports`)

- `src/shared/**` may not import `src/server/**` (which includes the generated Prisma client), `src/client/**`, `node:*`, `express`, `@prisma/*` or `react`.
- `src/client/features/customer/**` and `src/client/components/**` may not import `src/client/features/admin/**`.
- `src/server/routes/**` may not import the generated Prisma client (`src/server/generated/**`) or `@prisma/*` (routes call services).

## 4. Local database

### 4.1 Docker Compose

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: bbc
      POSTGRES_PASSWORD: bbc
      POSTGRES_DB: bbc_dev
    ports:
      - "5433:5432" # (as built) host port 5433: a native PostgreSQL service on the owner's PC already uses 5432
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bbc -d bbc_dev"]
      interval: 5s
      retries: 10
volumes:
  pgdata: {}
```

`docker/init-test-db.sql`: `CREATE DATABASE bbc_test;`

Without Docker (common on Windows), install PostgreSQL 16 natively, create the `bbc` user and both databases, and point the env vars at them. Nothing else changes.

### 4.2 `.env.example`

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://bbc:bbc@localhost:5433/bbc_dev
DATABASE_URL_TEST=postgresql://bbc:bbc@localhost:5433/bbc_test
# 48 random bytes, base64url. Generate with:
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=replace-me
APP_ORIGIN=http://localhost:3000
PORT=3000
# Optional, development only: extra origins for testing on a phone over the LAN
# DEV_ALLOWED_ORIGINS=http://192.168.1.20:5173
```

`.env.test` (committed, no secrets): `NODE_ENV=test`, `DATABASE_URL` set to the **test** database, a fixed throwaway `JWT_SECRET`, `APP_ORIGIN=http://localhost:3000`.

**(as built) Ports.** Docker publishes Postgres on host port **5433**, and the examples use it, because many Windows PCs already run a native PostgreSQL on 5432 (the owner's does; `localhost:5432` then reaches that one and the login fails with `P1000`). The API's `PORT` defaults to 3000; if something else holds it (the owner's PC runs an unrelated Docker service there), set `PORT` and `APP_ORIGIN` in `.env` (e.g. 3100). The Vite dev proxy reads `PORT` from `.env`, so that is the only change needed. The server exits with code 1 and a `failed to start` log line if the port is taken (Express 5 reports that through the `listen` callback, not an exception).

**(as built) Checking the database.** There's no `psql` on the host; use `docker compose exec db psql -U bbc -d bbc_dev`.

## 5. Database

### 5.1 First migration

1. Write `prisma.config.ts` and `prisma/schema.prisma` exactly as Batch 1 §7.2. Record the installed Prisma version, the generator options and whether `@prisma/client` was needed in Batch 1 §4 / §7.2.
2. `pnpm db:migrate:create --name init`.
3. Edit `prisma/migrations/<ts>_init/migration.sql`: add `CREATE SEQUENCE order_number_seq START WITH 1001;` **above** `CREATE TABLE "orders"`, and append the rest of Batch 1 §7.3 at the end.
4. Review the generated SQL against this checklist:
   - every table and column is snake_case;
   - `orders.order_number` default is `('BB'::text || (nextval('order_number_seq'::regclass))::text)`;
   - `client_request_id` is `UUID` with a unique index;
   - all foreign keys are `ON DELETE RESTRICT`;
   - the indexes in §7.2 exist.
5. `pnpm db:migrate`, then confirm in `psql`: `\d orders` shows the checks; `SELECT * FROM delivery_settings;` returns one row with defaults. Run `pnpm db:migrate` again: it must report no schema changes (the hand-written default and checks cause no drift).
6. Commit the migration. It is never edited again once applied anywhere.

### 5.2 Seeds

**`prisma/seed-initial.ts`** (dev and production):

- Upserts locations `MSH` (sortOrder 0) and `Kanhar` (sortOrder 1) by name.
- Upserts slots by `(locationId, deliveryTime)`: MSH `20:00` / cutoff `19:30`; Kanhar `20:45` / cutoff `20:15`; active.
- Never changes an existing row's `isActive`, times or name. Safe to run twice; prints what it created and what it skipped.

**`prisma/seed-dev.ts`** (dev only):

- Exits with an error if `NODE_ENV=production`.
- Deletes all orders, order items and menu items, then runs the initial seed.
- Creates 6 sample items (Chicken Biryani ₹150, Paneer Biryani ₹130, Egg Biryani ₹120, Veg Biryani ₹110, Raita ₹20, Gulab Jamun ₹30), one of them disabled.
- Sets today's stock (IST) on the rest through `inventory.service.setTodayStock` once Batch 5 exists. Until then it writes `daily_stock = stock_remaining = N`, `stock_date = today` directly; this is the only place outside `inventory.service.ts` allowed to do so, and it is rewritten in Batch 5.
- Leaves settings at defaults and creates no admin.

Because stock belongs to a date (Batch 1 D1), dev data shows everything sold out the next day. Re-run `pnpm db:seed`.

### 5.3 Admin CLI

`scripts/admin-create.ts`:

1. Connects with `DATABASE_URL`.
2. If any admin exists, exits with "An admin already exists. Use admin:reset-password." (one admin in Phase 1).
3. Prompts for a username (lowercased; `^[a-z0-9_]{3,40}$`), then the password twice with hidden input. Requires at least 10 characters and a match.
4. Hashes with argon2id and inserts. Prints "Admin <username> created." and never prints the password or hash.

`scripts/admin-reset-password.ts`: prompts for the username and a new password (twice), updates the hash and increments `tokenVersion` (logs out every device). Both scripts call `auth.service` functions, which the tests use directly.

## 6. Server skeleton

### 6.1 Boot (`src/server/index.ts`)

1. `loadConfig(process.env)` (Batch 1 §11; also `DEV_ALLOWED_ORIGINS`). Print every problem and exit 1 if invalid.
2. Create Prisma client and clock (`createClock(config.clockOverride)`).
3. `createApp({ prisma, clock, config })` and `listen(config.port)`.
4. On `SIGTERM` / `SIGINT`: stop accepting connections, wait for in-flight requests (max 10 s), `prisma.$disconnect()`, exit 0.

### 6.2 `createApp` middleware order

1. `app.disable('x-powered-by')`; `app.set('trust proxy', config.trustProxy)`.
2. Request id (`crypto.randomUUID()`) on `req.id` and the `X-Request-Id` response header; request log on finish (§6.4).
3. `helmet` with the Batch 1 §9.5 CSP outside development (so the e2e run catches CSP violations); in development helmet runs without CSP (Vite serves the client). HSTS only in production.
4. `/api` router:
   1. `res.set('Cache-Control', 'no-store')`;
   2. `express.json({ limit: '10kb' })`;
   3. `GET /health`;
   4. public routers (empty until Batch 3);
   5. `/admin` router: `cookieParser()`, then the auth routes, then `requireAdmin` for everything else;
   6. `/api` catch-all → `404 NOT_FOUND`.
5. When `dist/client/index.html` exists and the `clientDir` option isn't `null`: static assets and SPA fallback (§6.5). **(as built)** `index.ts` passes `clientDir: null` when started with `--no-client`, which only `pnpm dev`'s `dev:server` does (Vite serves the client there, and a stale build must not sit beside it). Everything else serves it, including `pnpm start:local` with `NODE_ENV=development` in `.env`, production, and the Batch 7 e2e run. The CSP in step 3 still depends only on `NODE_ENV`.
6. Error handler (§6.3), last.

Express 5 forwards rejected promises from async handlers to the error handler; no wrapper library is needed.

### 6.3 Errors

`AppError(code, message, details?)` maps `code` to its HTTP status from `src/shared/errors.ts`. The error handler maps:

| Thrown | Response |
|---|---|
| `AppError` | its status, `{ error: { code, message, details } }` |
| `ZodError` | `400 VALIDATION_ERROR`, `details.fieldErrors` |
| body-parser `entity.parse.failed` / `entity.too.large` | `400 VALIDATION_ERROR`, message "Invalid request." |
| Prisma `P2002` (unique) not handled by a service | `409 DUPLICATE`, `details.field` |
| anything else | `500 INTERNAL_ERROR` with `details.requestId`; full error logged server-side |

`message` for 500s is always "Something went wrong. Please try again."

### 6.4 Logging

`lib/logger.ts` writes one JSON line per event to stdout: `{ "t": ISO, "level", "msg", "reqId", … }`. Request lines contain method, path **without the query string**, status and duration in ms. Never log bodies, cookies, phone numbers or passwords. Errors log `name`, `message`, `stack` and `reqId`.

### 6.5 Static files and SPA fallback (`src/server/static.ts`)

- Enabled when `dist/client/index.html` exists and `clientDir` isn't `null` (§6.2 step 5); under `pnpm dev` Vite serves the client instead. **(as built)** The SPA fallback answers only `GET`/`HEAD` requests outside `/api` whose `Accept` header includes `text/html`, so a missing script or image stays a 404 instead of returning `index.html`. Because `style-src 'self'` blocks inline `style` attributes, components must style with classes only.
- `express.static('dist/client', { index: false })`. Files under `/assets/` (hashed by Vite) get `Cache-Control: public, max-age=31536000, immutable`; other static files get `max-age=3600`.
- Any other `GET` or `HEAD` that does not start with `/api` and accepts `text/html` → `dist/client/index.html` with `Cache-Control: no-cache`.

### 6.6 Clock and time (`lib/clock.ts`, `src/shared/time.ts`)

- `createClock(override?: string)`: without an override, `now()` returns `new Date()`. With one, `now()` returns `override + (Date.now() − startedAt)`, so time still moves forward.
- `nowIST(clock)` → `{ instant, date, time }` (Batch 1 T2).
- Shared helpers: `isValidHHmm`, `compareHHmm`, `addMinutesIST(instant, minutes) → 'HH:mm'`, `formatTime12h('20:00') → '8:00 PM'`, `formatWindow('19:40', '19:50') → '7:40–7:50 PM'` (with both meridiems when they differ: `'11:50 AM–12:00 PM'`), `etaText(30, 40) → '30–40 minutes'`, `formatBusinessDate('2026-10-04') → 'Sun, 4 Oct'`.

Never use the server's local time zone: platforms usually run in UTC.

### 6.7 Health

`GET /api/health` runs `SELECT 1` with a 2 s timeout. `200 { status: 'ok' }` or `503 { status: 'error' }`.

## 7. Admin authentication

### 7.1 Server

- `auth.service.ts`:
  - `hashPassword(pw)` → argon2id hash;
  - `createAdmin(username, pw)`; `resetPassword(username, pw)` (bumps `tokenVersion`);
  - `login(username, pw)` → admin or `INVALID_CREDENTIALS` (verifies against a dummy hash when the user is unknown);
  - `issueToken(admin)` / `verifyToken(token)` using `jose` (`HS256`, `exp` 14 days, `clockTolerance` 5 s).
- Cookie helpers: `setSessionCookie(res, token)` — `bbc_admin`, `httpOnly`, `secure: config.isProduction`, `sameSite: 'lax'`, `path: '/'`, `maxAge` 14 days. `clearSessionCookie(res)` — same attributes, `maxAge: 0`.
- `requireAdmin`: read cookie → verify JWT → load admin by `sub` → compare `tokenVersion` → set `req.admin = { id, username }`. Any failure is `401 UNAUTHENTICATED` (and clears the cookie).
- `originCheck`: for `POST`, `PUT`, `PATCH`, `DELETE` under `/api/admin`, `Origin` must be in the allowed set: `APP_ORIGIN`; plus, in development only, `http://localhost:5173` and `DEV_ALLOWED_ORIGINS`. Otherwise `403 FORBIDDEN_ORIGIN`.
- `loginRateLimit`: `express-rate-limit`, 10 requests per 15 min per IP, `skipSuccessfulRequests: true`, handler returns `429 RATE_LIMITED` with `Retry-After`. Limits come from `createApp` options so tests can lower them.
- Routes: `POST /login` (originCheck, loginRateLimit, `loginSchema`), `POST /logout` (requireAdmin, originCheck), `GET /me` (requireAdmin).
- `loginSchema` in `src/shared/schemas/auth.ts`: `username` trimmed, lowercased, 3–40; `password` 1–200 (the 10-character minimum applies only when creating or resetting).

### 7.2 Client

- `useAdminSession()` = SWR on `/api/admin/me` (`shouldRetryOnError: false`).
- `<RequireAdmin>` wraps every `/admin/*` route except login. Loading → full-screen skeleton; `401` → `navigate('/admin/login?next=<path>')`.
- `api.ts`: any admin request returning `401` clears the SWR session cache and redirects to login.
- `next` is honoured only if it starts with `/admin/` (no open redirect).
- After logout: clear all SWR caches, go to `/admin/login`.

### 7.3 Login screen

- Logo (96 px), title "VENDOR LOGIN" (Archivo), username field (`autocomplete="username"`, `autocapitalize="none"`, `spellcheck="false"`), password field (`autocomplete="current-password"`, show/hide toggle with `aria-pressed`), full-width primary button "Log in".
- While submitting: button disabled with an inline spinner; fields stay editable.
- Errors (danger banner with icon, focus moved to it): `INVALID_CREDENTIALS` → "Wrong username or password."; `RATE_LIMITED` → "Too many attempts. Try again in a few minutes."; network failure → "Couldn't reach the server. Check your connection."
- Already logged in → redirect to `/admin`.

### 7.4 Admin shell (placeholder content)

- Top bar: logo + "BBC ADMIN", logout button.
- Bottom nav with four tabs (Today, Stock, Menu, Settings), 56 px high, respecting `env(safe-area-inset-bottom)`. Batch 6 creates the tab screens; until then the tabs are rendered disabled and `/admin` shows "Dashboard arrives in Batch 6."

## 8. Client foundation

### 8.1 Vite

```ts
// vite.config.ts (shape)
export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  build: { outDir: '../../dist/client', emptyOutDir: true, sourcemap: true, target: 'es2022' },
});
```

**(as built)** The proxy target is `http://127.0.0.1:<PORT>`, with `PORT` read from `process.env` or `.env`. The config parses `.env` itself (`util.parseEnv`) and must not call Vite's `loadEnv()`: that picks up `NODE_ENV=development` from `.env`, and `vite build` then ships React's development build (the first customer bundle went from 90 KB to 152 KB gzipped, over the Batch 1 §10.5 budget). The build also sets `assetsInlineLimit: 0`, because inlined `data:` fonts would be blocked by `font-src 'self'`.

To test on a real phone in development: `pnpm dev:client --host`, then open `http://<pc-lan-ip>:5173` and add that origin to `DEV_ALLOWED_ORIGINS`. The admin cookie isn't `Secure` in development, so login works over LAN HTTP.

### 8.2 `index.html`

- `<html lang="en-IN">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color" content="#FDE68A">`.
- `<title>Bunty Biryani Centre · Order online</title>`, meta description "Order biryani from Bunty Biryani Centre. Batch delivery to your hostel or express in about 30–40 minutes. Cash on delivery."
- Favicon (32 px PNG) and `apple-touch-icon` (180 px), both cut from the logo.
- `<link rel="preload" as="font" type="font/woff2" crossorigin href="…/inter-latin.woff2">`.

### 8.3 Fonts

Self-hosted woff2 in `src/client/assets/fonts/`, declared in `styles/fonts.css` with `font-display: swap`:

- **Inter** variable, weights 400–700: the `latin` subset, plus **(as built)** a 2 KB **₹-only subset** (`unicode-range: U+20B9`) instead of the whole `latin-ext` file (~25 KB for one glyph). Without it `₹` falls back to a system font next to Inter digits. Get it from the Google Fonts CSS API with `text=%E2%82%B9` and download the woff2 it names; if that is ever unavailable, use `latin-ext`. Verified in Chrome: for a ₹ the only face that loads is the U+20B9 one.
- **Archivo** 800 (and 700 if used), `latin` subset only (headings and order IDs are ASCII).

No Google Fonts request at runtime: one less third-party connection on slow mobile networks, and the CSP stays `font-src 'self'`.

### 8.4 Logo

The source PNG (`.claude/assets/bbc-logo.png`, ~120 KB) is not shipped. Export once with any image tool and commit:

- `src/client/assets/logo-96.webp` and `logo-192.webp` (header at 48 px CSS with `srcset` for 1x/2x and up to 3x screens), target under 15 KB each;
- `favicon-32.png`, `apple-touch-icon.png` (180 px); Batch 7 adds the 192/512 manifest icons.

**(as built)** The exports are 2.8 KB and 7 KB. The logo is a square picture with text along the bottom, so show it as a rounded square (`rounded-control` / `rounded-card`), never `rounded-full`, which crops "BUNTY BIRYANI CENTRE". The header uses `srcset` with `96w, 192w` and `sizes="48px"`.

Always render with explicit `width`/`height` to avoid layout shift. `alt="Bunty Biryani Centre"`.

## 9. Design tokens

`src/client/styles/index.css`:

```css
@import "tailwindcss";
@import "./fonts.css";

@theme {
  --color-*: initial; /* (as built) removes Tailwind's default palette, so only the tokens below exist */

  /* Brand (from the logo) */
  --color-brand: #C8323A;          /* "BUNTY BIRYANI CENTRE" red: primary actions */
  --color-brand-strong: #A3242C;   /* pressed / hover */
  --color-on-brand: #FFFFFF;
  --color-gold: #C99A2E;           /* flat gold from "BBC": borders, icons, badges. Never text, never gradients */
  --color-gold-soft: #F6E7C1;      /* gold-tinted backgrounds */
  --color-ink: #3A2A1F;            /* espresso brown: body text */
  --color-ink-muted: #6B5646;      /* secondary text (≥ 4.5:1 on cream) */
  --color-sun: #FDE68A;            /* sun-yellow: header band */
  --color-cream: #FFF8EC;          /* page background */
  --color-surface: #FFFFFF;        /* cards, inputs */
  --color-line: #EADCC6;           /* borders, dividers */

  /* Status (never the brand red for errors) */
  --color-danger: #B42318;
  --color-danger-soft: #FDECEA;
  --color-warning: #8A5300;
  --color-warning-soft: #FFF3D6;
  --color-success: #1F7A4C;
  --color-success-soft: #E5F4EC;
  --color-info: #1F4E79;
  --color-info-soft: #E8F0F8;

  /* Type */
  --font-display: "Archivo", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Shape */
  --radius-card: 0.75rem;
  --radius-control: 0.625rem;
  --shadow-card: 0 1px 2px rgb(58 42 31 / 0.08);
  --shadow-bar: 0 -2px 8px rgb(58 42 31 / 0.12);
}
```

Usage rules:

- **Contrast checks:** brand red on white ≈ 5.3:1 and on cream ≈ 5.0:1, fine for text and buttons. Brand red on sun-yellow is ≈ 4.2:1, so use ink text on sun-yellow and red only for large display text there. Gold on white is ≈ 2.6:1, so gold is decoration only.
- **Primary button:** `bg-brand text-on-brand`, 48 px min height, `rounded-control` (Tailwind v4 generates `rounded-control`, `rounded-card` and `shadow-card` from the `--radius-*` and `--shadow-*` tokens; the v3 form `rounded-[--radius-control]` doesn't work), Inter 600 16 px. Pressed: `bg-brand-strong`. Disabled: 40% opacity, `cursor: not-allowed`.
- **Focus:** `outline: 2px solid var(--color-ink); outline-offset: 2px` on `:focus-visible` everywhere (gold fails the 3:1 non-text contrast on cream).
- **Display type:** Archivo 800 uppercase, letter-spacing 0.02em, for page titles, section headings, the brand name and order IDs.
- **UI type:** Inter. Body 16 px / 1.5. Secondary 14 px. Prices Inter 600 with `font-variant-numeric: tabular-nums`.
- **Inputs:** 16 px font (prevents iOS zoom), 48 px height, `bg-surface`, `border-line`, error state `border-danger` + icon + message in `text-danger`.
- **Layout:** 4 px spacing grid; 16 px page gutter; content max width 480 px centred on larger screens; `min-height: 100dvh`.
- **Motion:** none beyond 150 ms colour/opacity transitions; all disabled under `prefers-reduced-motion: reduce`.
- **Global:** `body { background: var(--color-cream); color: var(--color-ink); font-family: var(--font-sans); -webkit-tap-highlight-color: transparent; }`.

## 10. Base components (built now, reused later)

| Component | Notes |
|---|---|
| `Button` | variants `primary`, `secondary` (surface + line border), **(as built, Batch 3)** `outline` (1px `border-brand`, `bg-surface text-brand`, hover `bg-gold-soft` like `secondary`; the menu's "Add" button), `ghost`, `danger` (danger colour, for destructive confirms only); `loading` prop shows a spinner and sets `aria-busy`; `fullWidth` |
| `TextField` | label always visible, optional hint, error with icon (`aria-describedby`, `aria-invalid`); passes `inputMode`, `autoComplete`. **(as built, Batch 4)** an optional `counter` (e.g. `101/120`, muted and right-aligned under the field, linked by `aria-describedby`), and `aria-describedby` no longer points at a hint that is hidden because an error shows (an existing bug). It also exports a small `FieldError` (icon + `text-danger` message) that the checkout reuses for its choice-section errors |
| `RadioCard` | **(as built, Batch 4)** a real `<input type="radio">` restyled as a bordered card (`min-h-12`): `title`, optional `lines`, optional right-aligned `aside` that never wraps (a fee or a cutoff hint), optional `reason`, an `errorId` to announce a group error, and an `inputRef`. A disabled card is `aria-disabled` (never `disabled`) and stays focusable, with the reason linked by `aria-describedby`. Used by the checkout's method and where-and-when choices |
| `Banner` | `info`, `warning`, `danger`, `success`; icon + text + optional action; `role="status"` (or `role="alert"` for danger); **(as built, Batch 4)** an optional `role` prop overrides it (the checkout's paused banner is `role="alert"`) |
| `Skeleton` | grey-cream blocks with a subtle pulse (none under reduced motion) |
| `ErrorState` | icon, title, message, "Try again" button **(as built, Batch 3 follow-ups)** that shows a spinner and is busy while `retrying` (pass SWR's `isValidating`) |
| `EmptyState` | icon, title, message, optional action |
| `BackToMenuLink` | **(as built, Batch 3 follow-ups)** the 48 px "Back to the menu" link used as the action on the not-found page (the `/checkout` placeholder it also served was replaced by the real checkout page in Batch 4) |
| `Icon` set | inline SVG React components: `alert`, `info`, `check`, `x`, `plus`, `minus`, `phone`, `clock`, `map-pin`, `cart`, `chevron-right`, `chevron-left` (Batch 4), `bolt`, `truck`, `eye`, `eye-off`. No icon library |
| `AppHeader` | sun-yellow band, logo, "BUNTY BIRYANI CENTRE" (Archivo); used by customer pages **(as built, Batch 3)** renders the page `<h1>` (logo + brand name, linked to `/`), takes an optional `subline` (e.g. "Today's menu · Sun, 4 Oct"), and the logo has `alt=""` because the brand text beside it is the name. New `CustomerPage` (`components/CustomerPage.tsx`) wraps `AppHeader` and the centred `main`; `reserveCartBar` adds bottom padding `calc(5.5rem + env(safe-area-inset-bottom))` so the sticky cart bar never covers the last card |
| `AdminShell` | §7.4 |

## 11. Edge cases handled in this batch

| Case | Handling |
|---|---|
| Server runs in UTC | All business time goes through `nowIST`; a unit test runs with `TZ=America/New_York` and still gets IST results |
| Missing or weak `JWT_SECRET` | Boot fails with a clear message |
| `CLOCK_OVERRIDE` set in production | Boot fails |
| `NODE_ENV=production` set at install time skips devDependencies and breaks `vite build` | Batch 8 build command uses `pnpm install --frozen-lockfile --prod=false` |
| Windows shells | Cross-platform scripts (§3.2); `.gitattributes` forces LF |
| Testing admin login from a phone over LAN HTTP | Cookie not `Secure` outside production; `DEV_ALLOWED_ORIGINS` |
| Unknown `/api/*` path in production | JSON 404, not `index.html` |
| Deep link like `/admin/stock` refreshed in production | SPA fallback serves `index.html`; the client router renders the route |
| Expired or revoked session mid-use | Any admin `401` redirects to login with `next` |
| Two admins created by mistake | CLI refuses a second admin |

## 12. Tests

### 12.1 Harness

- `vitest.config.ts` defines two projects: `unit` (`tests/unit/**`, parallel) and `integration` (`tests/integration/**`, `fileParallelism: false`, `globalSetup` resets the test database; no seed runs). **(as built)** The reset is `tests/helpers/reset-schema.ts`: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` through the test client, then `pnpm exec prisma migrate deploy` with `DATABASE_URL` set to the test database (that's what `prisma.config.ts` reads). It replaces `prisma migrate reset --force`: faster, no seed step, and Prisma blocks that command when it detects an AI agent running it. Batch 7's e2e setup reuses the helper.
- **(as built) Which database.** `tests/helpers/test-env.ts` (imported by `vitest.config.ts`) picks the URL from `DATABASE_URL_TEST` in the environment, else `.env`, else `DATABASE_URL` in `.env.test`, and passes it to the workers as `DATABASE_URL`. It refuses to run if the URL equals `DATABASE_URL` in `.env` or if the database name doesn't contain "test" (the guard that protects a production URL left in the shell).
- The harness refuses to run if the test URL equals `DATABASE_URL` from `.env`.
- `tests/helpers/db.ts`: `resetDb()` truncates `order_items, orders, menu_items, delivery_slots, delivery_locations, admins` with `RESTART IDENTITY CASCADE`, runs `ALTER SEQUENCE order_number_seq RESTART WITH 1001`, and resets the settings row to defaults. Called in `beforeEach`.
- `tests/helpers/app.ts`: `makeApp({ now?: string, limits? })` → `createApp` with a test clock and the test Prisma client.
- `tests/helpers/factories.ts`: `createAdmin`, `createLocation`, `createSlot`, `createMenuItem` (stock fields consistent; nothing sold).

### 12.2 Unit

1. `config`: valid env parses with defaults; missing `DATABASE_URL` fails; `JWT_SECRET` under 32 chars fails; `CLOCK_OVERRIDE` with `NODE_ENV=production` fails.
2. `nowIST`: `2026-10-04T18:29:59Z` → `2026-10-04`, `23:59`; `2026-10-04T18:30:00Z` → `2026-10-05`, `00:00`; same results with `process.env.TZ = 'America/New_York'`.
3. `formatTime12h`: `00:05` → `12:05 AM`; `12:00` → `12:00 PM`; `20:00` → `8:00 PM`. `formatWindow('11:50','12:00')` → `11:50 AM–12:00 PM`; `formatWindow('19:40','19:50')` → `7:40–7:50 PM`.
4. `formatINR`: `0` → `₹0`; `330` → `₹330`; `1340` → `₹1,340`; `100000` → `₹1,00,000`.
5. `normalizeIndianMobile`: `9876543210`, `98765 43210`, `+91 98765-43210`, `919876543210`, `09876543210` → `9876543210`; `5876543210`, `987654321`, `98765432101`, `abc` → invalid.
6. `createClock` with override advances with real time.

### 12.3 Integration

1. `GET /api/health` → 200 `{status:'ok'}`; with a Prisma stub whose `$queryRaw` throws → 503.
2. `GET /api/nope` → 404 `NOT_FOUND` JSON. Every `/api` response has `Cache-Control: no-store`.
3. Malformed JSON body → 400 `VALIDATION_ERROR`; 11 KB body → 400.
4. Login with correct credentials → 200 `{username}`; `Set-Cookie` contains `bbc_admin`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=1209600`; no `Secure` in the test config, `Secure` when built with production config.
5. Wrong password → 401 `INVALID_CREDENTIALS`; unknown username → byte-identical body.
6. Login without `Origin` → 403; with `Origin: https://evil.example` → 403.
7. With the limit lowered to 3: three failed logins then a fourth → 429 `RATE_LIMITED` with `Retry-After`; successful logins don't use up the allowance.
8. `GET /api/admin/me`: no cookie → 401; valid → 200; signature tampered → 401; expired (test clock +15 days) → 401; after `resetPassword` → 401; admin row deleted → 401.
9. `POST /api/admin/logout` → 204 and a clearing `Set-Cookie` (`Max-Age=0`); the old cookie still fails `/me` only after a password reset (documented limitation, asserted so it's visible).
10. Constraints (direct SQL through Prisma; each expects a check violation): negative `stock_remaining`; `stock_remaining > daily_stock`; price 0; slot with `cutoff_time >= delivery_time`; slot time `'8:00'`; second `delivery_settings` row; batch order without `slot_id`; express order with `slot_id`; `total ≠ food_subtotal + delivery_fee`; order `CANCELLED` + `COLLECTED`; order item `line_total ≠ unit_price * quantity`.
11. Order number default: two inserted orders get `BB1001`, `BB1002`.
12. `seed-initial` twice → exactly 2 locations and 2 slots; a slot the test deactivated stays deactivated.
13. `seed-dev` with `NODE_ENV=production` exits non-zero without touching data.
14. `createAdmin` twice → second refused; password `short` refused; stored hash starts with `$argon2id$`.
15. Production static mode (temp `dist/client` fixture): `GET /admin/stock` with `Accept: text/html` → `index.html`, `Cache-Control: no-cache`; `GET /assets/app-abc123.js` → `immutable`; `GET /api/unknown` → JSON 404.

### 12.4 Manual check

1. `docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm admin:create`, `pnpm dev`.
2. At 360 px in Chrome device mode: `/` shows the header with the logo, the brand fonts and the cream background, with no horizontal scroll.
3. `/admin` redirects to login; wrong password shows the danger banner; correct login lands on the admin shell; refresh keeps the session; logout returns to login.
4. `pnpm build && pnpm start:local`: the same flows work on `http://localhost:3000` from one process.

## 13. Definition of done

Verified 2026-10-04 on Windows 11 with Node 24.16, pnpm 12.8.1, Docker Postgres 16 (checked from Git Bash; pnpm runs scripts in its own shell, so PowerShell behaves the same):

- [x] Scripts in §3.2 run: `dev`, `build`, `start:local`, `db:migrate` (twice: no drift), `db:deploy`, `db:seed` (twice), `db:seed:initial` (compiled), `test`, `lint`, `typecheck`, `format`, and the compiled `admin:*:prod` scripts. Not run on Linux.
- [x] `init` migration applied and reviewed; the checks, sequence and settings row exist (queried with `psql`). **Not committed**: nothing is committed until the owner asks.
- [x] Seeds behave as §5 (idempotent; `seed-dev` refuses `NODE_ENV=production` before connecting).
- [ ] **Owner to check:** `pnpm admin:create` interactively in PowerShell. Verified: it refuses a second admin, and refuses to read a password from a non-terminal. The hidden-input prompt itself needs a real terminal, which the build session didn't have.
- [x] Auth meets Batch 1 §9.1–§9.4 (15 auth tests, plus a manual run against the built app).
- [x] Tokens, fonts and logo in place; the Tailwind palette is restricted to the tokens; no raw hex values in components.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` (106 tests) pass.
- [x] Manual check §12.4 passed in headless Chrome with mobile emulation at 360 px and 320 px (no horizontal scroll, no CSP violations under `NODE_ENV=test`) and a scripted login, reload, wrong-password and logout run. Not tried on a real phone.
- [x] Batch 1 §4 / §7.2 record the real versions and generator options.
- [x] `CLAUDE.md`: Batch 2 marked done, Commands section matches the real scripts.

Measured: customer first-load JS for `/` is 90 KB gzipped (budget 130 KB); the admin chunk is separate (3 KB gzipped).

## 14. Files created

`package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `eslint.config.js`, `tsconfig.base.json`, `tsconfig.json`, `tsconfig.client.json`, `tsconfig.server.json`, `tsconfig.test.json`, `vite.config.ts`, `vitest.config.ts`, `prisma.config.ts`, `docker-compose.yml`, `docker/init-test-db.sql`, `.env.example`, `.env.test`,
`prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql`, `prisma/seed-initial.ts`, `prisma/seed-dev.ts`,
`scripts/admin-create.ts`, `scripts/admin-reset-password.ts`, `scripts/lib/prompt.ts`,
`src/shared/{enums,limits,errors,money,time,phone}.ts`, `src/shared/schemas/auth.ts`,
`src/server/{index,app,config,db,static}.ts`, `src/server/lib/{clock,app-error,logger,db-date}.ts`, `src/server/middleware/{require-admin,origin-check,rate-limits,validate,error-handler,request-log}.ts`, `src/server/routes/health.ts`, `src/server/routes/admin/auth.ts`, `src/server/services/auth.service.ts`,
`src/client/{index.html,main.tsx,App.tsx,copy.ts}`, `src/client/styles/{index.css,fonts.css}`, `src/client/assets/*`, `src/client/lib/api.ts`, `src/client/components/*` (§10), `src/client/features/admin/{auth,layout}/*`, `src/client/NotFound.tsx`,
`src/server/express.d.ts` (request typings: `id`, `admin`, `valid`), `src/shared/api-types.ts` (error body, session and health types).
`tests/helpers/{app,clock,db,factories,global-setup,http,reset-schema,setup,test-env}.ts`, `tests/unit/{config,time,money-phone-clock}.test.ts`, `tests/integration/{health,auth,constraints,seed,static}.test.ts`.

## 15. Commands

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm admin:create
pnpm dev                      # http://localhost:5173 (client), :3000 (API)
pnpm lint && pnpm typecheck
pnpm test
pnpm build && pnpm start:local   # production-style single process on :3000
```
