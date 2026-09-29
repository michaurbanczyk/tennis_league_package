import { sponsorStorage } from '@/lib/sponsor-storage';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    if (params.get('kind') !== 'sponsors') return json({ error: 'Nieznany rodzaj banera.' }, 400);
    const store = sponsorStorage();
    const key = 'banners/sponsors';
    if (!params.has('image')) {
      const object = await store.head(key);
      return json({
        version: object?.etag ?? '',
        custom: !!object && object.httpMetadata?.contentType !== 'application/json',
      });
    }
    const object = await store.get(key);
    if (!object || object.httpMetadata?.contentType === 'application/json')
      return json({ error: 'Brak własnego banera.' }, 404);
    const mime = object.httpMetadata?.contentType === 'image/png' ? 'image/png' : 'image/jpeg';
    return new Response(object.body, {
      headers: {
        ...headers,
        'Content-Type': mime,
        'Content-Length': String(object.size),
        ETag: object.httpEtag,
        ...(params.has('download')
          ? {
              'Content-Disposition': `attachment; filename="baner-sponsors.${mime === 'image/png' ? 'png' : 'jpg'}"`,
            }
          : {}),
      },
    });
  } catch (error) {
    console.error('sponsors read failed', error);
    return json({ error: 'Nie można teraz wczytać banera. Spróbuj ponownie.' }, 503);
  }
}
