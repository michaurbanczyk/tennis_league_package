# Tennis League

Standalone Next.js application for tennis finals. The frontend and API run through Vinext on Cloudflare Workers. Match and season data are stored in D1; banners and PDF announcements use R2.

Active matches also have records in `match_rows`. Each record has its own revision. Score requests send the selected match's revision, so edits to different matches can proceed concurrently; an outdated edit to the same match receives HTTP 409. The `boards` JSON remains the tournament snapshot used by brackets, archives, and backups. The page still polls for updates every three seconds; WebSockets are a separate change.

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

The build produces a Cloudflare Worker in `dist/server` and client assets in `dist/client`. It also adds the WebSocket entry and Durable Object module to the Worker bundle.

## Deploy to Cloudflare

`wrangler.production.jsonc` targets the `relaksmisja` Worker at `relaksmisja.rtlfinals.workers.dev` and its existing D1 database. `wrangler.development.jsonc` targets the `rtl` Worker at `rtl.rtlfinals.workers.dev` and D1 database `6311be03-b905-4f8e-9e9e-88a8ce36bbd6`. Both Workers use the `rtl-banners` R2 bucket, so banner uploads and deletions are shared. Each Worker needs its own `ADMIN_CODE` secret. The migration commands create the base D1 tables only if they are all absent, then create `match_rows` if needed. They refuse a partially initialized base schema. The GitHub workflow runs the appropriate migration before deployment.

Live league change notifications are sent through a hibernating Durable Object WebSocket at `/api/league/live`. D1 remains the source of truth; connected browsers fetch the current league after a notification. The first deployment of each Worker creates its own `LeagueUpdates` Durable Object namespace through its Wrangler migration. No extra D1 migration is needed for WebSockets.

After verifying the Cloudflare account, resource IDs, and secret:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm db:production:migrate
pnpm deploy
```

For a manual deployment of the `development` branch, run `pnpm db:development:migrate` and `pnpm deploy:development` after building. Set `ADMIN_CODE` on the `rtl` Worker before deploying it.

For another Cloudflare account, replace the account, Worker, D1, and R2 identifiers in `wrangler.production.jsonc`, create those resources, apply the initial D1 schema to the new empty database, and set `ADMIN_CODE` as a Worker secret. `.openai/hosting.json` describes the existing Sites project and does not configure standalone Wrangler deployment.

The GitHub workflow `.github/workflows/deploy-rtl.yml` runs the checks and deploys `main` to `relaksmisja` and `development` to `rtl` on pushes or when manually dispatched from either branch. It expects `CLOUDFLARE_API_TOKEN` in the `prod` GitHub environment. Source control contains no database contents, uploaded R2 objects, session tokens, or organizer secret.
