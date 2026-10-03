import { SITE_LEAGUE } from '@/lib/site-league';
import { publicMatch } from '@/lib/public-match';
import { levelScope, readLevelSlice } from '@/lib/league-slices';
import { sessionScope } from '@/lib/league-session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ levelId: string }> }) {
  try {
    const { levelId } = await params;
    const slice = await readLevelSlice(levelId);
    if (!slice) return Response.json({ error: 'Nie znaleziono drabinki.' }, { status: 404 });
    const access = levelScope(slice.level, await sessionScope(req));
    return Response.json(
      {
        theme: SITE_LEAGUE,
        season: slice.row.season,
        ...(slice.row.heroBanner ? { heroBanner: JSON.parse(slice.row.heroBanner) } : {}),
        finalsDates: slice.row.finalsDates ? JSON.parse(slice.row.finalsDates) : [],
        ...(slice.row.courtGroups ? { courtGroups: JSON.parse(slice.row.courtGroups) } : {}),
        level: {
          ...slice.level,
          matches: slice.level.matches.map((match) => ({
            ...publicMatch(match, access),
            matchRevision: slice.revisions.get(match.id) ?? 0,
          })),
        },
        revision: slice.row.revision,
        scope: access,
        serverTime: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store', 'X-League-Revision': String(slice.row.revision) } },
    );
  } catch (error) {
    console.error('draw read failed', error);
    return Response.json({ error: 'Nie udało się pobrać drabinki.' }, { status: 503 });
  }
}
