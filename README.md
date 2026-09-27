# Relaksmisja Tennis League

Standalone Next.js application for the Relaksmisja tennis finals. The frontend and API run through Vinext on Cloudflare Workers. Match and season data are stored in D1; banners and PDF announcements use R2.

## Project structure

```text
src/
  app/          App Router pages, layouts, styles, and API route handlers
  components/   Shared UI and tennis components
  db/           Database access and schema
  hooks/        React hooks
  lib/          League rules and shared helpers
public/         Static assets
drizzle/        Database migration
tests/          Project tests
scripts/        Local setup and build helpers
```

Configuration files stay at the project root. The `@/` import alias points to `src/`.

## Local development

Requires Node.js 22.13 or newer and pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
pnpm db:local:init
pnpm dev
```

Set `ADMIN_CODE` in a local `.env` file for organizer login, then restart the dev server after changing it. The code is case-insensitive, and spaces and hyphens are ignored. `db:local:init` creates the local D1 tables on the first run and is safe to run again. The local D1 and R2 bindings are configured by `vite.config.ts`; local data is separate from production.

## Verify

```bash
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

ESLint checks the source tree and skips generated build output. Prettier formats staged source and configuration files through the Husky pre-commit hook after `pnpm install`. Run `pnpm format` to format the repository's supported files; `pnpm format:check` checks them all. Some existing application lint findings are warnings until their underlying code is updated.

The build produces a Cloudflare Worker in `dist/server` and client assets in `dist/client`.

## Deploy to Cloudflare

`wrangler.production.jsonc` targets the existing `rtl` Worker, its D1 database (`DB`), and R2 bucket (`BUCKET`). The Worker must have the `ADMIN_CODE` secret. The existing database must contain the schema from `drizzle/0000_equal_photon.sql`. Do not apply the initial schema to a populated database.

After verifying the Cloudflare account, resource IDs, and secret:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm deploy
```

For another Cloudflare account, replace the account, Worker, D1, and R2 identifiers in `wrangler.production.jsonc`, create those resources, apply the initial D1 schema to the new empty database, and set `ADMIN_CODE` as a Worker secret. `.openai/hosting.json` describes the existing Sites project and does not configure standalone Wrangler deployment.

The GitHub workflow `.github/workflows/deploy-rtl.yml` runs the checks and deploys on pushes to `main` or when manually dispatched. It expects `CLOUDFLARE_API_TOKEN` in the `prod` GitHub environment. Source control contains no production database contents, uploaded R2 objects, session tokens, or organizer secret.
