// F1 on paper! online: one race per Durable Object ("f1:<room>"). The creator draws the track in the game and
// opens the race with the number of drivers wanted; the others join from the Lobby or the bell notice.
// The server keeps the race and checks every move with the same rules as the game (public/gara/rules.js):
// placing the cars on the line one at a time, then rounds where everybody chooses at the same moment and all the
// cars move together once the last one has chosen. Who does not choose in time is driven by the autopilot, so the
// race never stops. The clients replay the move list, so every phone shows the same race.
import * as R from './public/gara/rules.js';
import { distField } from './public/gara/ai.js';
import { internalHeaders, failure } from './worker-shared.js';

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const F1_MAX = 8;
const WAIT = 1800000, // a race nobody joins closes after 30 minutes
  KEEP = 300000, // a finished race stays 5 minutes
  TURN = 60000, // time for one move (or placing the car), then the autopilot plays it
  MAX_MOVES = 3000,
  MAX_POINTS = 12000;
// Chi non chiede lo stato da AWAY (o ha abbandonato) è assente: per lui guida subito il pilota automatico,
// lasciando GAP ai telefoni per animare il giro prima, invece di far aspettare un minuto a ogni giro.
export const AWAY = 20000,
  GAP = 3000;
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
  if (!outer || !inner || !normal || outer.length + inner.length > MAX_POINTS)
    throw Error('Pista non valida.');
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

