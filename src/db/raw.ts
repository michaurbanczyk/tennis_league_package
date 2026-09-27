import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw Error('Baza wyników jest chwilowo niedostępna.');
  return env.DB;
}
export function adminCode() {
  return (env as unknown as { ADMIN_CODE?: string }).ADMIN_CODE?.replace(
    /[\s-]/g,
    '',
  ).toUpperCase();
}
