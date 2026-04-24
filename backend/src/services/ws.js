import { WebSocketServer } from 'ws';

let wss = null;

export function attachWs(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', data: { ts: new Date().toISOString() } }));
  });
}

export function broadcast(message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}
