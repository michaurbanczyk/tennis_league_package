import handler from 'vinext/server/fetch-handler';
import { LeagueUpdates } from './realtime-room.mjs';

export { LeagueUpdates };

const worker = {
  fetch(request: Request, env: { LEAGUE_UPDATES: DurableObjectNamespace }, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/api/league/live') {
      if (request.method !== 'GET') return new Response(null, { status: 405 });
      const origin = request.headers.get('Origin');
      if (origin && origin !== new URL(request.url).origin)
        return new Response('Forbidden', { status: 403 });
      const room = env.LEAGUE_UPDATES.get(env.LEAGUE_UPDATES.idFromName('main'));
      return room.fetch(new Request('https://league-updates.internal/connect', request));
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
