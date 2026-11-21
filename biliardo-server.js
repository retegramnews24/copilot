// Biliardo online: una partita per Durable Object ("biliardo:<room>"), stesso schema di F1 on paper! (f1-server.js).
// Chi crea sceglie la specialità (palla 8, snooker, 5 birilli, boccette) e quanti giocatori (2, oppure 3 o 4 in due
// squadre che si alternano al tavolo); gli altri entrano dalla Lobby o dall'avviso, chi arriva dopo guarda.
// Il server tiene il tavolo e rifà ogni colpo con la stessa fisica e le stesse regole del gioco
// (public/biliardo/engine.js): la fisica usa solo + − × ÷ e radice quadrata, quindi dà lo stesso risultato
// al bit su ogni telefono. Ogni stato porta il tavolo prima del colpo, il colpo e il tavolo dopo:
// i telefoni rifanno il colpo per animarlo e poi prendono il tavolo del server.
// Chi non tira in tempo fa tirare il pilota automatico, così la partita non si ferma mai.
import * as E from './public/biliardo/engine.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const WAIT = 1800000, // una partita in cui non entra nessuno si chiude dopo 30 minuti
  KEEP = 300000, // una partita finita resta 5 minuti
  TURN = 60000, // tempo per un colpo, poi tira il pilota automatico
  MAX_SHOTS = 800;
export const BIL_VARIANTS = Object.keys(E.VARIANTS);
const { TARGETS, DEFAULT_TARGET, REDS } = E;

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const clone = (o) => JSON.parse(JSON.stringify(o));

export function makeMatch(room, number, user, now, body) {
  const variant = body?.variant;
  if (!BIL_VARIANTS.includes(variant)) throw Error('Specialità non valida.');
  const opts = {};
  if (TARGETS[variant]) opts.target = TARGETS[variant].includes(body.target) ? body.target : DEFAULT_TARGET[variant];
  if (variant === 'snooker') opts.reds = REDS.includes(body.reds) ? body.reds : 6;
  return {
    room,
    number,
    game: 'biliardo',
    variant,
    opts,
    seed: (body.seed >>> 0) || 1,
    phase: 'waiting',
    created: now,
    revision: 1,
    // 2 = uno contro uno; 3 = due contro uno; 4 = due contro due
    capacity: [2, 3, 4].includes(body.players) ? body.players : 2,
    ptr: [0, 0],
    owner: user.player,
    players: [{ id: user.player, name: String(user.name || 'Giocatore').slice(0, 40) }],
    seats: [],
    match: null,
    prev: null,
    last: null,
    n: 0,
    turnAt: null,
    finished: null,
    winners: [],
    idle: 0
  };
}
export function joinMatch(m, user) {
  if (m.players.some((p) => p.id === user.player)) return false;
  if (m.phase !== 'waiting') throw Error('La partita è già cominciata.');
  if (m.players.length >= m.capacity) throw Error('Partita al completo.');
  m.players.push({ id: user.player, name: String(user.name || 'Giocatore').slice(0, 40) });
  m.revision++;
  return true;
}
export function leaveMatch(m, player) {
  if (m.phase !== 'waiting') throw Error('La partita è già cominciata.');
  if (player === m.owner) throw Error('Chi ha creato la partita la chiude.');
  const before = m.players.length;
  m.players = m.players.filter((p) => p.id !== player);
  if (m.players.length === before) return false;
  m.revision++;
  return true;
}
// Partenza: chi comincia lo decide il seme (a caso, ma uguale per tutti)
export function startMatch(m, player, now) {
  if (m.phase !== 'waiting') throw Error('La partita è già cominciata.');
  if (player !== m.owner) throw Error('Solo chi ha creato la partita la fa partire.');
  if (m.players.length < 2) throw Error('Serve un avversario.');
  // posti nell'ordine di arrivo: squadre alternate (1° e 3° contro 2° e 4°)
  m.seats = m.players.slice(0, m.capacity).map((p) => p.id);
  m.ptr = [0, 0];
  const nameOf = (id) => m.players.find((p) => p.id === id).name;
  const names = [0, 1].map((side) => ({ name: E.teamName(E.teamSeats(m.seats, side).map(nameOf)) }));
  m.match = E.newGame(m.variant, names, { ...m.opts, seed: m.seed });
  E.setStarter(m.match, m.seed % 2);
  m.phase = 'playing';
  m.turnAt = now + TURN;
  m.revision++;
}

