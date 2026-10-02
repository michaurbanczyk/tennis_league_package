# Backend migration handoff

Saved: 2026-09-30

## Decision

Build the replacement backend in **Python** with **PostgreSQL**. Hosting has not been chosen. A Cloudflare Worker is optional; a managed Python web service is another option. The existing Next.js frontend can remain on Cloudflare while its API moves.

## Current application

- Next.js frontend and API run through Vinext on Cloudflare Workers.
- D1 stores league boards, match rows, sessions, and login attempts. The schema is in `src/db/schema.ts`.
- `src/app/api/league/route.ts` is the main league API. It handles login, matches, scores, archives, and other actions in one large route.
- R2 stores banners and PDF announcements. A Durable Object sends live change notifications over WebSockets; D1 remains the source of truth.
- The board is largely JSON. Individual match rows have revisions, and stale edits receive HTTP 409. Preserve this concurrency behavior in the new backend.

## Direction discussed

- FastAPI is a candidate Python framework, not a final selection.
- Managed hosting for the API and PostgreSQL is a practical starting point; Render, Railway, and Cloud Run were discussed. Python Workers remain possible if its package support fits the chosen stack.
- The frontend could keep calling the same `/api/league` paths through a proxy during migration, or be updated to call a new API. Decide this before implementation.
- Keep existing API behavior while migrating features in stages. Plan data conversion from D1 JSON and match rows to PostgreSQL models, plus sessions, backups, R2 files, and live updates.

## Next step

Choose API hosting and PostgreSQL provider, then design the Python API contract and database models. Start with an inventory of current `/api/league` actions and a migration plan before changing production data.
