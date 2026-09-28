import { DurableObject } from 'cloudflare:workers';

// D1 remains the source of truth. The room only tells browsers when to reread it.
export class LeagueUpdates extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/publish' && request.method === 'POST') {
      const revision = Number(await request.text());
      if (!Number.isSafeInteger(revision) || revision < 0)
        return new Response('Invalid revision', { status: 400 });
      const message = JSON.stringify({ type: 'changed', revision });
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(message);
        } catch {
          // The runtime will remove disconnected sockets.
        }
      }
      return new Response(null, { status: 204 });
    }
    if (
      url.pathname !== '/connect' ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    )
      return new Response('Expected WebSocket', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage() {
    // Clients do not write through this connection.
  }

  webSocketClose(socket, code, reason) {
    socket.close(code, reason);
  }
}
