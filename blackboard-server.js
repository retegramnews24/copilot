import {validStroke} from './public/blackboard/chalk.js';
import {normalizeAppearance} from './public/appearance.js';

const TAG = 'blackboard';

function send(socket, packet) {
  try { socket.send(JSON.stringify(packet)); } catch {}
}

export class Blackboard {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS chalk (
      seq INTEGER PRIMARY KEY, player TEXT NOT NULL, id TEXT NOT NULL,
      color INTEGER NOT NULL, points TEXT NOT NULL, UNIQUE(player, id)
    )`);
  }

  broadcast(packet, accessTag, exclude = null) {
    for (const socket of this.ctx.getWebSockets(TAG)) {
      if (socket !== exclude && socket.deserializeAttachment()?.accessTag === accessTag) send(socket, packet);
    }
  }

  presence(accessTag, exclude = null) {
    const people = new Map();
    for (const socket of this.ctx.getWebSockets(TAG)) {
      if (socket === exclude) continue;
      const peer = socket.deserializeAttachment();
      if (peer?.accessTag === accessTag) people.set(peer.player, {name:peer.name, outfit:peer.outfit});
    }
    this.broadcast({type:'people', people:[...people.values()]}, accessTag, exclude);
  }

  fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket richiesto', {status:426});
    }
    const user = JSON.parse(request.headers.get('X-Checkmate-User') || 'null');
    if (!user?.player) return new Response(null, {status:401});
    const query = new URL(request.url).searchParams;
    const since = Number(query.get('since'));
    let cursor = Number.isSafeInteger(since) && since > 0 ? since : 0;
    const accessTag = request.headers.get('X-Access-Tag');
    const {0:client, 1:socket} = new WebSocketPair();
    this.ctx.acceptWebSocket(socket, [TAG]);
    socket.serializeAttachment({
      kind:TAG, player:user.player, name:user.name.slice(0, 45), accessTag,
      outfit:normalizeAppearance({shirt:query.get('shirt'), shorts:query.get('shorts')})
    });
    for (;;) {
      const rows = this.sql.exec('SELECT seq, id, color, points FROM chalk WHERE seq > ? ORDER BY seq LIMIT 64', cursor).toArray();
      if (!rows.length) break;
      send(socket, {type:'history', strokes:rows.map(row => ({...row, points:JSON.parse(row.points)}))});
      cursor = rows.at(-1).seq;
    }
    send(socket, {type:'ready'});
    this.presence(accessTag);
    return new Response(null, {status:101, webSocket:client, headers:{'Sec-WebSocket-Protocol':'checkmate'}});
  }

  message(socket, raw) {
    if (typeof raw !== 'string' || raw.length > 1600) return;
    let stroke;
    try { stroke = JSON.parse(raw); } catch { return; }
    if (stroke?.type !== 'stroke' || !validStroke(stroke)) return;
    const {player, accessTag} = socket.deserializeAttachment();
    const {id, color, points} = stroke;
    try {
      const rows = this.sql.exec(
        'INSERT INTO chalk (player, id, color, points) VALUES (?, ?, ?, ?) ON CONFLICT(player,id) DO NOTHING RETURNING seq',
        player, id, color, JSON.stringify(points)
      ).toArray();
      if (rows.length) this.broadcast({type:'stroke', seq:rows[0].seq, id, color, points}, accessTag);
      else send(socket, {type:'ack', id});
    } catch {
      send(socket, {type:'rejected', id});
    }
  }

  close(socket) {
    this.presence(socket.deserializeAttachment()?.accessTag, socket);
    try { socket.close(1000, 'Lavagna chiusa'); } catch {}
  }
}
