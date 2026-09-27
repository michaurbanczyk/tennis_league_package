# Relaksmisja Tennis League

Standalone Next.js application for the Relaksmisja tennis finals. The frontend and API run through Vinext on Cloudflare Workers. Match and season data are stored in D1; banners and PDF announcements use R2.

## Local development

Requires Node.js 22.13 or newer and pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Set `ADMIN_CODE` in a local `.env` file for organizer login. The local D1 and R2 bindings are configured by `vite.config.ts`; local data is separate from production.

## Verify

```bash
pnpm check
pnpm test
pnpm build
```

The build produces a Cloudflare Worker in `dist/server` and client assets in `dist/client`.

## Deploy to Cloudflare

`wrangler.production.jsonc` targets the existing `rtl` Worker, its D1 database (`DB`), and R2 bucket (`BUCKET`). The Worker must have the `ADMIN_CODE` secret. The existing database must contain the schema from `drizzle/0000_equal_photon.sql`. Do not apply the initial schema to a populated database.

After verifying the Cloudflare account, resource IDs, and secret:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm deploy
```

For another Cloudflare account, replace the account, Worker, D1, and R2 identifiers in `wrangler.production.jsonc`, create those resources, apply the initial D1 schema to the new empty database, and set `ADMIN_CODE` as a Worker secret. `.openai/hosting.json` describes the existing Sites project and does not configure standalone Wrangler deployment.

The GitHub workflow `.github/workflows/deploy-rtl.yml` runs the checks and deploys on pushes to `main` or when manually dispatched. It expects `CLOUDFLARE_API_TOKEN` in the `prod` GitHub environment. Source control contains no production database contents, uploaded R2 objects, session tokens, or organizer secret.
