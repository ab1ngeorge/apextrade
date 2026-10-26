# Verification record — 26 October 2026

Observed on Windows, Node v22.14.0, npm 10.9.2. Repository was empty at inspection; no prototype, manifests, README or existing tests were present.

| Check | Observed result |
|---|---|
| Dependency-free Node accounting suite | **3 passed, 0 failed**; exact buy/partial sale/equity, fee/basis rounding, all 12 OHLCV histories |
| Node syntax checks | `--experimental-strip-types --check` succeeded for trading engine and API route; this is not a TypeScript typecheck |
| npm install | Failed: `FetchError ... registry.npmjs.org/@eslint%2feslintrc ... EACCES`, including with writable workspace cache and zero fetch retries |
| Existing npm cache | Inaccessible: `EPERM ... scandir ... npm-cache/_cacache/index-v5` |
| Docker version | CLI 29.6.1 present; daemon connection failed: `open //./pipe/docker_engine: The system cannot find the file specified` |
| Production build | Attempted, blocked: `'prisma' is not recognized` (dependencies not installed) |
| Vitest | Attempted, blocked: `'vitest' is not recognized` |
| Playwright E2E | Attempted, blocked: `'playwright' is not recognized` |
| Database migrations and demo seed | Authored, not applied; no running PostgreSQL |
| TypeScript / lint | Attempted; `'tsc' is not recognized` and `'eslint' is not recognized` (dependencies absent) |
| Compose configuration | `docker compose config --quiet` exited 0, with inaccessible user Docker config warnings; no containers launched |
| Visual browser QA | Not verified; no connected browser |
| Local server / hosted deployment | Not started / not deployed |

The three core tests exercise the actual source arithmetic and data provider, not the database transaction engine. They do not establish transaction safety, UI correctness, authentication correctness, or the absence of TypeScript errors. Those are covered by authored tests and require running them after environment blockers are resolved.

No purchase has been executed in a running ApexTrade browser session. Examples in README are expected deterministic accounting values only. Agent Lab reads database evidence and deliberately leaves browser-only actions unverified. No test results have been fabricated.

## Environment recovery follow-up — 26 October 2026

The requested verification was attempted again. **It remains blocked, not complete.** No existing lockfile was present, so none was deleted or replaced. No repository reset, permission changes, security changes, service reconfiguration, or destructive database reset was performed.

### Diagnosis and recovery attempts

| Command / inspection | Actual result |
|---|---|
| `node --version`, `npm.cmd --version` | v22.14.0 / 10.9.2 |
| `npm.cmd config get cache` / `prefix` | Default user cache under AppData/Local; global prefix AppData/Roaming/npm. Dependencies would be installed locally in this writable workspace, not in that global prefix. |
| Workspace write probe and ACL inspection | Write succeeded; current sandbox identities have Modify access. There was no node_modules or lockfile to be held open by an ApexTrade process. Running Node processes belonged to Codex and Adobe; none was stopped. |
| User npm-cache inspection | Access denied. This is a separate filesystem restriction, not evidence of cache corruption. Permissions were not changed. |
| `npm.cmd install --cache .runtime/npm-cache --fetch-retries=0 --fetch-timeout=15000` | Exit 1: socket/request `EACCES` fetching `https://registry.npmjs.org/@eslint%2feslintrc`. A writable cache does not resolve the network denial. |
| Direct Node `https.get('https://registry.npmjs.org/next')` | `EACCES` independently of npm. This isolates the package-download blocker to outbound HTTPS access in this restricted execution session, rather than an npm package lock or installation directory. The exact host firewall/policy rule cannot be inspected here. |
| `Get-Service com.docker.service` | Stopped, Manual. No Docker Desktop/backend process was found. |
| `Start-Service com.docker.service` | Failed: `Cannot open com.docker.service service on computer '.'`. Service remained stopped. No escalation or startup-type modification attempted. |
| `Get-Service postgresql-x64-18` | Running, Automatic. Existing PostgreSQL 18.6 binaries available in `C:/Program Files/PostgreSQL/18/bin`. This corrects the earlier assumption that no PostgreSQL service was available. |
| `pg_isready.exe -h 127.0.0.1 -p 5432 -t 3` | Exit 0: accepting connections. No credentials for that existing instance were supplied; its databases were not modified. |
| Raw TCP connection to 127.0.0.1:5432 | Connected. A later reset followed the probe without a PostgreSQL handshake; protocol readiness was separately confirmed with pg_isready. Local TCP is not globally blocked. |
| `./scripts/local-postgres.ps1` | Tried a separate real PostgreSQL 18 cluster in ignored `.runtime/pgdata`, using a random local password and port 55432. `initdb` completed and generated the cluster. `pg_ctl` startup failed: `could not create restricted token: error code 87`, then `could not start server: error code 3`. Script exited 1. The cluster is not running; app/test databases were not created. |
| `Get-NetTCPConnection` | Access denied; no attempt to alter system inspection permissions. |
| Browser tool `cua.getState()` | `{"apps":[],"browsers":[]}`. No connected browser for UI verification. |