// Il colpo che arriva dal telefono: solo numeri, nei limiti
export function cleanShot(body) {
  const { dx, dz, speed, sy = 0, sx = 0, px, pz, qx, qz, call } = body || {};
  if (![dx, dz, speed, sy, sx].every(num)) throw Error('Colpo non valido.');
  const l = Math.sqrt(dx * dx + dz * dz);
  if (l < 0.5 || l > 1.5 || speed <= 0 || speed > 10 || Math.abs(sy) > 1 || Math.abs(sx) > 1) throw Error('Colpo non valido.');
  const s = { dx, dz, speed, sy, sx };
  if (px !== undefined || pz !== undefined) {
    if (!num(px) || !num(pz) || Math.abs(px) > 3 || Math.abs(pz) > 2) throw Error('Posizione non valida.');
    s.px = px;
    s.pz = pz;
  }
  // boccette: dove va il pallino nella bocciata d'acchito
  if (qx !== undefined || qz !== undefined) {
    if (!num(qx) || !num(qz) || Math.abs(qx) > 3 || Math.abs(qz) > 2) throw Error('Pallino non valido.');
    s.qx = qx;
    s.qz = qz;
  }
  // palla 8: la buca chiamata per la nera (0-5)
  if (call !== undefined) {
    if (!Number.isInteger(call) || call < 0 || call > 5) throw Error('Buca non valida.');
    s.call = call;
  }
  return s;
}

// chi deve tirare adesso (id del giocatore)
export const shooter = (m) => (m.match ? E.shooterId(m.seats, m.ptr || [0, 0], m.match.cur) : null);
export function playMatch(m, player, body, now, auto = false) {
  if (m.phase !== 'playing') throw Error('La partita non è in corso.');
  const g = m.match;
  m.ptr = m.ptr || [0, 0];
  if (!auto && !m.seats.includes(player)) throw Error('Stai guardando: non sei in questa partita.');
  if (!auto && shooter(m) !== player) throw Error('Non tocca a te.');
  let input;
  if (auto) input = E.autoShot(g);
  else {
    input = cleanShot(body);
    if (g.inHand && input.px !== undefined && !E.canPlace(g, input.px, input.pz)) throw Error('Lì la bilia non si può mettere.');
    if (!g.inHand) {
      delete input.px;
      delete input.pz;
    }
    if (input.qx !== undefined && !(g.acchito && E.canPlacePallino(g, input.qx, input.qz))) throw Error('Il pallino va messo oltre la linea di mezzeria.');
    if (input.call !== undefined && !E.onEight(g)) delete input.call;
  }
  const seat = g.cur,
    by = shooter(m);
  m.prev = clone(g);
  E.playShot(g, input);
  m.last = { seat, by, input, ...(auto ? { auto: true } : {}) };
  m.n++;
  // la squadra lascia il tavolo: la prossima volta tira il compagno successivo
  if (g.cur !== seat) m.ptr[seat] = (m.ptr[seat] || 0) + 1;
  // colpi del pilota automatico di fila: se nessuno gioca più (tre giri a testa) la partita finisce
  m.idle = auto ? m.idle + 1 : 0;
  const abandoned = m.idle >= 6;
  if (g.over || m.n >= MAX_SHOTS || abandoned) {
    m.phase = 'finished';
    m.finished = now;
    m.turnAt = null;
    m.abandoned = !g.over;
    // vince tutta la squadra
    const ids = g.over && g.winner >= 0 ? E.teamSeats(m.seats, g.winner) : [];
    m.winners = m.players.filter((p) => ids.includes(p.id));
  } else m.turnAt = now + TURN;
  m.revision++;
  return m.last;
}
export function advanceMatch(m, now) {
  let changed = false;
  for (let guard = 0; guard < 10 && m.phase === 'playing' && m.turnAt && now >= m.turnAt; guard++) {
    playMatch(m, null, null, m.turnAt, true);
    changed = true;
  }
  return changed;
}