// Moves of car i in a round played together (as against the AI): it cannot stop where a car stands still after a crash.
export function roundOpts(race, i) {
  const opts = R.roundOptions(race, i),
    car = race.cars[i];
  return opts.length
    ? opts
    : [{ x: car.pos.x + car.dir.x, y: car.pos.y + car.dir.y, gear: 1, crash: true, stop: { ...car.pos } }];
}
// Autopilot: the safest move that gets closest to the line (distance field of the AI), never too fast.
// With i: the move of car i in a round together; without: the car whose turn it is.
export function autoMove(race, i) {
  let opts = i === undefined ? R.options(race) : roundOpts(race, i);
  const car = race.cars[i === undefined ? race.turn : i];
  if (!opts.length)
    return { x: car.pos.x + car.dir.x, y: car.pos.y + car.dir.y, gear: 1, crash: true, stop: { ...car.pos } };
  const F = distField(race.track),
    d = o => F.D.get(o.x + ',' + o.y) ?? 1e9;
  const safe = opts.filter(o => !o.crash);
  if (!safe.length) return opts[0];
  return safe
    .slice()
    .sort(
      (a, b) => d(a) + (a.gear > 4 ? 3 * (a.gear - 4) : 0) - (d(b) + (b.gear > 4 ? 3 * (b.gear - 4) : 0))
    )[0];
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
  m.seats = [...m.players.filter(p => p.id !== m.owner), m.players.find(p => p.id === m.owner)].map(
    p => p.id
  );
  m.race = R.newRace(track, m.laps, m.seats.length);
  m.race.track = null;
  m.phase = 'place';
  m.turnAt = now + TURN;
  m.revision++;
}
const seatOf = (m, player) => m.seats.indexOf(player);
// cars that must choose in this round (not stopped after a crash)
const active = race => race.cars.map((c, i) => (c.crash ? -1 : i)).filter(i => i >= 0);
// The round is played: every car moves at the same moment, with the move chosen (or the autopilot's).
// One entry {kind:'round', moves:[per car, null if stopped], auto:[per car]}: every phone replays the same round.
function playRound(m, race) {
  const entry = {
    kind: 'round',
    moves: race.cars.map((c, i) => {
      const o = c.crash ? null : m.pending[i];
      return o && { x: o.x, y: o.y, gear: o.gear, crash: !!o.crash, stop: { ...o.stop } };
    }),
    auto: m.picked.map(a => a === 'auto')
  };
  R.applyRound(race, entry.moves);
  m.moves.push(entry);
  // rounds driven only by the autopilot: when nobody plays any more (three rounds), the race ends
  m.idle = m.picked.some(a => a === 'me') ? 0 : (m.idle || 0) + 1;
  m.pending = race.cars.map(() => null);
  m.picked = race.cars.map(() => null);
}
// One action of a player, or of the autopilot when the time runs out: {x, y}.
// On the line the cars go one at a time, in order. In the race everybody chooses at the same time (nobody sees
// the others' choice) and the cars move together when the last one has chosen, as in the game against the AI.
export function playRace(m, player, action, now, track, auto = false) {
  if (m.phase !== 'place' && m.phase !== 'race') throw Error('La gara non è in corso.');
  const race = { ...m.race, track },
    before = m.moves.length;
  let entry;
  if (m.phase === 'place') {
    if (!auto && seatOf(m, player) !== race.turn) throw Error('Non tocca a te.');
    const p = auto ? autoPlace(race) : point(action);
    if (!p) throw Error('Casella non valida.');
    const car = race.turn,
      r = R.placeCar(race, p);
    if (r.error) throw Error(r.error);
    entry = { kind: 'place', car, x: p.x, y: p.y };
    if (auto) entry.auto = true;
    m.moves.push(entry);
    if (race.phase === 'race') {
      m.phase = 'race';
      m.pending = race.cars.map(() => null);
      m.picked = race.cars.map(() => null);
    }
  } else {
    if (auto) {
      for (const i of active(race))
        if (!m.pending[i]) {
          m.pending[i] = autoMove(race, i);
          m.picked[i] = 'auto';
        }
    } else {
      const i = seatOf(m, player);
      if (i < 0) throw Error('Non sei in questa gara.');
      if (race.cars[i].crash) throw Error('Sei fermo per l’urto: questo giro lo salti.');
      if (m.pending[i]) throw Error('Hai già scelto: aspettiamo gli altri.');
      const p = point(action),
        opt = p && roundOpts(race, i).find(o => o.x === p.x && o.y === p.y);
      if (!opt) throw Error('Mossa non valida.');
      m.pending[i] = opt;
      m.picked[i] = 'me';
    }
    entry = { kind: 'chosen' };
    // the last one has chosen: everybody moves (rounds where every car is stopped go by at once)
    for (let guard = 0; guard < 8 && race.phase === 'race' && active(race).every(i => m.pending[i]); guard++)
      playRound(m, race);
  }
  race.track = null;
  m.race = race;
  const abandoned = m.phase === 'race' && (m.idle || 0) >= 3;
  if (race.phase === 'over' || m.moves.length >= MAX_MOVES || abandoned) {
    m.phase = 'finished';
    m.finished = now;
    m.turnAt = null;
    m.abandoned = race.phase !== 'over';
    const id = race.phase === 'over' && race.winner != null ? m.seats[race.winner] : null;
    // chi ha abbandonato non vince, anche se il pilota automatico arriva primo con la sua auto
    m.winners = id && !m.gone?.includes(id) ? m.players.filter(p => p.id === id) : [];
  } else if (m.moves.length > before) m.turnAt = now + TURN; // a new car on the line or a new round: one more minute
  if (m.moves.length > before) m.movedAt = now;
  m.revision++;
  return entry;
}
// Abbandono a gara partita: da qui in poi la sua auto la guida il pilota automatico, senza aspettarlo
export function abandonRace(m, player) {
  if (m.phase !== 'place' && m.phase !== 'race') throw Error('La gara non è in corso.');
  if (!m.seats.includes(player)) throw Error('Non sei in questa gara.');
  if (m.gone?.includes(player)) return false;
  m.gone = [...(m.gone || []), player];
  m.revision++;
  return true;
}
// The autopilot can play now: every car still owed belongs to someone away (and the phones had GAP to animate)
function owedByAway(m, now, away) {
  if (now < (m.movedAt || 0) + GAP) return false;
  if (m.phase === 'place') return away(m.seats[m.race.turn]);
  if (m.phase !== 'race' || !m.pending) return false;
  const owed = active(m.race).filter(i => !m.pending[i]);
  return owed.length > 0 && owed.every(i => away(m.seats[i]));
}
// What the phones see: who has already chosen in this round, never which move (nobody can copy the others).
export function publicRace(m) {
  const { pending, picked, ...rest } = m;
  return { ...rest, chosen: pending ? pending.map(Boolean) : null };
}
// The first seat still to choose (the "tocca a te" of the Lobby), or the car on the line.
export const raceTurn = m =>
  m.phase === 'race' && m.pending
    ? Math.max(
        0,
        m.pending.findIndex((p, i) => !p && !m.race.cars[i].crash)
      )
    : m.race
      ? m.race.turn
      : 0;
