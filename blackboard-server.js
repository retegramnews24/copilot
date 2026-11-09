import {DEFAULT_SIZE, ERASER, validStroke} from './public/blackboard/chalk.js';
import {normalizeAppearance} from './public/appearance.js';

const TAG = 'blackboard';
const DEFAULT_ROOM = '1';

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
    const columns = new Set(this.sql.exec('PRAGMA table_info(chalk)').toArray().map(row => row.name));
    if (!columns.has('room')) this.sql.exec("ALTER TABLE chalk ADD COLUMN room TEXT NOT NULL DEFAULT '1'");
    if (!columns.has('size')) this.sql.exec(`ALTER TABLE chalk ADD COLUMN size INTEGER NOT NULL DEFAULT ${DEFAULT_SIZE}`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS chalk_room_seq ON chalk (room, seq)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS boards (
      number INTEGER PRIMARY KEY, epoch INTEGER NOT NULL DEFAULT 0
    )`);
    this.sql.exec('INSERT OR IGNORE INTO boards (number) VALUES (1)');
    for (const socket of ctx.getWebSockets(TAG)) {
      const peer = socket.deserializeAttachment();
      if (peer && peer.legacy === undefined) socket.serializeAttachment({...peer, legacy:true, room:DEFAULT_ROOM});
    }
  }

  getRoom(room) {
    if (typeof room !== 'string' || !/^[1-9][0-9]{0,14}$/.test(room)) return null;
    return this.sql.exec('SELECT * FROM boards WHERE number = ?', Number(room)).toArray()[0] ?? null;
  }

  peers(accessTag, exclude = null) {
    return this.ctx.getWebSockets(TAG).filter(socket =>
      socket !== exclude && socket.deserializeAttachment()?.accessTag === accessTag);
  }

  people(peers) {
    return [...new Map(peers.map(socket => {
      const peer = socket.deserializeAttachment();
      return [peer.player, {name:peer.name, outfit:peer.outfit}];
    })).values()];
  }

  roomPeers(accessTag, room, exclude) {
    return this.peers(accessTag, exclude).filter(socket => socket.deserializeAttachment().room === room);
  }

  updatePeople(accessTag, room, exclude = null) {
    if (!room) return;
    const peers = this.roomPeers(accessTag, room, exclude);
    const packet = {type:'people', people:this.people(peers)};
    for (const socket of peers) send(socket, packet);
  }

  directory(accessTag, exclude = null) {
    const peers = this.peers(accessTag, exclude);
    const rooms = this.sql.exec('SELECT number FROM boards ORDER BY number').toArray().map(({number}) => {
      const room = String(number);
      return {id:room, number, people:this.people(peers.filter(socket => socket.deserializeAttachment().room === room))};
    });
    for (const socket of peers) {
      if (!socket.deserializeAttachment().legacy) send(socket, {type:'rooms', rooms});
    }
  }

  fetch(request) {
    const accessTag = request.headers.get('X-Access-Tag');
    const user = JSON.parse(request.headers.get('X-Checkmate-User') || 'null');
    if (!user?.player) return new Response(null, {status:401});
    if (request.method === 'POST' && new URL(request.url).pathname === '/blackboard/create') {
      const {number} = this.sql.exec('INSERT INTO boards DEFAULT VALUES RETURNING number').one();
      this.directory(accessTag);
      return Response.json({id:String(number), number});
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket richiesto', {status:426});
    }
    const query = new URL(request.url).searchParams;
    const legacy = query.get('directory') !== '1';
    const {0:client, 1:socket} = new WebSocketPair();
    this.ctx.acceptWebSocket(socket, [TAG]);
    socket.serializeAttachment({
      kind:TAG, player:user.player, name:user.name.slice(0, 45), accessTag, legacy, room:null,
      outfit:normalizeAppearance({shirt:query.get('shirt'), shorts:query.get('shorts')})
    });
    if (legacy) this.enter(socket, DEFAULT_ROOM, Number(query.get('since')));
    else this.directory(accessTag);
    return new Response(null, {status:101, webSocket:client, headers:{'Sec-WebSocket-Protocol':'checkmate'}});
  }

  enter(socket, room, since) {
    const entry = this.getRoom(room);
    if (!entry) return send(socket, {type:'room-error', message:'Sala non disponibile.'});
    const peer = socket.deserializeAttachment();
    const oldRoom = peer.room;
    peer.room = room;
    socket.serializeAttachment(peer);
    if (!peer.legacy) send(socket, {type:'sync', room, number:entry.number, epoch:entry.epoch});
    let cursor = Number.isSafeInteger(since) && since > entry.epoch ? since : entry.epoch;
    for (;;) {
      const rows = this.sql.exec(
        'SELECT seq, id, color, points, size FROM chalk WHERE room = ? AND seq > ? AND color >= 0 ORDER BY seq LIMIT 64',
        room, cursor
      ).toArray();
      if (!rows.length) break;
      const strokes = rows.filter(row => !peer.legacy || row.color !== ERASER)
        .map(row => ({...row, points:JSON.parse(row.points)}));
      if (strokes.length) send(socket, {type:'history', strokes});
      cursor = rows.at(-1).seq;
    }
    send(socket, {type:'ready'});
    if (oldRoom !== room) this.updatePeople(peer.accessTag, oldRoom);
    this.updatePeople(peer.accessTag, room);
    this.directory(peer.accessTag);
  }

  leave(socket) {
    const peer = socket.deserializeAttachment();
    if (!peer.room) return;
    const room = peer.room;
    peer.room = null;
    socket.serializeAttachment(peer);
    this.updatePeople(peer.accessTag, room);
    this.directory(peer.accessTag);
  }

  message(socket, raw) {
    if (typeof raw !== 'string' || raw.length > 1600) return;
    let command;
    try { command = JSON.parse(raw); } catch { return; }
    const peer = socket.deserializeAttachment();
    if (!peer.legacy && command?.type === 'enter') return this.enter(socket, command.room, command.since);
    if (!peer.legacy && command?.type === 'leave') return this.leave(socket);
    const room = this.getRoom(peer.room);
    if (!room) return;
    const {player, accessTag} = peer;
    const epoch = peer.legacy && room.epoch === 0 ? 0 : command?.epoch;
    if (command?.type === 'clear' && !peer.legacy) {
      if (epoch !== room.epoch) return send(socket, {type:'clear-error'});
      try {
        const next = this.ctx.storage.transactionSync(() => {
          const {seq} = this.sql.exec(
            "INSERT INTO chalk (player, id, color, points, room) VALUES (?, ?, -1, '[]', ?) RETURNING seq",
            player, crypto.randomUUID(), peer.room
          ).one();
          this.sql.exec('UPDATE boards SET epoch = ? WHERE number = ?', seq, room.number);
          this.sql.exec('DELETE FROM chalk WHERE room = ? AND seq < ?', peer.room, seq);
          return seq;
        });
        for (const client of this.roomPeers(accessTag, peer.room)) {
          if (client.deserializeAttachment().legacy) client.close(4001, 'Riapri la Mini App');
          else send(client, {type:'clear', epoch:next});
        }
      } catch {
        send(socket, {type:'clear-error'});
      }
      return;
    }
    if (command?.type !== 'stroke' || !validStroke(command)) return;
    const {id, color, points, size = DEFAULT_SIZE} = command;
    if (epoch !== room.epoch) return send(socket, {type:'rejected', id});
    try {
      const rows = this.sql.exec(
        'INSERT INTO chalk (player, id, color, points, room, size) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(player,id) DO NOTHING RETURNING seq',
        player, id, color, JSON.stringify(points), peer.room, size
      ).toArray();
      if (!rows.length) return send(socket, {type:'ack', id});
      const packet = {type:'stroke', seq:rows[0].seq, id, color, points, size};
      for (const client of this.roomPeers(accessTag, peer.room)) {
        if (color !== ERASER || !client.deserializeAttachment().legacy) send(client, packet);
      }
    } catch {
      send(socket, {type:'rejected', id});
    }
  }

  close(socket) {
    const peer = socket.deserializeAttachment();
    this.updatePeople(peer?.accessTag, peer?.room, socket);
    this.directory(peer?.accessTag, socket);
    try { socket.close(1000, 'Lavagna chiusa'); } catch {}
  }
}
