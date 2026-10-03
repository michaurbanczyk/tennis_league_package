import { database } from '@/db/raw';

async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export async function sessionScope(req: Request) {
  const token = req.headers.get('cookie')?.match(/(?:^|; )tennis_session=([^;]+)/)?.[1];
  if (!token) return null;
  const row = await database()
    .prepare('SELECT scope FROM sessions WHERE token=? AND expires>?')
    .bind(await hash(token), Date.now())
    .first<{ scope: string }>();
  return row?.scope ?? null;
}
