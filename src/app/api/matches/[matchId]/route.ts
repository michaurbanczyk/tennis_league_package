import { SITE_LEAGUE } from '@/lib/site-league';
import { publicMatch } from '@/lib/public-match';
import { readMatchSlice, visibleScope } from '@/lib/league-slices';
import { sessionScope } from '@/lib/league-session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const slice = await readMatchSlice(matchId);
    if (!slice) return Response.json({ error: 'Nie znaleziono meczu.' }, { status: 404 });
    const access = visibleScope(slice.match, await sessionScope(req));
    return Response.json(
      {
        theme: SITE_LEAGUE,
        season: slice.row.season,
        ...(slice.row.heroBanner ? { heroBanner: JSON.parse(slice.row.heroBanner) } : {}),
        finalsDates: slice.row.finalsDates ? JSON.parse(slice.row.finalsDates) : [],
        ...(slice.row.courtGroups ? { courtGroups: JSON.parse(slice.row.courtGroups) } : {}),
        level: {
          id: slice.level.id,
          name: slice.level.name,
          format: slice.level.format,
          ...(slice.level.doubles !== undefined ? { doubles: slice.level.doubles } : {}),
        },
        match: { ...publicMatch(slice.match, access), matchRevision: slice.matchRevision },
        revision: slice.row.revision,
        scope: access,
        serverTime: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store', 'X-League-Revision': String(slice.row.revision) } },
    );
  } catch (error) {
    console.error('match read failed', error);
    return Response.json({ error: 'Nie udało się pobrać meczu.' }, { status: 503 });
  }
}
