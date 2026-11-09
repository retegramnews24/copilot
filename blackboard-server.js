import {DEFAULT_SIZE, ERASER, validStroke} from './public/blackboard/chalk.js';
import {normalizeAppearance} from './public/appearance.js';

const TAG = 'blackboard';
const DEFAULT_ROOM = '1';
const WORDS = ('aquilone astronauta balena bicicletta binocolo bussola cactus castello ' +
  'cavatappi chitarra coccodrillo corona dinosauro elefante elicottero farfalla faro ' +
  'fiammifero formica forbici fungo giraffa guanto igloo isola lampadario lanterna ' +
  'lavatrice lumaca lucchetto marionetta mongolfiera mummia mulino ombrello orologio ' +
  'panda paracadute pappagallo pattino pinguino piramide pompiere ponte riccio robot ' +
  'ruota salvagente sottomarino spaventapasseri stella tamburo tartaruga telescopio ' +
  'tenda tornado trattore treno unicorno violino vulcano zaino zanzara').split(' ');

function normalizeGuess(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it')
    .trim().replace(/^(?:l['’]\s*|(?:il|lo|la|un|uno|una)\s+)/, '').replace(/[.!?]+$/, '');
}

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
    const boardColumns = new Set(this.sql.exec('PRAGMA table_info(boards)').toArray().map(row => row.name));
    if (!boardColumns.has('owner')) this.sql.exec('ALTER TABLE boards ADD COLUMN owner TEXT');
    if (!boardColumns.has('deleted')) this.sql.exec('ALTER TABLE boards ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pictionary (room TEXT PRIMARY KEY, state TEXT NOT NULL)');
    this.sql.exec('INSERT OR IGNORE INTO boards (number) VALUES (1)');
    for (const socket of ctx.getWebSockets(TAG)) {
      const peer = socket.deserializeAttachment();
      if (peer && peer.legacy === undefined) socket.serializeAttachment({...peer, legacy:true, room:DEFAULT_ROOM});
    }
  }

  getRoom(room) {
    if (typeof room !== 'string' || !/^[1-9][0-9]{0,14}$/.test(room)) return null;
    return this.sql.exec('SELECT * FROM boards WHERE number = ? AND deleted = 0', Number(room)).toArray()[0] ?? null;
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
    const rooms = this.sql.exec('SELECT number FROM boards WHERE deleted = 0 ORDER BY number').toArray().map(({number}) => {
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
      const {number} = this.sql.exec('INSERT INTO boards (owner) VALUES (?) RETURNING number', user.player).one();
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
      canPlay:!legacy && query.get('pictionary') === '1',
      outfit:normalizeAppearance({shirt:query.get('shirt'), shorts:query.get('shorts')})
    });
    if (legacy) this.enter(socket, DEFAULT_ROOM, Number(query.get('since')));
    else this.directory(accessTag);
    return new Response(null, {status:101, webSocket:client, headers:{'Sec-WebSocket-Protocol':'checkmate'}});
  }

  enter(socket, room, since) {
    const peer = socket.deserializeAttachment();
    const entry = this.getRoom(room);
    if (!entry) return send(socket, peer.canPlay ? {type:'room-deleted', room} :
      {type:'room-error', message:'Sala non disponibile.'});
    const oldRoom = peer.room;
    peer.room = room;
    socket.serializeAttachment(peer);
    this.sendBoard(socket, entry, since, peer.canPlay ? this.game(room) : null);
    if (oldRoom !== room) {
      this.updatePeople(peer.accessTag, oldRoom);
      if (peer.canPlay) this.onPlayerLeft(peer.accessTag, oldRoom);
    }
    this.updatePeople(peer.accessTag, room);
    if (peer.canPlay) this.onPlayerLeft(peer.accessTag, room);
    this.directory(peer.accessTag);
  }

  sendBoard(socket, entry, since, game, reset = false) {
    const peer = socket.deserializeAttachment();
    const mode = game ? 'pictionary' : 'free';
    const epoch = game?.epoch ?? entry.epoch;
    const surface = game ? 'pictionary:' + peer.room : peer.room;
    if (!peer.legacy) send(socket, {type:'sync', room:peer.room, number:entry.number, epoch, mode,
      reset:reset || !!game, canDelete:!entry.owner || entry.owner === peer.player});
    if (peer.canPlay) this.sendGame(socket, game);
    let cursor = !reset && !game && Number.isSafeInteger(since) && since > epoch ? since : epoch;
    for (;;) {
      const rows = this.sql.exec(
        'SELECT seq, id, color, points, size FROM chalk WHERE room = ? AND seq > ? AND color >= 0 ORDER BY seq LIMIT 64',
        surface, cursor
      ).toArray();
      if (!rows.length) break;
      const strokes = rows.filter(row => !peer.legacy || row.color !== ERASER)
        .map(row => ({...row, points:JSON.parse(row.points)}));
      if (strokes.length) send(socket, {type:'history', strokes});
      cursor = rows.at(-1).seq;
    }
    send(socket, {type:'ready'});
  }

  game(room) {
    if (!room) return null;
    const row = this.sql.exec('SELECT state FROM pictionary WHERE room = ?', room).toArray()[0];
    return row ? JSON.parse(row.state) : null;
  }

  saveGame(room, game) {
    this.sql.exec('INSERT OR REPLACE INTO pictionary (room, state) VALUES (?, ?)', room, JSON.stringify(game));
  }

  gamePeers(accessTag, room, exclude) {
    return this.roomPeers(accessTag, room, exclude).filter(socket => socket.deserializeAttachment().canPlay);
  }

  gamePlayers(sockets) {
    return new Map(sockets.map(socket => {
      const {player, name} = socket.deserializeAttachment();
      return [player, name];
    }));
  }

  sendGame(socket, game) {
    const drawing = game?.drawer === socket.deserializeAttachment().player;
    send(socket, {type:'pictionary', game:game ? {
      turn:game.turn, round:game.round, drawerName:game.drawerName, drawing,
      word:drawing ? game.word : undefined,
      scores:Object.values(game.scores).sort((a, b) => b.points - a.points),
      result:game.result
    } : null});
  }

  resetChalk(surface, player) {
    const {seq} = this.sql.exec(
      "INSERT INTO chalk (player, id, color, points, room) VALUES (?, ?, -1, '[]', ?) RETURNING seq",
      player, crypto.randomUUID(), surface
    ).one();
    this.sql.exec('DELETE FROM chalk WHERE room = ? AND seq < ?', surface, seq);
    return seq;
  }

  nextTurn(room, player, sockets, previous, result) {
    const players = this.gamePlayers(sockets);
    const order = (previous?.order ?? []).filter(id => players.has(id));
    for (const id of players.keys()) if (!order.includes(id)) order.push(id);
    const lastIndex = previous?.order.indexOf(previous.drawer) ?? -1;
    const nextInOrder = previous && [...previous.order.slice(lastIndex + 1), ...previous.order.slice(0, lastIndex)]
      .find(id => players.has(id));
    const drawer = previous ? nextInOrder ?? order.find(id => id !== previous.drawer) : player;
    let used = previous?.used ?? [];
    if (used.length >= WORDS.length) used = [previous.word];
    const choices = WORDS.filter(word => !used.includes(word));
    const word = choices[Math.floor(Math.random() * choices.length)];
    const scores = previous?.scores ?? {};
    for (const [id, name] of players) scores[id] ??= {name, points:0};
    const game = {turn:(previous?.turn ?? 0) + 1, order, drawer, drawerName:players.get(drawer),
      word, used:[...used, word], scores, result};
    this.ctx.storage.transactionSync(() => {
      game.round = game.epoch = this.resetChalk('pictionary:' + room, player);
      this.saveGame(room, game);
    });
    for (const socket of sockets) {
      if (!previous) this.sendBoard(socket, this.getRoom(room), 0, game, true);
      else {
        send(socket, {type:'clear', mode:'pictionary', epoch:game.epoch});
        this.sendGame(socket, game);
      }
    }
  }

  endGame(room, sockets, message) {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM pictionary WHERE room = ?', room);
      this.sql.exec('DELETE FROM chalk WHERE room = ? AND color >= 0', 'pictionary:' + room);
    });
    const entry = this.getRoom(room);
    for (const socket of sockets) {
      this.sendBoard(socket, entry, 0, null, true);
      send(socket, {type:'pictionary-note', message});
    }
  }

  onPlayerLeft(accessTag, room, exclude) {
    const game = this.game(room);
    if (!game) return;
    const sockets = this.gamePeers(accessTag, room, exclude);
    const players = this.gamePlayers(sockets);
    if (players.size < 2) {
      this.endGame(room, sockets, 'Pictionary terminato. Servono almeno due giocatori.');
    } else if (!players.has(game.drawer)) {
      this.nextTurn(room, game.drawer, sockets, game, game.drawerName + ' ha lasciato il turno.');
    }
  }

  play(socket, peer, command, game) {
    const {room, player, name, accessTag} = peer;
    const sockets = this.gamePeers(accessTag, room);
    if (command.type === 'pictionary-start') {
      if (game) return;
      if (this.gamePlayers(sockets).size < 2) {
        return send(socket, {type:'pictionary-note', message:'Servono almeno due persone nella sala.'});
      }
      return this.nextTurn(room, player, sockets, null, '');
    }
    if (!game || command.round !== game.round) return;
    if (command.type === 'pictionary-stop') return this.endGame(room, sockets, 'Pictionary terminato.');
    if (command.type === 'pictionary-skip' && player === game.drawer) {
      return this.nextTurn(room, player, sockets, game, 'Parola saltata: ' + game.word + '.');
    }
    if (command.type !== 'pictionary-guess' || player === game.drawer ||
        typeof command.guess !== 'string' || !command.guess.trim() || command.guess.length > 60) return;
    if (normalizeGuess(command.guess) !== game.word) {
      return send(socket, {type:'pictionary-note', message:'Riprova!', round:game.round});
    }
    game.scores[player] ??= {name, points:0};
    game.scores[player].points++;
    this.nextTurn(room, player, sockets, game, name + ' ha indovinato: ' + game.word + '.');
  }

  deleteRoom(socket, peer, entry) {
    const {room, player, accessTag} = peer;
    if (entry.owner && entry.owner !== player) {
      return send(socket, {type:'room-delete-error', message:'Solo chi ha creato la sala può eliminarla.'});
    }
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('UPDATE boards SET deleted = 1 WHERE number = ?', entry.number);
      this.sql.exec('DELETE FROM pictionary WHERE room = ?', room);
      this.resetChalk(room, player);
      // Keep sequence markers so new chalk strokes never reuse a live cursor.
      this.sql.exec('DELETE FROM chalk WHERE room IN (?, ?) AND color >= 0', room, 'pictionary:' + room);
    });
    for (const client of this.roomPeers(accessTag, room)) {
      const attached = client.deserializeAttachment();
      client.serializeAttachment({...attached, room:null});
      if (attached.canPlay) send(client, {type:'room-deleted', room});
      else if (attached.legacy) client.close(4001, 'Lavagna eliminata');
      else send(client, {type:'room-error', message:'Lavagna eliminata.'});
    }
    this.directory(accessTag);
  }

  leave(socket) {
    const peer = socket.deserializeAttachment();
    if (!peer.room) return;
    const room = peer.room;
    peer.room = null;
    socket.serializeAttachment(peer);
    this.updatePeople(peer.accessTag, room);
    if (peer.canPlay) this.onPlayerLeft(peer.accessTag, room);
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
    if (peer.canPlay && command?.type === 'room-delete' && command.room === peer.room) {
      try { this.deleteRoom(socket, peer, room); }
      catch { send(socket, {type:'room-delete-error', message:'Eliminazione non riuscita. Riprova.'}); }
      return;
    }
    const {player, accessTag} = peer;
    const activeGame = this.game(peer.room);
    const game = peer.canPlay ? activeGame : null;
    if (peer.canPlay && typeof command?.type === 'string' && command.type.startsWith('pictionary-')) {
      return this.play(socket, peer, command, game);
    }
    const mode = game ? 'pictionary' : 'free';
    const surface = game ? 'pictionary:' + peer.room : peer.room;
    const boardEpoch = game?.epoch ?? room.epoch;
    const epoch = peer.legacy && boardEpoch === 0 ? 0 : command?.epoch;
    const canEdit = (command?.mode ?? 'free') === mode && (!game || game.drawer === player) && epoch === boardEpoch;
    const peers = () => this.roomPeers(accessTag, peer.room)
      .filter(client => !activeGame || !!client.deserializeAttachment().canPlay === !!game);
    if (command?.type === 'clear' && !peer.legacy) {
      if (!canEdit) return send(socket, {type:'clear-error'});
      try {
        const next = this.ctx.storage.transactionSync(() => {
          const seq = this.resetChalk(surface, player);
          if (game) {
            game.epoch = seq;
            this.saveGame(peer.room, game);
          } else this.sql.exec('UPDATE boards SET epoch = ? WHERE number = ?', seq, room.number);
          return seq;
        });
        for (const client of peers()) {
          if (client.deserializeAttachment().legacy) client.close(4001, 'Riapri la Mini App');
          else send(client, {type:'clear', mode, epoch:next});
        }
      } catch {
        send(socket, {type:'clear-error'});
      }
      return;
    }
    if (command?.type !== 'stroke' || !validStroke(command)) return;
    const {id, color, points, size = DEFAULT_SIZE} = command;
    if (!canEdit) return send(socket, {type:'rejected', id});
    try {
      const rows = this.sql.exec(
        'INSERT INTO chalk (player, id, color, points, room, size) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(player,id) DO NOTHING RETURNING seq',
        player, id, color, JSON.stringify(points), surface, size
      ).toArray();
      if (!rows.length) return send(socket, {type:'ack', id});
      const packet = {type:'stroke', seq:rows[0].seq, id, color, points, size};
      for (const client of peers()) {
        if (color !== ERASER || !client.deserializeAttachment().legacy) send(client, packet);
      }
    } catch {
      send(socket, {type:'rejected', id});
    }
  }

  close(socket) {
    const peer = socket.deserializeAttachment();
    this.updatePeople(peer?.accessTag, peer?.room, socket);
    if (peer?.canPlay) this.onPlayerLeft(peer.accessTag, peer.room, socket);
    this.directory(peer?.accessTag, socket);
    try { socket.close(1000, 'Lavagna chiusa'); } catch {}
  }
}
