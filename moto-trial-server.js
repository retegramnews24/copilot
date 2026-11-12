import {COURSE_VERSION, makeCourse, ground} from './public/moto-trial/physics.js';

import {CAMPAIGN_LENGTH} from './public/moto-trial/courses.js';

const boundsFor = course => {
  const xs = course.tiers.flatMap(tier => tier.points.map(p => p.x));
  return {min: Math.min(...xs), max: Math.max(...xs), bottom: course.bottom};
};
const campaigns = new Map([6, 7, COURSE_VERSION].map(version => [version, Array.from({length: CAMPAIGN_LENGTH}, (_, i) => {
  const course = makeCourse(i + 1, version);
  return {course, bounds: boundsFor(course)};
})]));
const LIMIT = 8, EMPTY_GRACE = 60_000;
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const modes = new Set(['ready', 'ride', 'paused', 'crash', 'offCourse', 'finish']);

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
    return this.sockets().map(({member: {id, name, color, pose, stage, complete}}) => ({id, name, color, pose, stage, complete}));
  }

  state(room) {
    return {room: room.room, number: room.number, seed: room.seed, courseVersion: room.courseVersion ?? 1, courseName: room.courseName, campaign: !!room.campaign, players: this.players()};
  }

  summary(room) {
    const players = this.players().map(({id, name}) => ({id, name}));
    return {room: room.room, number: room.number, game: 'moto-trial', phase: 'playing',
      players, online: players.length, courseName: room.courseName, capacity: LIMIT, expires: null, created: room.created, revision: room.revision};
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
        room = {room: id, number, seed, courseName: 'Campagna Moto Trial', courseVersion: COURSE_VERSION, campaign: true,
          created: Date.now(), revision: 0, bounds: boundsFor(course)};
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
      const progress = room.campaign && await this.ctx.storage.get('progress:' + user.player);
      socket.serializeAttachment({kind: 'moto-trial', expires:Number(req.headers.get('X-Session-Expires')), accessTag: req.headers.get('X-Access-Tag'),
        id: user.player, name: user.name.slice(0, 45), color, pose: previous?.member.pose ?? null,
        stage: room.campaign ? progress?.stage ?? 1 : undefined, complete: !!progress?.complete, seq: 0, sentAt: 0});
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

  message(socket, message) {
    return this.ctx.blockConcurrencyWhile(async () => {
      if (typeof message !== 'string' || message.length > 420) return;
      const member = socket.deserializeAttachment(), now = Date.now();
      if (!member || member.closed || now - member.sentAt < 60) return;
      let packet;
      try { packet = JSON.parse(message); } catch { return; }
      if (packet?.type !== 'pose' || !Number.isSafeInteger(packet.seq) || packet.seq <= member.seq) return;
      this.room ??= await this.ctx.storage.get('moto-trial');
      if (!this.room) return;
      const campaign = this.room.campaign, stage = member.stage;
      if (campaign && (packet.courseId !== stage || member.complete)) return;
      const circuit = campaign ? campaigns.get(this.room.courseVersion)[stage - 1] : null;
      const pose = readPose(packet, circuit?.bounds ?? this.room.bounds);
      if (!pose) return;
      let progress;
      if (campaign) {
        const {course} = circuit, last = course.tiers.at(-1);
        pose.courseId = stage;
        if (pose.mode === 'finish') {
          const pastGate = (pose.x - course.finish) * last.direction;
          const finishY = ground(last, pose.x) ?? ground(last, course.finish);
          const nearGate = course.version >= 8 ? Math.abs(pastGate) < .5 : pastGate >= -.001 && pastGate <= 6.4;
          if (packet.tier !== course.tiers.length - 1 || !nearGate ||
              Math.abs(pose.y - finishY) > 3.05) return;
          progress = {stage: Math.min(CAMPAIGN_LENGTH, stage + 1), complete: stage === CAMPAIGN_LENGTH};
          await this.ctx.storage.put('progress:' + member.id, progress);
        }
      }
      socket.serializeAttachment({...member, ...progress, pose, seq: packet.seq, sentAt: now});
      this.broadcast({type: 'pose', id: member.id, pose}, socket);
      if (progress) this.broadcast({type: 'state', state: this.state(this.room)});
    });
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
      await this.ctx.storage.deleteAll();
    });
  }
}
