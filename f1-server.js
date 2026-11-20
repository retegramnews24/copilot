// F1 on paper! online: one race per Durable Object ("f1:<room>"). The creator draws the track in the game and
// opens the race with the number of drivers wanted; the others join from the Lobby or the bell notice.
// The server keeps the race and checks every move with the same rules as the game (public/gara/rules.js):
// placing the cars on the line, then one move each in turn. Who does not move in time is driven by the
// autopilot, so the race never stops. The clients replay the move list, so every phone shows the same race.
import * as R from './public/gara/rules.js';
import { distField } from './public/gara/ai.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const F1_MAX = 8;
const WAIT = 1800000, // a race nobody joins closes after 30 minutes
  KEEP = 300000, // a finished race stays 5 minutes
  TURN = 60000, // time for one move (or placing the car), then the autopilot plays it
  MAX_MOVES = 3000,
  MAX_POINTS = 12000;
const TIMES = ['day', 'sunset', 'night'];

const num = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5;
const point = p => (p && num(p.x) && num(p.y) ? { x: p.x, y: p.y } : null);
const poly = list => {
  if (!Array.isArray(list) || list.length < 12) return null;
  const out = list.map(point);
  return out.every(Boolean) ? out : null;
};

// The track sent by the creator: checked again here (borders, width, start line for all the cars, a full lap).
export function makeTrack(body) {
  const outer = poly(body?.outer),
    inner = poly(body?.inner),
    f = body?.finish,
    normal = point(body?.normal);
  if (!outer || !inner || !normal || outer.length + inner.length > MAX_POINTS) throw Error('Pista non valida.');
  const finish = {
    a: point(f?.a),
    b: point(f?.b),
    outerSeg: f?.outerSeg,
    innerSeg: f?.innerSeg
  };
  if (
    !finish.a ||
    !finish.b ||
    !Number.isInteger(finish.outerSeg) ||
    !Number.isInteger(finish.innerSeg) ||
    finish.outerSeg < 0 ||
    finish.outerSeg >= outer.length ||
    finish.innerSeg < 0 ||
    finish.innerSeg >= inner.length
  )
    throw Error('Linea di partenza non valida.');
  const players = body.players;
  if (!Number.isInteger(players) || players < 2 || players > F1_MAX)
    throw Error('Da 2 a ' + F1_MAX + ' piloti.');
  const nl = Math.hypot(normal.x, normal.y);
  if (nl < 0.5) throw Error('Verso di gara non valido.');
  const inside = R.checkInner(outer, inner, R.MIN_WIDTH);
  if (inside.error) throw Error(inside.error);
  const built = R.buildTrack(outer, inner, finish, { x: normal.x / nl, y: normal.y / nl }, players);
  if (built.error) throw Error(built.error);
  return built.track;
}

// Autopilot: the safest move that gets closest to the line (distance field of the AI), never too fast.
export function autoMove(race) {
  let opts = R.options(race);
  const car = race.cars[race.turn];
  if (!opts.length) return { x: car.pos.x + car.dir.x, y: car.pos.y + car.dir.y, gear: 1, crash: true, stop: { ...car.pos } };
  const F = distField(race.track),
    d = o => F.D.get(o.x + ',' + o.y) ?? 1e9;
  const safe = opts.filter(o => !o.crash);
  if (!safe.length) return opts[0];
  return safe
    .slice()
    .sort((a, b) => d(a) + (a.gear > 4 ? 3 * (a.gear - 4) : 0) - (d(b) + (b.gear > 4 ? 3 * (b.gear - 4) : 0)))[0];
}
export function autoPlace(race) {
  const slots = R.placeable(race);
  if (!slots.length) return null;
  const F = distField(race.track),
    d = s => F.D.get(s.x + ',' + s.y) ?? 1e9;
  return slots.slice().sort((a, b) => d(a) - d(b))[0];
}

