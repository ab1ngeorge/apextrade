# Deployment

No service has been deployed from this environment. Complete the build and browser tests before using a deployment as a benchmark.

Suitable target: a Render Docker web service with a managed Render PostgreSQL instance (or another managed PostgreSQL provider). There are no external broker/payment dependencies.

1. Install dependencies in a network-enabled environment, review security advisories, generate and commit `package-lock.json`. Then change Docker's `npm install` to `npm ci` for reproducible release builds.
2. Run unit, integration and E2E against a dedicated `_test` database, plus typecheck/lint and production build. Review the rendered mobile/desktop UI. See README.
3. Create managed PostgreSQL, enable TLS and backups. Set DATABASE_URL using provider-supplied connection parameters and TLS settings. Use a dedicated database role; do not expose port 5432 publicly.
4. Build with the supplied Dockerfile. Run `npm run db:migrate` as a controlled release command before starting new replicas. Production startup is `npm start`; the image listens on port 3000. Configure the host to route its HTTPS domain to that port.
5. Set NODE_ENV=production and APP_ORIGIN to the exact public HTTPS origin. Do not set DEMO_EMAIL, DEMO_PASSWORD, or ENABLE_DEMO_SEED. Do not seed the development account in production. Create a simulator account through registration instead.
6. Verify HTTPS session cookies, origin checks, owner isolation, one 5-share virtual trade, order/execution records, cash reconciliation, logout/re-login, and persistence. Never connect a real brokerage account.
7. Monitor errors and database pool usage. Prune expired sessions and stale rate-limit rows with a controlled operational task. Set retention, log redaction and backup restoration procedures before expanding usage.

The initial Dockerfile includes build/dev dependencies because Prisma migration tooling is needed at release time. A smaller multi-stage runtime image and independent migration job are optional operational improvements. All Compose defaults are for localhost development; change local credentials and origin for hosted environments. The Compose database seed is intentionally performed from a development process, not an in-production backdoor.

Readiness requires database connectivity and successful migrations. Opening the root page alone does not establish backend health. Use an authenticated profile/portfolio read to validate the database and normal auth flow. Keep CI/test databases physically separate from production; the `_test` name guard alone is not an infrastructure security boundary.
