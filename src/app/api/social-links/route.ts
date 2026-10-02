import { organizer } from '@/lib/organizer-session';
import { sponsorStorage } from '@/lib/sponsor-storage';
import { EMPTY_SOCIAL_LINKS, normalizeSocialLinks } from '@/lib/social-links';

export const dynamic = 'force-dynamic';
const KEY = 'settings/social-links-v1.json';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

async function current() {
  const object = await sponsorStorage().get(KEY);
  return {
    version: object?.etag || '',
    links: object ? normalizeSocialLinks(await object.json()) : { ...EMPTY_SOCIAL_LINKS },
  };
}

export async function GET() {
  try {
    return json(await current());
  } catch (error) {
    console.error('social links read failed', error);
    return json({ error: 'Nie można teraz wczytać linków.' }, 503);
  }
}

export async function POST(req: Request) {
  try {
    if (
      req.headers.get('sec-fetch-site') === 'cross-site' ||
      (req.headers.has('origin') && req.headers.get('origin') !== new URL(req.url).origin)
    )
      return json({ error: 'Niedozwolone żądanie.' }, 403);
    if (!(await organizer(req)))
      return json({ error: 'Tylko organizator może zmieniać linki.' }, 403);
    const versionHeader = req.headers.get('x-social-links-version');
    if (!versionHeader) return json({ error: 'Odśwież ustawienia linków.' }, 409);
    const expected = versionHeader === 'new' ? '' : versionHeader;
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'Nieprawidłowe dane.' }, 400);
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: 'Adresy są zbyt długie.' }, 400);
    let links;
    try {
      links = normalizeSocialLinks(JSON.parse(raw));
    } catch (error) {
      return json({ error: (error as Error).message || 'Nieprawidłowe adresy.' }, 400);
    }
    const previous = await current();
    if (previous.version !== expected)
      return json({ error: 'Linki zostały zmienione. Odśwież ustawienia.' }, 409);
    const saved = await sponsorStorage().put(KEY, JSON.stringify(links), {
      httpMetadata: { contentType: 'application/json' },
      onlyIf: expected ? { etagMatches: expected } : { etagDoesNotMatch: '*' },
    });
    if (!saved) return json({ error: 'Linki zostały zmienione. Odśwież ustawienia.' }, 409);
    return json({ version: saved.etag, links });
  } catch (error) {
    console.error('social links save failed', error);
    return json({ error: 'Nie udało się zapisać linków. Spróbuj ponownie.' }, 503);
  }
}