### Fresh verification commands

`node scripts/verify.mjs` ran every listed npm script and exited 1 overall. Individual output and exit codes are recorded locally in ignored `.runtime/verification.json`.

| Command | Exit | Result |
|---|---:|---|
| `npm run test:core` | 0 | **3 passed, 0 failed, 0 skipped** |
| `npm run typecheck` | 1 | Blocked: tsc not installed |
| `npm run lint` | 1 | Blocked: eslint not installed |
| `npm run build` | 1 | Blocked: prisma not installed |
| `npm run db:migrate` | 1 | Blocked: prisma not installed; no migration applied |
| `npm run db:seed` | 1 | Blocked: tsx not installed; demo account not seeded |
| `npm run test:unit` | 1 | Blocked: vitest not installed; not a failed assertion |
| `npm run test:integration` | 1 | Blocked: vitest not installed; no PostgreSQL trading tests executed |
| `npm run test:e2e` | 1 | Blocked: playwright not installed; no browser trading tests executed |
| `npm.cmd run dev` | 1 | Blocked: next not installed; no website running on port 3000 |
| `docker compose config --quiet` | 0 | Configuration parses; warns user Docker config cannot be read. Does not prove daemon connectivity. |

### Changes and next environment requirements

- Added project `.npmrc` pointing npm's cache at writable `.runtime/npm-cache`; package-lock generation remains enabled. This fixes the default cache location only, not network policy. No lockfile can be truthfully generated until dependency resolution succeeds. When present, preserve it and use `npm ci`.
- Added `scripts/local-postgres.ps1`, an optional Docker-free, isolated PostgreSQL setup/start/stop/status helper. It never changes the existing Windows service, overwrites an existing `.env` on initialization, or deletes partial clusters. It was attempted and **did not successfully start PostgreSQL in this sandbox**. It can be retried from an authorized normal local shell; Windows security restrictions must not be weakened to make it work.
- The attempted helper created ignored `.env` and `.runtime/pg-password` with generated local credentials. These target port 55432, which is currently unavailable. It does not reuse or reveal credentials for the running service on 5432. No secrets are stored in tracked source files.
- Added `scripts/verify.mjs` to capture per-command results without treating missing tools as passes.
- To proceed: use an execution session with permitted npm/Prisma download access, an authorized development PostgreSQL connection plus separate `_test` database (or successfully start the isolated cluster), and a connected browser. The existing service on 5432 needs an authorized database/role configuration supplied by its owner; no password guessing was attempted.

All Phase 4 browser checks remain unresolved: login, five-share purchase, definitive order ID/status, fees/cash/holdings, equity, invalid-trade immutability, partial sale/realized P&L, persistence, user isolation, and repeated-key idempotency. The source core tests pass, but they do not establish those database/browser outcomes. **No deployment or reachable website has been verified.**