export class BiliardoRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  summary(m) {
    const { room, number, game, phase, created, revision, capacity, variant } = m;
    return {
      room,
      number,
      game,
      variant,
      phase: phase === 'waiting' ? 'waiting' : phase === 'finished' ? 'finished' : 'playing',
      created,
      revision,
      capacity,
      // posto di chi tira (per il "Tocca a te" della campanella)
      turn: m.match ? Math.max(0, m.seats.indexOf(shooter(m))) : 0,
      players: (m.seats.length ? m.seats.map((id) => m.players.find((p) => p.id === id)) : m.players).map(({ id, name }) => ({ id, name })),
      expires: null
    };
  }
  async lobby(path, body) {
    return this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch('https://internal/lobby/' + path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  async save(m) {
    await this.ctx.storage.put('biliardo', m);
    const next = m.phase === 'waiting' ? m.created + WAIT : m.phase === 'finished' ? m.finished + KEEP : m.turnAt;
    await this.ctx.storage.setAlarm(next);
  }
  async update(m) {
    if (m.phase === 'finished' && m.winners.length)
      await this.lobby('result', { key: m.room + ':biliardo', game: 'biliardo', mode: 'people', winners: m.winners });
    await this.lobby('update', this.summary(m));
  }
  async remove(m) {
    const removed = await this.lobby('remove', { room: m.room });
    if (!removed.ok) throw Error('Impossibile chiudere la partita. Riprova.');
    await this.ctx.storage.deleteAll();
  }
  fetch(req) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user?.player) return json({ error: 'Accesso richiesto.' }, 401);
      const now = Date.now(),
        url = new URL(req.url),
        action = url.pathname.split('/').at(-1);
      let m = await this.ctx.storage.get('biliardo');
      try {
        if (action === 'init' && !m && req.method === 'POST') {
          const body = await req.json();
          m = makeMatch(body.room, body.number, user, now, body);
          await this.save(m);
          return json({ state: m, summary: this.summary(m), now });
        }
        if (!m) return json({ error: 'Partita chiusa.' }, 404);
        if (advanceMatch(m, now)) {
          await this.save(m);
          await this.update(m);
        }
        if (action === 'state' && req.method === 'GET')
          return json(url.searchParams.get('after') === String(m.revision) ? { now } : { state: m, now });
        if (req.method !== 'POST') return json({ error: 'Operazione non disponibile.' }, 405);
        const raw = await req.text();
        if (raw.length > 512) return json({ error: 'Richiesta troppo grande.' }, 413);
        const body = raw ? JSON.parse(raw) : {};
        if (action === 'close') {
          if (!m.players.some((p) => p.id === user.player)) return json({ error: 'Solo i giocatori possono chiudere la partita.' }, 403);
          if (m.phase === 'playing' && user.player !== m.owner)
            return json({ error: 'La partita è in corso: la chiude solo chi l’ha creata.' }, 403);
          await this.remove(m);
          return json({ ok: true });
        }
        let changed = true;
        if (action === 'join') {
          changed = joinMatch(m, user);
          // posti pieni: si parte da soli
          if (changed && m.players.length >= m.capacity) startMatch(m, m.owner, now);
        } else if (action === 'leave') changed = leaveMatch(m, user.player);
        else if (action === 'start') startMatch(m, user.player, now);
        else if (action === 'play') playMatch(m, user.player, body, now);
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
      const m = await this.ctx.storage.get('biliardo');
      if (!m) return;
      const now = Date.now();
      if ((m.phase === 'waiting' && now >= m.created + WAIT) || (m.phase === 'finished' && now >= m.finished + KEEP)) {
        await this.remove(m);
        return;
      }
      if (advanceMatch(m, now)) {
        await this.save(m);
        await this.update(m);
      } else await this.save(m);
    });
  }
}