// --- the race (pure: used by the Durable Object and by the tests)
export function makeRace(room, number, user, now, body, track) {
  const laps = body.laps,
    time = TIMES.includes(body.time) ? body.time : 'day';
  if (!Number.isInteger(laps) || laps < 1 || laps > 9) throw Error('Da 1 a 9 giri.');
  return {
    room,
    number,
    game: 'f1',
    phase: 'waiting',
    created: now,
    revision: 1,
    capacity: track.players,
    laps,
    time,
    owner: user.player,
    players: [{ id: user.player, name: String(user.name || 'Pilota').slice(0, 40) }],
    seats: [],
    moves: [],
    race: null,
    turnAt: null,
    finished: null,
    winners: []
  };
}
export function joinRace(m, user) {
  if (m.players.some(p => p.id === user.player)) return false;
  if (m.phase !== 'waiting') throw Error('La gara è già partita.');
  if (m.players.length >= m.capacity) throw Error('Gara al completo.');
  m.players.push({ id: user.player, name: String(user.name || 'Pilota').slice(0, 40) });
  m.revision++;
  return true;
}
// A guest leaves the waiting room (the creator closes the race instead).
export function leaveRace(m, player) {
  if (m.phase !== 'waiting') throw Error('La gara è già partita.');
  if (player === m.owner) throw Error('Chi ha creato la gara la chiude.');
  const before = m.players.length;
  m.players = m.players.filter(p => p.id !== player);
  if (m.players.length === before) return false;
  m.revision++;
  return true;
}
// Start: the cars go on the line in order, the guests first and the creator last (like on the same phone).
export function startRace(m, player, now, track) {
  if (m.phase !== 'waiting') throw Error('La gara è già partita.');
  if (player !== m.owner) throw Error('Solo chi ha creato la gara la fa partire.');
  if (m.players.length < 2) throw Error('Serve almeno un altro pilota.');
  m.seats = [...m.players.filter(p => p.id !== m.owner), m.players.find(p => p.id === m.owner)].map(p => p.id);
  m.race = R.newRace(track, m.laps, m.seats.length);
  m.race.track = null;
  m.phase = 'place';
  m.turnAt = now + TURN;
  m.revision++;
}
const seatOf = (m, player) => m.seats.indexOf(player);
// One action of the player whose turn it is (or of the autopilot): {kind:'place'|'move', x, y}.
export function playRace(m, player, action, now, track, auto = false) {
  if (m.phase !== 'place' && m.phase !== 'race') throw Error('La gara non è in corso.');
  const race = { ...m.race, track };
  if (!auto && seatOf(m, player) !== race.turn) throw Error('Non tocca a te.');
  const car = race.turn;
  let entry;
  if (m.phase === 'place') {
    const p = auto ? autoPlace(race) : point(action);
    if (!p) throw Error('Casella non valida.');
    const r = R.placeCar(race, p);
    if (r.error) throw Error(r.error);
    entry = { kind: 'place', car, x: p.x, y: p.y };
  } else {
    let opt;
    if (auto) opt = autoMove(race);
    else {
      const p = point(action);
      let opts = R.options(race);
      const c = race.cars[race.turn];
      if (!opts.length) opts = [{ x: c.pos.x + c.dir.x, y: c.pos.y + c.dir.y, gear: 1, crash: true, stop: { ...c.pos } }];
      opt = p && opts.find(o => o.x === p.x && o.y === p.y);
      if (!opt) throw Error('Mossa non valida.');
    }
    R.applyMove(race, opt);
    entry = { kind: 'move', car, x: opt.x, y: opt.y, gear: opt.gear, crash: !!opt.crash, stop: { ...opt.stop } };
  }
  if (auto) entry.auto = true;
  // turns played by the autopilot in a row: when nobody is playing any more (three rounds), the race ends
  m.idle = auto ? (m.idle || 0) + 1 : 0;
  m.moves.push(entry);
  race.track = null;
  m.race = race;
  if (race.phase === 'race' && m.phase === 'place') m.phase = 'race';
  const abandoned = m.idle >= m.seats.length * 3 + 1;
  if (race.phase === 'over' || m.moves.length >= MAX_MOVES || abandoned) {
    m.phase = 'finished';
    m.finished = now;
    m.turnAt = null;
    m.abandoned = race.phase !== 'over';
    const id = race.phase === 'over' && race.winner != null ? m.seats[race.winner] : null;
    m.winners = id ? m.players.filter(p => p.id === id) : [];
  } else m.turnAt = now + TURN;
  m.revision++;
  return entry;
}
// Moves the autopilot owes (turns run out). Returns true when something changed.
export function advanceRace(m, now, track) {
  let changed = false;
  for (let guard = 0; guard < 40 && (m.phase === 'place' || m.phase === 'race') && m.turnAt && now >= m.turnAt; guard++) {
    playRace(m, null, null, m.turnAt, track, true);
    changed = true;
  }
  return changed;
}

