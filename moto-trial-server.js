import {COURSE_VERSION, makeCourse} from './public/moto-trial/physics.js';

const LIMIT = 8, EMPTY_GRACE = 60_000;
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const modes = new Set(['ready', 'ride', 'paused', 'crash', 'finish']);

function readPose(packet, bounds) {
  const {x, y, angle, vx, facing, lean, roll, leftSpring = 0, rightSpring = 0, mode} = packet;
  if (![x, y, angle, vx, lean, roll, leftSpring, rightSpring].every(Number.isFinite) || !modes.has(mode) ||
      x < bounds.min - 60 || x > bounds.max + 60 || y < -70 || y > bounds.bottom + 1 ||
      Math.abs(angle) > 4 || Math.abs(vx) > 13.4 || Math.abs(lean) > 1 || Math.abs(roll) > 7 ||
      leftSpring < 0 || leftSpring > .26 || rightSpring < 0 || rightSpring > .26 ||
      (facing !== -1 && facing !== 1)) return null;
  return {x, y, angle, vx, facing, lean, roll, leftSpring, rightSpring, mode};
}

export class MotoTrialRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  sockets() {
    return this.ctx.getWebSockets('moto-trial')
      .map(socket => ({socket, member: socket.deserializeAttachment()}))
      .filter(({member}) => member && !member.closed);
  }

  players() {
    return this.sockets().map(({member: {id, name, color, pose}}) => ({id, name, color, pose}));
  }

  state(room) {
    return {room: room.room, number: room.number, seed: room.seed, courseVersion: room.courseVersion ?? 1, players: this.players()};
  }

  summary(room) {
    const players = this.players().map(({id, name}) => ({id, name}));
    return {room: room.room, number: room.number, game: 'moto-trial', phase: 'playing',
      players, online: players.length, capacity: LIMIT, expires: null, created: room.created, revision: room.revision};
  }

  broadcast(packet, except) {
    const data = JSON.stringify(packet);
    for (const {socket} of this.sockets()) if (socket !== except) {
      try { socket.send(data); } catch {}
    }
  }

  async lobby(room, action) {
    const lobby = this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1'));
    await lobby.fetch(new Request('https://internal/lobby/' + action, {
      method: 'POST', body: JSON.stringify(this.summary(room))
    }));
  }

  fetch(req) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(req.url).pathname;
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user?.player) return json({error: 'Accesso richiesto.'}, 401);
      let room = await this.ctx.storage.get('moto-trial');
      if (path === '/moto-trial/init' && req.method === 'POST' && !room) {
        const {room: id, number, seed} = await req.json(), course = makeCourse(seed);
        const points = course.tiers.flatMap(tier => tier.points.map(p => p.x));
        room = {room: id, number, seed, courseVersion: COURSE_VERSION, created: Date.now(), revision: 0,
          bounds: {min: Math.min(...points), max: Math.max(...points), bottom: course.bottom}};
        await this.ctx.storage.put('moto-trial', room);
        await this.ctx.storage.setAlarm(Date.now() + EMPTY_GRACE);
        return json({state: this.state(room), summary: this.summary(room)});
      }
      if (!room) return json({error: 'Questa corsa è terminata.'}, 404);
      if (path === '/moto-trial/state' && req.method === 'GET') return json({state: this.state(room)});
      if (path !== '/moto-trial/ws' || req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return json({error: 'WebSocket richiesto.'}, 426);
      }
      const peers = this.sockets(), previous = peers.find(({member}) => member.id === user.player);
      if (!previous && peers.length >= LIMIT) return json({error: 'Corsa al completo.'}, 409);
      const color = previous?.member.color ?? Array.from({length: LIMIT}, (_, i) => i)
        .find(i => peers.every(({member}) => member.color !== i));
      if (previous) {
        previous.socket.serializeAttachment({...previous.member, closed: true});
        previous.socket.close(4000, 'Corsa aperta in un’altra finestra');
      }
      const pair = new WebSocketPair(), socket = pair[1];
      this.ctx.acceptWebSocket(socket, ['moto-trial']);
      socket.serializeAttachment({kind: 'moto-trial', accessTag: req.headers.get('X-Access-Tag'),
        id: user.player, name: user.name.slice(0, 45), color, pose: previous?.member.pose ?? null, seq: 0, sentAt: 0});
      this.broadcast({type: 'state', state: this.state(room)});
      await this.ctx.storage.deleteAlarm();
      await this.updateLobby(room);
      return new Response(null, {status: 101, webSocket: pair[0], headers: {'Sec-WebSocket-Protocol': 'checkmate'}});
    });
  }

  async updateLobby(room) {
    room.revision++;
    await this.ctx.storage.put('moto-trial', room);
    await this.lobby(room, 'update');
  }

  async message(socket, message) {
    if (typeof message !== 'string' || message.length > 420) return;
    const member = socket.deserializeAttachment(), now = Date.now();
    if (!member || member.closed || now - member.sentAt < 60) return;
    let packet;
    try { packet = JSON.parse(message); } catch { return; }
    if (packet?.type !== 'pose' || !Number.isSafeInteger(packet.seq) || packet.seq <= member.seq) return;
    this.room ??= await this.ctx.storage.get('moto-trial');
    const pose = this.room && readPose(packet, this.room.bounds);
    if (!pose) return;
    const current = socket.deserializeAttachment();
    if (!current || current.closed || packet.seq <= current.seq || now - current.sentAt < 60) return;
    socket.serializeAttachment({...current, pose, seq: packet.seq, sentAt: now});
    this.broadcast({type: 'pose', id: member.id, pose}, socket);
  }

  close(socket) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const member = socket.deserializeAttachment();
      if (!member || member.closed) return;
      socket.serializeAttachment({...member, closed: true});
      const room = await this.ctx.storage.get('moto-trial');
      if (!room) return;
      const state = this.state(room);
      this.broadcast({type: 'state', state});
      if (!state.players.length) await this.ctx.storage.setAlarm(Date.now() + EMPTY_GRACE);
      await this.updateLobby(room);
    });
  }

  alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.ctx.storage.get('moto-trial');
      if (!room || this.sockets().length) return;
      await this.lobby(room, 'remove');
      await this.ctx.storage.delete('moto-trial');
    });
  }
}
