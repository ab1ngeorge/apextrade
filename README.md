# ApexTrade

A full-stack educational paper-trading terminal. **SIMULATED TRADING — VIRTUAL MONEY ONLY.** No broker, bank, payment, or live exchange integrations exist.

## Implementation status

This repository started empty. It now contains a Next.js/TypeScript application, Tailwind styling, PostgreSQL/Prisma schema and initial migration, server-side sessions, deterministic OHLCV data, transaction-safe trading, and unit/integration/Playwright suites.

**Verification remains blocked (26 October 2026):** three dependency-free tests passed again. Package downloads fail with socket-level `EACCES` despite a writable cache. Docker is stopped and cannot be started by this process. PostgreSQL 18 is installed and accepting connections on 5432, but no authorized app credentials are available; a separate workspace cluster initialized but could not start under Windows token restrictions. Migration, seeding, build, integration tests and browser workflow remain unverified. No website or deployment is running. See [the verification record](docs/VERIFICATION.md) for commands and evidence.

## Architecture

- Next.js App Router (15), React, TypeScript, Tailwind CSS 4; original responsive dark terminal and optional light theme.
- Next.js Node server routes, Zod validation, bcrypt password hashes (cost 12).
- PostgreSQL 17 with Prisma 6. All financial storage uses signed BIGINT integer paise; JSON transports them as decimal strings.
- Lightweight Charts candles and volume; frozen deterministic snapshot at `2026-10-23T10:00:00Z` (15:30 IST).
- Opaque 256-bit sessions, SHA-256 token digests in database, HttpOnly/SameSite=Lax cookies, Secure in production. Seven-day fixed session expiry. Logout revokes session.
- Same-origin checks for every mutation and database-backed write/authentication rate limits. All account-scoped queries derive ownership from the session, never a submitted user ID.
- Market execution locks the account row with PostgreSQL `FOR UPDATE` in a single transaction. Concurrent orders and duplicate keys serialize. Every fill writes one execution, one trade, one ledger movement, the position, and account cash atomically. Rejected and cancelled orders do not change financial state.

## Local setup (PowerShell)

Prerequisites: Node 22.14+ (or Node 22 LTS), npm, a running Docker Desktop Linux-container daemon. Allow access to npm and Prisma binary downloads.