export class F1Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.track = null;
  }
  summary(m) {
    const { room, number, game, phase, created, revision, capacity, laps } = m;
    return {
      room,
      number,
      game,
      phase: phase === 'waiting' ? 'waiting' : phase === 'finished' ? 'finished' : 'playing',
      created,
      revision,
      capacity,
      laps,
      turn: m.race ? m.race.turn : 0,
      players: (m.seats.length ? m.seats.map(id => m.players.find(p => p.id === id)) : m.players).map(
        ({ id, name }) => ({ id, name })
      ),
      expires: null
    };
  }
  async lobby(path, body) {
    return this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch('https://internal/lobby/' + path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  async loadTrack() {
    if (!this.track) this.track = await this.ctx.storage.get('f1-track');
    return this.track;
  }
  async save(m) {
    await this.ctx.storage.put('f1', m);
    const next = m.phase === 'waiting' ? m.created + WAIT : m.phase === 'finished' ? m.finished + KEEP : m.turnAt;
    await this.ctx.storage.setAlarm(next);
  }
  async update(m) {
    if (m.phase === 'finished' && m.winners.length)
      await this.lobby('result', { key: m.room + ':f1', game: 'f1', mode: 'people', winners: m.winners });
    await this.lobby('update', this.summary(m));
  }
  async remove(m) {
    const removed = await this.lobby('remove', { room: m.room });
    if (!removed.ok) throw Error('Impossibile chiudere la gara. Riprova.');
    await this.ctx.storage.deleteAll();
    this.track = null;
  }
  fetch(req) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user?.player) return json({ error: 'Accesso richiesto.' }, 401);
      const now = Date.now(),
        url = new URL(req.url),
        action = url.pathname.split('/').at(-1);
      let m = await this.ctx.storage.get('f1');
      try {
        if (action === 'init' && !m && req.method === 'POST') {
          const body = await req.json(),
            track = makeTrack(body.track);
          m = makeRace(body.room, body.number, user, now, body, track);
          await this.ctx.storage.put('f1-track', track);
          this.track = track;
          await this.save(m);
          return json({ state: m, summary: this.summary(m), now });
        }
        if (!m) return json({ error: 'Gara chiusa.' }, 404);
        const track = await this.loadTrack();
        if (advanceRace(m, now, track)) {
          await this.save(m);
          await this.update(m);
        }
        if (action === 'track' && req.method === 'GET') return json({ track });
        if (action === 'state' && req.method === 'GET')
          return json(url.searchParams.get('after') === String(m.revision) ? { now } : { state: m, now });
        if (req.method !== 'POST') return json({ error: 'Operazione non disponibile.' }, 405);
        const raw = await req.text();
        if (raw.length > 512) return json({ error: 'Richiesta troppo grande.' }, 413);
        const body = raw ? JSON.parse(raw) : {};
        if (action === 'close') {
          if (!m.players.some(p => p.id === user.player))
            return json({ error: 'Solo i piloti possono chiudere la gara.' }, 403);
          if (m.phase !== 'finished' && m.phase !== 'waiting' && user.player !== m.owner)
            return json({ error: 'La gara è in corso: la chiude solo chi l’ha creata.' }, 403);
          await this.remove(m);
          return json({ ok: true });
        }
        let changed = true;
        if (action === 'join') {
          changed = joinRace(m, user);
          // all the seats taken: the race starts by itself
          if (changed && m.players.length >= m.capacity) startRace(m, m.owner, now, track);
        } else if (action === 'leave') changed = leaveRace(m, user.player);
        else if (action === 'start') startRace(m, user.player, now, track);
        else if (action === 'play') playRace(m, user.player, body, now, track);
        else return json({ error: 'Operazione non disponibile.' }, 404);
        if (changed) {
          await this.save(m);
          await this.update(m);
        }
        return json({ state: m, now });
      } catch (error) {
        return json({ error: error.message }, 409);
      }
    });
  }
  alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {
      const m = await this.ctx.storage.get('f1');
      if (!m) return;
      const now = Date.now();
      if ((m.phase === 'waiting' && now >= m.created + WAIT) || (m.phase === 'finished' && now >= m.finished + KEEP)) {
        await this.remove(m);
        return;
      }
      const track = await this.loadTrack();
      if (advanceRace(m, now, track)) {
        await this.save(m);
        await this.update(m);
      } else await this.save(m);
    });
  }
}
