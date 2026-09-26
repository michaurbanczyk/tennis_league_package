# SmartTenis Live

Public live tennis results for league finals. Organizers enter four players per level; the semifinal winners advance to a final and the losers to a third-place match. Spectators refresh every three seconds. The six specified league levels appear immediately with empty pairs; no sample results are published.

## Operation

The organizer unlocks the panel with `ADMIN_CODE`, supplied as a production secret. Each match has a generated 5-digit numeric code shown once. Codes can be rotated by the organizer, revoking existing match sessions. Code hashes, score history and session tokens are never exposed by the public results endpoint. Browser sessions use HttpOnly Secure cookies and expire after 12 hours.

Set the event year and one of its three seasons; configure level pairs, choose courts 1–5 and set match dates and times, hand match codes to players, update after each game, and confirm completed matches. Standard sets use a tie-break at 6–6 (enter its winner). The organizer selects either a full third set or a super tie-break to 10, entered point by point. Undo can reverse the last score or confirmation. A semifinal result cannot be changed after either placement match has started until all started placement matches are undone.

## Storage and concurrency

Cloudflare D1 stores the tournament, sessions and failed login counters. All score writes use optimistic revision checks; winner and loser advancement and score confirmation are one atomic board update. No automatic retries of score writes occur. Unauthenticated reads are public; every mutation validates its scope server-side. No real results or credentials are seeded by migrations.

## Verification

Run `node tests/league.mjs` to exercise real API handlers against isolated Miniflare D1. Covers unauthorized writes, invalid codes, per-match scope, spectator read-back, undo, finalist and bronze promotion, super tie-break advantage, session revocation and concurrent writes. TypeScript compilation and production build also checked. Browser preview inspected; demonstration controls exercised. WebMCP read tool is feature-detected; its browser validation was unavailable because the preview browser did not provide modelContext.

## Limits

One event per site, six fixed league levels. No retirement/walkover flow; only played best-of-three matches. Changes are synchronized by polling, not subsecond push. Organizer credentials are in deployment secrets and never committed. `.env.example` documents the variable for local work.

The season setting changes the event heading and preserves existing results. It does not create a new event or archive older seasons. Dates and allowed court numbers are validated on the server. Existing matches without dates remain compatible.

Match PINs are unique across all matches, generated with Web Crypto and collision checks. On the organizer’s next visit, legacy codes are replaced with five-digit PINs and the new list is shown for distribution; scores and currently signed-in players are preserved. New code creation and manual rotation also use five digits.
