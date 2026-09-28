import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw Error('Baza wyników jest chwilowo niedostępna.');
  return env.DB;
}
export function leagueUpdates() {
  const namespace = (env as unknown as { LEAGUE_UPDATES?: DurableObjectNamespace }).LEAGUE_UPDATES;
  if (!namespace) throw Error('Live update service is unavailable.');
  return namespace;
}
export function adminCode() {
  return (env as unknown as { ADMIN_CODE?: string }).ADMIN_CODE?.replace(
    /[\s-]/g,
    '',
  ).toUpperCase();
}
