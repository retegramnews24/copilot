// Biliardo online: una partita per Durable Object ("biliardo:<room>"), stesso schema di F1 on paper! (f1-server.js).
// Chi crea sceglie la specialità (palla 8, snooker, 5 birilli, boccette) e quanti giocatori (2, oppure 3 o 4 in due
// squadre che si alternano al tavolo); gli altri entrano dalla Lobby o dall'avviso, chi arriva dopo guarda.
// Il server tiene il tavolo e rifà ogni colpo con la stessa fisica e le stesse regole del gioco
// (public/biliardo/engine.js): la fisica usa solo + − × ÷ e radice quadrata, quindi dà lo stesso risultato
// al bit su ogni telefono. Ogni stato porta il tavolo prima del colpo, il colpo e il tavolo dopo:
// i telefoni rifanno il colpo per animarlo e poi prendono il tavolo del server.
// Chi non tira in tempo fa tirare il pilota automatico, così la partita non si ferma mai.
import * as E from './public/biliardo/engine.js';
import { internalHeaders } from './worker-shared.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const WAIT = 1800000, // una partita in cui non entra nessuno si chiude dopo 30 minuti
  KEEP = 300000, // una partita finita resta 5 minuti
  TURN = 60000, // tempo per un colpo, poi tira il pilota automatico
  MAX_SHOTS = 800;
// Chi non chiede lo stato da AWAY è assente: per lui tira subito il pilota automatico (lasciando GAP ai telefoni
// per animare il colpo prima), invece di far aspettare un minuto a ogni turno. Una squadra assente da FORFEIT,
// o che ha abbandonato, perde la partita se dall'altra parte c'è qualcuno.
export const AWAY = 20000,
  GAP = 6000,
  FORFEIT = 120000;
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
  // carambola: libera (0), a una sponda (1), a tre sponde (3)
  if (variant === 'carambola') opts.cush = E.CUSHIONS.includes(body.cush) ? body.cush : 3;
  // il panno è della partita: lo sceglie chi la crea e tutti (giocatori e spettatori) lo vedono uguale
  opts.cloth = E.CLOTH_KEYS.includes(body.cloth) ? body.cloth : 'verde';
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
    // 2 = uno contro uno; da 3 a 8 a squadre (fino a 4 per squadra, i compagni li scelgono i giocatori)
    capacity: Number.isInteger(body.players) && body.players >= 2 && body.players <= 8 ? body.players : 2,
    ptr: [0, 0],
    owner: user.player,
    players: [{ id: user.player, name: String(user.name || 'Giocatore').slice(0, 40), team: 0 }],
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
  // entra nella squadra con meno giocatori (poi può cambiarla finché la partita non parte)
  const count = (t) => m.players.filter((p) => (p.team ?? 0) === t).length;
  m.players.push({ id: user.player, name: String(user.name || 'Giocatore').slice(0, 40), team: count(1) < count(0) ? 1 : 0 });
  m.revision++;
  return true;
}
// Scelta del compagno: prima della partenza ognuno può passare nell'altra squadra (al massimo 4 per squadra)
export function teamMatch(m, player, team) {
  if (m.phase !== 'waiting') throw Error('La partita è già cominciata.');
  if (team !== 0 && team !== 1) throw Error('Squadra non valida.');
  const me = m.players.find((p) => p.id === player);
  if (!me) throw Error('Non sei in questa partita.');
  if ((me.team ?? 0) === team) return false;
  if (m.players.filter((p) => (p.team ?? 0) === team).length >= E.MAX_TEAM) throw Error('Quella squadra è al completo.');
  me.team = team;
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
  // squadre scelte dai giocatori; l'ordine dei compagni è quello di arrivo e resta fisso per tutta la partita
  const players = m.players.slice(0, m.capacity);
  const teams = [0, 1].map((t) => players.filter((p) => (p.team ?? 0) === t).map((p) => p.id));
  if (!teams[0].length || !teams[1].length) throw Error('Servono giocatori in tutte e due le squadre.');
  m.teams = teams;
  m.seats = players.map((p) => p.id);
  m.ptr = [0, 0];
  const nameOf = (id) => m.players.find((p) => p.id === id).name;
  const names = [0, 1].map((side) => ({ name: E.teamName(m.teams[side].map(nameOf)) }));
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
export const shooter = (m) => (m.match ? E.shooterOf(m, m.match.cur) : null);
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
  m.shotAt = now;
  // turni obbligati tra compagni: palla 8, palla 9 e boccette a ogni colpo; le altre specialità quando la
  // squadra lascia il tavolo. Il prossimo a tirare per quella squadra è sempre il compagno successivo.
  if (E.EVERY_SHOT.includes(m.variant) || g.cur !== seat) m.ptr[seat] = (m.ptr[seat] || 0) + 1;
  // colpi del pilota automatico di fila: se nessuno gioca più (tre giri a testa) la partita finisce
  m.idle = auto ? m.idle + 1 : 0;
  const abandoned = m.idle >= 6;
  if (g.over || m.n >= MAX_SHOTS || abandoned) {
    m.phase = 'finished';
    m.finished = now;
    m.turnAt = null;
    m.abandoned = !g.over;
    // vince tutta la squadra
    const ids = g.over && g.winner >= 0 ? E.teamOf(m, g.winner) : [];
    m.winners = m.players.filter((p) => ids.includes(p.id) && !m.gone?.includes(p.id));
  } else m.turnAt = now + TURN;
  m.revision++;
  return m.last;
}
// La squadra side ha perso a tavolino (abbandono o assenza lunga): vince l'altra, chi è rimasto
function forfeit(m, side, now) {
  const g = m.match,
    names = E.teamOf(m, side).map((id) => m.players.find((p) => p.id === id)?.name || '?');
  g.over = true;
  g.winner = 1 - side;
  g.msg = (names.length > 1 ? 'Hanno lasciato la partita: ' : 'Ha lasciato la partita: ') + names.join(', ');
  m.phase = 'finished';
  m.finished = now;
  m.turnAt = null;
  m.forfeit = true;
  m.winners = m.players.filter((p) => E.teamOf(m, 1 - side).includes(p.id) && !m.gone?.includes(p.id));
  m.revision++;
}
// absence(id): da quanti ms quel giocatore non si fa sentire (Infinity se ha abbandonato)
export function advanceMatch(m, now, absence = () => 0) {
  let changed = false;
  if (m.phase === 'playing') {
    const gone = (side) => E.teamOf(m, side).every((id) => absence(id) >= FORFEIT);
    const here = (side) => E.teamOf(m, side).some((id) => absence(id) < AWAY);
    for (const side of [0, 1])
      if (m.phase === 'playing' && gone(side) && here(1 - side)) {
        forfeit(m, side, now);
        return true;
      }
  }
  for (let guard = 0; guard < 10 && m.phase === 'playing' && m.turnAt && now >= m.turnAt; guard++) {
    playMatch(m, null, null, m.turnAt, true);
    changed = true;
  }
  // chi deve tirare è assente: tira subito il pilota automatico, un colpo alla volta
  if (m.phase === 'playing' && absence(shooter(m)) >= AWAY && now >= (m.shotAt || 0) + GAP) {
    playMatch(m, null, null, now, true);
    changed = true;
  }
  return changed;
}
// Abbandono durante la partita: da qui in poi tira il pilota automatico; se tutta la squadra ha lasciato, vince l'altra
export function abandonMatch(m, player, now) {
  if (m.phase !== 'playing') throw Error('La partita non è in corso.');
  if (!m.seats.includes(player)) throw Error('Non sei in questa partita.');
  m.gone = [...new Set([...(m.gone || []), player])];
  m.revision++;
  const side = [0, 1].find((s) => E.teamOf(m, s).includes(player));
  if (E.teamOf(m, side).every((id) => m.gone.includes(id))) forfeit(m, side, now);
}