// Moves the autopilot owes (turns run out, or only absent drivers left to choose). Returns true when something changed.
// away(id): that driver is not there (no state request for AWAY, or abandoned).
export function advanceRace(m, now, track, away = () => false) {
  let changed = false;
  for (
    let guard = 0;
    guard < 40 && (m.phase === 'place' || m.phase === 'race') && m.turnAt && now >= m.turnAt;
    guard++
  ) {
    playRace(m, null, null, m.turnAt, track, true);
    changed = true;
  }
  if ((m.phase === 'place' || m.phase === 'race') && owedByAway(m, now, away)) {
    playRace(m, null, null, now, track, true);
    changed = true;
  }
  return changed;
}

export class F1Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.track = null;
    // when each driver last asked for the state (in memory: after a restart everybody counts from now)
    this.seen = new Map();
    this.boot = Date.now();
  }
  away(m, now) {
    return id => !!m.gone?.includes(id) || now - (this.seen.get(id) ?? this.boot) >= AWAY;
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
      turn: raceTurn(m),
      players: (m.seats.length ? m.seats.map(id => m.players.find(p => p.id === id)) : m.players).map(
        ({ id, name }) => ({ id, name })
      ),
      expires: null
    };
  }
  // with the internal key: the Lobby takes results only from another object of the server (worker-shared.js)
  async lobby(path, body) {
    return this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch(
      'https://internal/lobby/' + path,
      {
        method: 'POST',
        headers: await internalHeaders(this.env),
        body: JSON.stringify(body)
      }
    );
  }
  async loadTrack() {
    if (!this.track) this.track = await this.ctx.storage.get('f1-track');
    return this.track;
  }
  async save(m) {
    await this.ctx.storage.put('f1', m);
    const next =
      m.phase === 'waiting' ? m.created + WAIT : m.phase === 'finished' ? m.finished + KEEP : m.turnAt;
    await this.ctx.storage.setAlarm(next);
  }
  async update(m) {
    if (m.phase === 'finished' && m.winners.length) {
      const saved = await this.lobby('result', {
        key: m.room + ':f1',
        game: 'f1',
        mode: 'people',
        winners: m.winners
      });
      if (!saved.ok) console.error('F1: result not recorded by the Lobby', m.room, saved.status);
    }
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
          return json({ state: publicRace(m), summary: this.summary(m), now });
        }
        if (!m) return json({ error: 'Gara chiusa.' }, 404);
        const track = await this.loadTrack();
        if (m.players.some(p => p.id === user.player)) this.seen.set(user.player, now);
        const away = this.away(m, now);
        if (advanceRace(m, now, track, away)) {
          await this.save(m);
          await this.update(m);
        }
        if (action === 'track' && req.method === 'GET') return json({ track });
        if (action === 'state' && req.method === 'GET')
          return json(
            url.searchParams.get('after') === String(m.revision) ? { now } : { state: publicRace(m), now }
          );
        if (req.method !== 'POST') return json({ error: 'Operazione non disponibile.' }, 405);
        const raw = await req.text();
        if (raw.length > 512) return json({ error: 'Richiesta troppo grande.' }, 413);
        const body = raw ? JSON.parse(raw) : {};
        if (action === 'close') {
          if (!m.players.some(p => p.id === user.player))
            return json({ error: 'Solo i piloti possono chiudere la gara.' }, 403);
          // in attesa e in gara la chiude chi l'ha creata; se lui non c'è più, anche gli altri piloti
          if (m.phase !== 'finished' && user.player !== m.owner && !away(m.owner))
            return json(
              {
                error:
                  m.phase === 'waiting'
                    ? 'La chiude chi l’ha creata: tu puoi uscire.'
                    : 'La gara è in corso: la chiude solo chi l’ha creata.'
              },
              403
            );
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
        else if (action === 'abandon') changed = abandonRace(m, user.player);
        else return json({ error: 'Operazione non disponibile.' }, 404);
        if (changed) {
          await this.save(m);
          await this.update(m);
        }
        return json({ state: publicRace(m), now });
      } catch (error) {
        return failure(error, 409, 'f1');
      }
    });
  }
  alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {
      const m = await this.ctx.storage.get('f1');
      if (!m) return;
      const now = Date.now();
      if (
        (m.phase === 'waiting' && now >= m.created + WAIT) ||
        (m.phase === 'finished' && now >= m.finished + KEEP)
      ) {
        await this.remove(m);
        return;
      }
      const track = await this.loadTrack();
      if (advanceRace(m, now, track, this.away(m, now))) {
        await this.save(m);
        await this.update(m);
      } else await this.save(m);
    });
  }
}
