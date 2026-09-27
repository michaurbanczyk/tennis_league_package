import { env } from 'cloudflare:workers';
export function sponsorStorage() {
  if (!env.BUCKET) throw Error('Magazyn banerów jest chwilowo niedostępny.');
  return env.BUCKET;
}
