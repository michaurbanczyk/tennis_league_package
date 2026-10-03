import { scoreActions, type ScoreAction } from '@/lib/match-score-action';
import { scoreMatch } from '@/lib/score-match';
import { publishLeagueChange } from '@/lib/league-updates';
import { sessionScope } from '@/lib/league-session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    if (req.headers.get('sec-fetch-site') === 'cross-site')
      return Response.json({ error: 'Niedozwolone żądanie.' }, { status: 403 });
    if (!req.headers.get('content-type')?.includes('application/json'))
      return Response.json({ error: 'Nieprawidłowe dane.' }, { status: 400 });
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 12000) return Response.json({ error: 'Nieprawidłowe dane.' }, { status: 413 });
    const body: unknown = await req.json();
    const { matchId } = await params;
    if (
      !body ||
      typeof body !== 'object' ||
      !('action' in body) ||
      typeof body.action !== 'string' ||
      !scoreActions.has(body.action)
    )
      return Response.json({ error: 'Nieprawidłowa akcja meczu.' }, { status: 400 });
    const result = await scoreMatch(
      { ...(body as ScoreAction & { matchRevision: number }), matchId },
      () => sessionScope(req),
    );
    if (result.status === 200 && 'revision' in result.data)
      await publishLeagueChange(result.data.revision);
    return Response.json(result.data, {
      status: result.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(result.status === 200 && 'revision' in result.data
          ? { 'X-League-Revision': String(result.data.revision) }
          : {}),
      },
    });
  } catch (error) {
    console.error('match action failed', error);
    const userError = error instanceof Error && !/D1|SQL|binding/i.test(error.message);
    return Response.json(
      {
        error: userError
          ? error.message
          : 'Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.',
      },
      { status: userError ? 400 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