```powershell
Copy-Item .env.example .env
npm.cmd install
docker compose up -d db
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

This repository currently has **no package-lock.json** because registry resolution has never succeeded. The first successful install must generate it; review and retain it. On subsequent installs use `npm.cmd ci` rather than resolving dependency ranges again. Do not delete a lockfile to fix installation errors. Project `.npmrc` keeps npm's cache within ignored `.runtime` to avoid the inaccessible user cache.

### Docker-free PostgreSQL on Windows

PostgreSQL 18.6 binaries were found locally. If Docker is unavailable, this optional helper uses them to create an independent development cluster on **127.0.0.1:55432**, keeping the existing service on 5432 untouched:

```powershell
# Run before copying .env.example: initialization preserves and refuses an existing .env.
./scripts/local-postgres.ps1
./scripts/local-postgres.ps1 -Action status
# Stop only the helper's own cluster, not the Windows service:
./scripts/local-postgres.ps1 -Action stop
```

The helper generates random credentials in ignored local files, creates separate apextrade/apextrade_test databases when startup succeeds, and configures .env. It does not reset databases or delete partial clusters. **In this restricted session, initialization succeeded but startup failed with restricted-token errors 87/3.** A generated local .env now points to that non-running cluster. Do not assume it is a working connection. Retry startup from an authorized normal shell, or configure authorized development/test connection URLs for the existing PostgreSQL service. Never replace PostgreSQL with a different database to claim these tests passed. No credentials for the existing service have been discovered or guessed.

Open **http://localhost:3000**. Configure these development credentials in `.env` before seeding:

- Email: **agent@apextrade.test**
- Password: **AgentTest!2026**
- Initial virtual cash: **₹10,00,000.00**, no holdings.

Seed is idempotent and does not reset balances or overwrite passwords. It rejects production and requires `ENABLE_DEMO_SEED=true`. The login page displays the configured demo credentials only in development with that flag. Never reuse this password outside the simulator. Production has no universal demo login and no demo credentials in its rendered page.

The application reads `.env` through Next.js. Node scripts/configs load `.env` explicitly. Prisma CLI reads `.env` automatically. Do not commit `.env`.

## Docker application

Run local migration and development seed above, then:

```powershell
docker compose up --build -d web
```

The container starts the production server on localhost:3000 after applying migrations. A production-mode container intentionally cannot run the demo seed. Database data persists in the `apex-data` volume. Do not remove that volume to troubleshoot ordinary failures.

## Tests and build

The Compose database initialization creates a separate `apextrade_test` database on the **first** initialization. If the existing volume predates it, create that database explicitly rather than deleting the volume:

```powershell
docker compose exec db createdb -U apex apextrade_test
```

Migrate the isolated test database (PowerShell):

```powershell
$env:DATABASE_URL='postgresql://apex:apex_local_only@localhost:5432/apextrade_test?schema=public'
npm.cmd run db:migrate
Remove-Item Env:DATABASE_URL
npm.cmd run test:core
npm.cmd run test:unit
npm.cmd run test:integration
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd start
```

Set `TEST_DATABASE_URL` in `.env`. Vitest redirects its Prisma connection to that URL. E2E passes that URL to its own Next development server. Both guard against a database name that does not end in `_test`; E2E additionally truncates only that isolated database before seeding. E2E refuses an already-running server, so stop the normal development server on port 3000 first. Never set TEST_DATABASE_URL to a production instance, even if its name ends in `_test`.

`npm test` runs unit and integration suites; without TEST_DATABASE_URL, integration tests are explicitly skipped. `test:core` needs no installed packages. Integration tests create distinct users per test and do not reset the normal demo account. Full E2E outputs HTML to `playwright-report/` and machine-readable JSON to `test-results/results.json`; do not claim passes unless that run succeeded. Initial credential login, user isolation, persistence, CSV, buy/sell, rejections and idempotency are covered in the authored E2E suite. Financial rounding and generated OHLC invariants also have dependency-free tests.

Run `node scripts/verify.mjs` to execute core tests, typecheck, lint, build, migration, seed, unit, integration, and E2E in sequence and record each exit code/output in ignored `.runtime/verification.json`. Run it only with authorized development DATABASE_URL and an isolated TEST_DATABASE_URL. Missing tools are failures/blockers, not passing tests. On the latest run only `test:core` passed (3 tests); every other command stopped before executing its checks because its dependency was missing. `npm.cmd run dev` also failed because Next.js was not installed. Browser inventory is empty, so no manual UI trade has been verified.

## Workflow and deterministic benchmark

1. Log in, search RELIANCE in Markets, open its details, inspect chart and OHLC.
2. Compare with TCS; open TCS as well. RELIANCE is ₹2,850.00, day change 1.06%, volatility score 1.10. TCS is ₹4,120.00, day change 0.37%, volatility score 0.55. The lower synthetic volatility and smaller observed day movement can support a conservative educational choice of TCS, while neither predicts returns.
3. Add to a persisted watchlist, inspect Portfolio, place a 5-share Market order, review fees, then confirm once.
4. Wait for FILLED/REJECTED/PENDING; verify order ID in Orders and execution in Portfolio and Cash Ledger. On transport uncertainty, do not submit another purchase; check history first. The UI blocks a repeat within the uncertain ticket.

Five RELIANCE shares cost ₹14,250.00 plus ₹14.25 fee. From the initial account, cash becomes ₹9,85,735.75, holdings market value ₹14,250.00, equity ₹9,99,985.75. Five TCS shares cost ₹20,600.00 plus ₹20.60, leaving cash ₹9,79,379.40 and equity ₹9,99,979.40. These are expected deterministic examples, not a claim that a browser trade has been executed here.

## Accounting

Prices and cash are integer paise. Notional = integer quantity × server price. Fee = 0.10% of notional, rounded half-up to one paise: `(notional + 500) / 1000` with integer division. The UI preview is informational; the server is authoritative.

Buy: debit notional + fee; add purchase notional to position cost basis. Fees are tracked separately and excluded from average cost. Average cost display is rounded half-up to one paise; full remaining basis is retained. Partial sale removes proportionate cost basis rounded half-up; the final sale removes all remaining basis. Gross realized P&L is proceeds minus removed basis. Cash increases by proceeds minus sell fee. Net trading P&L = gross realized + unrealized − **all** buy and sell fees, including fees for open holdings. Gross realized is deliberately labeled gross, not net realized.

Market value = quantity × authoritative quote; unrealized = market value − remaining basis; equity = cash + market value. Ledger starts with one initial virtual credit and records net cash per execution. Portfolio uses a repeatable-read snapshot, checks sum of ledger deltas against account cash, and reports equity from cash plus holdings. Closed positions retain cumulative realized P&L/fees.

## Important routes and source files

- `src/app/api/[...path]/route.ts`: API dispatch, auth/ownership, errors and CSV.
- `src/lib/trading.ts`: transaction locks, order idempotency, execution and reconciliation.
- `src/lib/money.ts`: exact fee and basis arithmetic.
- `src/lib/auth.ts`: sessions and persistent rate limits.
- `src/lib/market.ts`, `prisma/seed.ts`: deterministic fixture provider and restricted seed.
- `prisma/schema.prisma`, `prisma/migrations/`: 15 relational models and constraints.
- `src/components/Terminal.tsx`, `Chart.tsx`: responsive UI and chart integration.
- `tests/`: dependency-free tests, Vitest and Playwright suites.
- UI: `/`, `/markets`, `/stocks/RELIANCE`, `/watchlists`, `/portfolio`, `/orders`, `/ledger`, `/notifications`, `/settings`, `/agent-lab`.

See [API reference](docs/API.md), [deployment](docs/DEPLOYMENT.md), [verification record](docs/VERIFICATION.md).

## Limitations

Limit/stop-loss orders and price alert rules are **pending-only/saved-only**. They never trigger automatically; pending orders do not reserve cash or holdings. They validate resources at placement, can be cancelled, and cannot mutate funds. Advanced partial fills and a matching order book are not implemented. The execution model is ready to factor into a future trigger engine, which must recheck resources and retain row locking/idempotency.

NASDAQ listings use synthetic INR prices; there is no FX, live quote feed, live clock, live index data, margin, shorts, or derivatives. Tests control fixtures in the isolated database; there is no privileged reset/quote-mutation UI or public API. Profile name and browser-local theme are editable; password reset, email verification, and session-management UI are not implemented. Public registration exists; it creates only virtual funds. Rate-limit rows need operational retention cleanup at scale. Ledger and order history are not paginated in this initial implementation. No deployment, installed dependency lockfile, vulnerability audit, visual browser QA, or full build certification is available from this constrained environment.

## Troubleshooting

- `EACCES` fetching npm registry: permit registry access in the execution environment. A cache inside the workspace avoids user-cache permissions, but cannot fix blocked network access: `npm.cmd install --cache .runtime/npm-cache`.
- Docker named pipe missing: start Docker Desktop and wait for the Linux engine; run `docker version` again. This app cannot start PostgreSQL without a database service.
- Prisma cannot connect: verify DATABASE_URL, port 5432, container health, and migrations. Do not substitute a real financial service.
- Missing Prisma client: run `npx.cmd prisma generate` after install.
- 403 mutation: APP_ORIGIN must exactly match the visible browser origin, including port. Use `http://localhost:3000`, not a different hostname.
- Login fails: seed with the intended env and development NODE_ENV. Seed does not change an existing user's password. Use an isolated new development database if necessary; never reset production.
- Port 3000 in use: stop the other server before E2E. E2E intentionally refuses to attach to an unknown server.
- A submitted order has no definitive result: inspect Orders, Portfolio and Ledger before any further trade; do not assume success or resubmit with a new key.