export class BiliardoRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // quando ogni giocatore ha chiesto lo stato l'ultima volta (in memoria: dopo un riavvio si riparte da adesso)
    this.seen = new Map();
    this.boot = Date.now();
  }
  absence(m, now) {
    return (id) => (m.gone?.includes(id) ? Infinity : now - (this.seen.get(id) ?? this.boot));
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
      players: (m.seats.length ? m.seats.map((id) => m.players.find((p) => p.id === id)) : m.players).map(({ id, name, team }) => ({ id, name, team: team ?? 0 })),
      expires: null
    };
  }
  // con la chiave interna: la Lobby accetta i risultati solo da un altro oggetto del server (worker-shared.js)
  async lobby(path, body) {
    return this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch('https://internal/lobby/' + path, {
      method: 'POST',
      headers: await internalHeaders(this.env),
      body: JSON.stringify(body)
    });
  }
  async save(m) {
    await this.ctx.storage.put('biliardo', m);
    const next = m.phase === 'waiting' ? m.created + WAIT : m.phase === 'finished' ? m.finished + KEEP : m.turnAt;
    await this.ctx.storage.setAlarm(next);
  }
  async update(m) {
    if (m.phase === 'finished' && m.winners.length) {
      const saved = await this.lobby('result', { key: m.room + ':biliardo', game: 'biliardo', mode: 'people', winners: m.winners });
      if (!saved.ok) console.error('Biliardo: risultato non registrato dalla Lobby', m.room, saved.status);
    }
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
        if (m.players.some((p) => p.id === user.player)) this.seen.set(user.player, now);
        const absence = this.absence(m, now);
        if (advanceMatch(m, now, absence)) {
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
          // in attesa e in corso la chiude chi l'ha creata; se lui non c'è più, anche gli altri
          if (m.phase !== 'finished' && user.player !== m.owner && absence(m.owner) < AWAY)
            return json(
              { error: m.phase === 'waiting' ? 'La chiude chi l’ha creata: tu puoi uscire.' : 'La partita è in corso: la chiude solo chi l’ha creata.' },
              403
            );
          await this.remove(m);
          return json({ ok: true });
        }
        let changed = true;
        if (action === 'join') {
          changed = joinMatch(m, user);
          // posti pieni: si parte da soli
          if (changed && m.players.length >= m.capacity) startMatch(m, m.owner, now);
        } else if (action === 'leave') changed = leaveMatch(m, user.player);
        else if (action === 'team') changed = teamMatch(m, user.player, body.team);
        else if (action === 'start') startMatch(m, user.player, now);
        else if (action === 'play') playMatch(m, user.player, body, now);
        else if (action === 'abandon') abandonMatch(m, user.player, now);
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
      if (advanceMatch(m, now, this.absence(m, now))) {
        await this.save(m);
        await this.update(m);
      } else await this.save(m);
    });
  }
}
