import { leagueUpdates } from '@/db/raw';

export async function publishLeagueChange(revision: number) {
  try {
    // Legacy route test adapters replace raw.ts and do not run a Worker runtime.
    if (typeof leagueUpdates !== 'function') return;
    const namespace = leagueUpdates();
    const room = namespace.get(namespace.idFromName('main'));
    const response = await room.fetch('https://league-updates.internal/publish', {
      method: 'POST',
      body: String(revision),
    });
    if (!response.ok) throw Error(`WebSocket publish failed: ${response.status}`);
  } catch (error) {
    // A committed D1 write must still succeed if realtime delivery is unavailable.
    console.error('league update broadcast failed', error);
  }
}
