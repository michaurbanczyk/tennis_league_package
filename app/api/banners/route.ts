import { organizer } from '@/lib/organizer-session';
import { sponsorStorage } from '@/lib/sponsor-storage';
import { BANNER_MAX_BYTES, validateBanner, type BannerKind } from '@/lib/sponsor-banner';
export const dynamic = 'force-dynamic';
function kindOf(req: Request): BannerKind | null {
  const k = new URL(req.url).searchParams.get('kind');
  return k === 'header' || k === 'sponsors' ? k : null;
}
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
export async function GET(req: Request) {
  try {
    const kind = kindOf(req);
    if (!kind) return json({ error: 'Nieznany rodzaj banera.' }, 400);
    const KEY = 'banners/' + kind;
    const params = new URL(req.url).searchParams,
      store = sponsorStorage();
    if (!params.has('image')) {
      const o = await store.head(KEY);
      return json({
        version: o?.etag ?? '',
        custom: !!o && o.httpMetadata?.contentType !== 'application/json',
      });
    }
    const o = await store.get(KEY);
    if (!o || o.httpMetadata?.contentType === 'application/json')
      return json({ error: 'Brak własnego banera.' }, 404);
    const mime = o.httpMetadata?.contentType === 'image/png' ? 'image/png' : 'image/jpeg';
    return new Response(o.body, {
      headers: {
        ...headers,
        'Content-Type': mime,
        'Content-Length': String(o.size),
        ETag: o.httpEtag,
        ...(params.has('download')
          ? {
              'Content-Disposition': `attachment; filename="baner-${kind}.${mime === 'image/png' ? 'png' : 'jpg'}"`,
            }
          : {}),
      },
    });
  } catch (e) {
    console.error('sponsors read failed', e);
    return json({ error: 'Nie można teraz wczytać banera. Spróbuj ponownie.' }, 503);
  }
}
export async function POST(req: Request) {
  try {
    const kind = kindOf(req);
    if (!kind) return json({ error: 'Nieznany rodzaj banera.' }, 400);
    const KEY = 'banners/' + kind;
    if (
      req.headers.get('sec-fetch-site') === 'cross-site' ||
      (req.headers.has('origin') && req.headers.get('origin') !== new URL(req.url).origin)
    )
      return json({ error: 'Niedozwolone żądanie.' }, 403);
    if (!(await organizer(req)))
      return json({ error: 'Tylko organizator może zmieniać baner sponsorów.' }, 403);
    const expected = req.headers.get('x-banner-version');
    if (expected === null)
      return json({ error: 'Odśwież ustawienia banera i spróbuj ponownie.' }, 409);
    const reset = new URL(req.url).searchParams.get('reset') === '1';
    let payload: Uint8Array | string, mime: string;
    if (reset) {
      payload = '{"default":true}';
      mime = 'application/json';
    } else {
      if (Number(req.headers.get('content-length')) > BANNER_MAX_BYTES)
        return json({ error: 'Baner może mieć maksymalnie 2 MB.' }, 400);
      const reader = req.body?.getReader();
      if (!reader) return json({ error: 'Wybierz plik banera.' }, 400);
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > BANNER_MAX_BYTES) {
            await reader.cancel();
            return json({ error: 'Baner może mieć maksymalnie 2 MB.' }, 400);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      payload = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        payload.set(chunk, offset);
        offset += chunk.length;
      }
      mime = req.headers.get('content-type') || '';
      try {
        validateBanner(payload, mime, kind);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    }
    const saved = await sponsorStorage().put(KEY, payload, {
      httpMetadata: { contentType: mime },
      onlyIf: expected ? { etagMatches: expected } : { etagDoesNotMatch: '*' },
    });
    if (!saved)
      return json(
        { error: 'Inny organizator zmienił baner. Sprawdź aktualny baner i ponów zapis.' },
        409,
      );
    return json({ version: saved.etag, custom: !reset });
  } catch (e) {
    console.error('sponsors save failed', e);
    return json({ error: 'Nie udało się zapisać banera. Spróbuj ponownie.' }, 503);
  }
}
