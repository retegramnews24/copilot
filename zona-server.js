// Zona Operativa: la partita online sulla mappa del deserto (docs/zona-operativa.md). Il server decide tutto: muove
// i giocatori con le regole di public/zona/rules.js (le stesse del telefono), controlla i colpi tornando indietro nel
// tempo di quanto è in ritardo chi spara (al massimo 0,2 s), tiene salute, eliminazioni, rinascite, armi a terra e
// casse mediche, e il tempo della partita. Sempre a squadre, Rossa contro Blu, 4 contro 4: i posti che le persone
// lasciano vuoti li prendono i bot (zona-bots.js). Niente fuoco amico. Gira a 20 passi al secondo solo finché c'è
// qualcuno collegato; niente si salva: la partita vive in memoria (se la Durable Object si spegne, al primo messaggio
// si riparte).
// Nella stanza «poligono» (poligono di tiro condiviso) invece ci si vede soltanto: ognuno muove sé stesso e il server
// passa posizioni e spari agli altri.
import {
  PLAYER,
  WEAPONS,
  damage,
  rng,
  newGun,
  tickGun,
  tryFire,
  startReload,
  pelletDirs,
  makeWorld,
  newBody,
  moveStep,
  eyeHeight,
  lookDir,
  playerHit,
  spreadFor,
  fromBehind
} from './public/zona/rules.js';
import { BOXES, GROUND, POINTS } from './public/zona/map-deserto.js';
import { createNav, botThink, BOT_NAMES, BOT_WEAPONS, SPAWN_ROTATION } from './zona-bots.js';
import { userOf, json } from './worker-shared.js';
import { MSG } from './public/messages.js';

export const ZONA = {
  key: 'zona',
  tick: 50, // ms: 20 passi al secondo
  cmdDt: 1 / 60, // ogni comando del telefono vale 1/60 di secondo
  perTeam: 4, // 4 contro 4, al massimo 8 in tutto
  match: 300_000, // 5 minuti
  results: 10_000, // classifica a fine partita, poi se ne comincia un'altra
  respawn: 3_000,
  weaponBack: 20_000,
  medBack: 30_000,
  medHeal: 50,
  rewind: 200, // ms: il ritorno indietro per i colpi non va oltre
  history: 600,
  take: 1.4 // m: distanza per prendere un'arma a terra
};
// ordine delle armi nei messaggi (un numero al posto del nome)
export const ARMI = ['baretta', 'calabrone', 'tuono', 'ruggito', 'falco', 'coltello'];
// bit dei comandi
export const BIT = { jump: 1, crouch: 2, walk: 4, fire: 8, reload: 16, take: 32, scope: 64 };
// squadre: nei messaggi 0 = Blu, 1 = Rossa
export const TEAMS = ['blu', 'rossa'];

// Mappa per gli urti: le scatole delle case e i confini (map-deserto.js), uguale a quella del telefono.
export function desertWorld() {
  return makeWorld(BOXES, GROUND);
}

const points = prefix =>
  Object.entries(POINTS)
    .filter(([n]) => n.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, p]) => ({ name, ...p }));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, a, b) => (Number.isFinite(v) ? clamp(v, a, b) : 0);

export class ZonaRoom {
  // options (per le prove): now = orologio, autoTick = false per far andare i passi a mano, bots = false senza bot
  constructor(ctx, env, options = {}) {
    this.ctx = ctx;
    this.env = env;
    this.now = options.now || (() => Date.now());
    this.autoTick = options.autoTick !== false;
    this.useBots = options.bots !== false;
    this.world = desertWorld();
    this.starts = { blu: points('partenza_blu_'), rossa: points('partenza_rossa_') };
    this.items = [...points('raccolta_'), ...points('cassa_medica_')].map(p => ({
      ...p,
      kind: p.name.startsWith('cassa') ? 'cassa_medica' : p.tipo,
      readyAt: 0
    }));
    this.random = rng(options.seed ?? 89);
    this.players = new Map(); // socket -> giocatore
    this.bots = [];
    this.botN = 0;
    this.phase = 'attesa';
    this.endsAt = 0;
    this.results = null;
    this.events = [];
    this.tickN = 0;
    this.timer = null;
    // 'deserto': la partita; 'poligono': il poligono di tiro condiviso
    this.mode = 'deserto';
  }

  // mappa dei passaggi per i bot: si calcola la prima volta che serve
  get nav() {
    return (this._nav ??= createNav(this.world));
  }

  // dove vanno i bot quando non vedono nessuno: armi a terra, casse, rinascite, partenze, centro
  goals() {
    return (this._goals ??= [
      ...this.items,
      ...points('rinascita_'),
      ...this.starts.blu,
      ...this.starts.rossa,
      { x: 0, z: 6 }
    ]);
  }

  all() {
    return [...this.players.values(), ...this.bots];
  }

  humans(team) {
    return [...this.players.values()].filter(p => p.team === team).length;
  }

  sockets() {
    return this.ctx.getWebSockets(ZONA.key).filter(s => {
      const a = s.deserializeAttachment();
      return a && !a.closed && s.readyState === 1;
    });
  }

  fetch(req) {
    const user = userOf(req);
    if (!user?.player) return json({ error: MSG.login }, 401);
    let path = new URL(req.url).pathname;
    if (path.startsWith('/zona/poligono/')) {
      this.mode = 'poligono';
      path = path.replace('/poligono', '');
    }
    this.sync();
    if (path === '/zona/state')
      return json({ phase: this.phase, players: [...this.players.values()].map(p => p.name) });
    if (path !== '/zona/ws' || req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return json({ error: MSG.live }, 426);
    const old = [...this.players.values()].find(p => p.id === user.player);
    if (!old && this.players.size >= ZONA.perTeam * 2)
      return json({ error: 'La Zona Operativa è al completo.' }, 409);
    if (old) {
      old.socket.serializeAttachment({ ...old.socket.deserializeAttachment(), closed: true });
      try {
        old.socket.close(4000, 'Zona Operativa aperta in un’altra finestra');
      } catch {}
      this.leave(old.socket);
    }
    const pair = new WebSocketPair();
    const socket = pair[1];
    this.ctx.acceptWebSocket(socket, [ZONA.key]);
    socket.serializeAttachment({
      kind: ZONA.key,
      id: user.player,
      name: String(user.name || 'Giocatore').slice(0, 30),
      mode: this.mode,
      memberId: user.id,
      opened: this.now(),
      expires: Number(req.headers.get('X-Session-Expires')),
      accessTag: req.headers.get('X-Access-Tag')
    });
    this.join(socket);
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
      headers: { 'Sec-WebSocket-Protocol': 'checkmate' }
    });
  }

  // dopo un risveglio della Durable Object la memoria è vuota: si rifanno i giocatori dai collegamenti aperti
  sync() {
    for (const s of this.sockets()) {
      if (s.deserializeAttachment().mode === 'poligono') this.mode = 'poligono';
      if (!this.players.has(s)) this.join(s);
    }
  }

  newPlayer(fields) {
    const now = this.now();
    return {
      body: newBody(0, 0, 0),
      hp: PLAYER.health,
      alive: false,
      deadUntil: 0,
      guns: {},
      slot1: null,
      current: 'baretta',
      kills: 0,
      deaths: 0,
      seq: 0,
      budget: 0.25,
      budgetAt: now,
      view: now,
      fireHeld: false,
      scoped: false,
      history: [],
      ...fields
    };
  }

  join(socket) {
    const a = socket.deserializeAttachment();
    const range = this.mode === 'poligono';
    const p = this.newPlayer({ socket, id: a.id, name: a.name });
    if (!range) p.team = this.pickTeam(a.team);
    this.players.set(socket, p);
    if (range) {
      this.phase = 'poligono';
      p.team = 'blu';
      p.posed = false; // si vede dopo la prima posizione mandata
    } else {
      this.spawn(p);
      this.fillBots();
    }
    this.event({ e: 'entra', id: p.id, n: p.name });
    this.send(p, {
      t: 'ciao',
      id: p.id,
      mode: this.mode,
      tick: ZONA.tick,
      team: p.team,
      items: range ? [] : this.items.map(i => [i.kind, i.x, i.y, i.z])
    });
    this.checkPhase(this.now());
    this.start();
  }

  // squadra: quella chiesta se ha posto (al massimo 4 persone), se no quella con meno persone
  pickTeam(want, me = null) {
    const count = t => [...this.players.values()].filter(p => p !== me && p.team === t).length;
    if (TEAMS.includes(want) && count(want) < ZONA.perTeam) return want;
    const [b, r] = TEAMS.map(count);
    if (b !== r) return b < r ? 'blu' : 'rossa';
    return me?.team || (this.random() < 0.5 ? 'blu' : 'rossa');
  }

  // i bot riempiono ogni squadra fino a 4; quando entra una persona ne esce uno
  fillBots() {
    if (this.mode !== 'deserto') return;
    const humans = this.players.size;
    for (const team of TEAMS) {
      const want = this.useBots && humans ? Math.max(0, ZONA.perTeam - this.humans(team)) : 0;
      let mine = this.bots.filter(b => b.team === team);
      while (mine.length > want) {
        // esce prima un bot già eliminato, se no l'ultimo entrato
        const out = mine.find(b => !b.alive) || mine[mine.length - 1];
        this.bots.splice(this.bots.indexOf(out), 1);
        mine = mine.filter(b => b !== out);
      }
      while (mine.length < want) {
        const used = new Set(this.bots.map(b => b.name));
        const name = 'Bot ' + (BOT_NAMES.find(n => !used.has('Bot ' + n)) || ++this.botN);
        const bot = this.newPlayer({ id: 'bot:' + ++this.botN, name, team, bot: true });
        this.bots.push(bot);
        mine.push(bot);
        if (this.phase === 'partita' || this.phase === 'attesa') this.spawn(bot);
      }
    }
  }

  leave(socket) {
    const p = this.players.get(socket);
    if (!p) return;
    this.players.delete(socket);
    this.event({ e: 'esce', id: p.id, n: p.name });
    this.fillBots();
    this.checkPhase(this.now());
    if (!this.players.size) this.stop();
  }

  close(socket) {
    const a = socket.deserializeAttachment();
    if (a && !a.closed) socket.serializeAttachment({ ...a, closed: true });
    this.leave(socket);
  }

  start() {
    if (this.timer || !this.autoTick) return;
    this.timer = setInterval(() => {
      try {
        this.tick();
      } catch (e) {
        console.error('zona tick', e);
      }
    }, ZONA.tick);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // nessuno collegato: la prossima volta si riparte da capo
    this.phase = this.mode === 'poligono' ? 'poligono' : 'attesa';
    this.results = null;
    this.bots = [];
    for (const i of this.items) i.readyAt = 0;
  }

  event(e) {
    this.events.push(e);
  }

  send(p, data) {
    if (!p.socket) return;
    try {
      p.socket.send(JSON.stringify(data));
    } catch {}
  }

  // ---------- partita ----------

  // si gioca appena ci sono almeno due giocatori (anche bot), di cui almeno una persona
  checkPhase(now) {
    if (this.mode === 'poligono') return;
    const n = this.all().length;
    if (this.phase === 'attesa' && n >= 2 && this.players.size) this.begin(now);
    else if (this.phase === 'partita' && (n < 2 || !this.players.size)) {
      this.phase = 'attesa';
      this.endsAt = 0;
    }
  }

  begin(now) {
    this.phase = 'partita';
    this.endsAt = now + ZONA.match;
    this.results = null;
    for (const i of this.items) i.readyAt = 0;
    for (const p of this.all()) {
      p.kills = 0;
      p.deaths = 0;
      p.alive = false; // così le partenze si scelgono libere
    }
    for (const p of this.all()) this.spawn(p);
    this.event({ e: 'via' });
  }

  teamScore() {
    const s = { blu: 0, rossa: 0 };
    for (const p of this.all()) s[p.team] += p.kills;
    return s;
  }

  finish(now) {
    this.phase = 'fine';
    this.endsAt = now + ZONA.results;
    const rows = this.all()
      .map(p => ({ id: p.id, name: p.name, team: p.team, bot: !!p.bot, kills: p.kills, deaths: p.deaths }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const score = this.teamScore();
    const winner = score.blu === score.rossa ? null : score.blu > score.rossa ? 'blu' : 'rossa';
    this.results = { rows, score, winner };
    this.event({ e: 'fine', r: this.results });
  }

  // rinascita alla partenza della propria squadra, in un punto libero (a parità, uno a caso col seme)
  spawnPoint(p) {
    const others = this.all().filter(o => o !== p && o.alive);
    const spots = this.starts[p.team] || this.starts.blu;
    let best = [];
    let bestD = -1;
    for (const s of spots) {
      const d = others.length
        ? Math.min(...others.map(o => Math.hypot(o.body.x - s.x, o.body.z - s.z)))
        : 100;
      const r = Math.min(3, Math.round(d)); // basta un paio di metri liberi
      if (r > bestD) {
        bestD = r;
        best = [s];
      } else if (r === bestD) best.push(s);
    }
    return best[Math.floor(this.random() * best.length)];
  }

  spawn(p) {
    const s = this.spawnPoint(p);
    p.body = newBody(s.x, Math.max(s.y, this.world.height(s.x, s.z)), s.z, s.yaw);
    p.body.onGround = true;
    p.hp = PLAYER.health;
    p.alive = true;
    p.guns = { baretta: newGun('baretta'), coltello: newGun('coltello') };
    p.slot1 = null;
    // arma principale a rotazione (scelta del proprietario, 28 novembre): a ogni rinascita la successiva del giro,
    // partendo per ognuno da un punto a caso; i bot girano fra le loro tre (col Falco si muovono male)
    const rot = p.bot ? BOT_WEAPONS : SPAWN_ROTATION;
    p.spawnN = (p.spawnN ?? Math.floor(this.random() * rot.length)) + 1;
    const w = rot[p.spawnN % rot.length];
    p.guns[w] = newGun(w);
    p.slot1 = w;
    p.current = w;
    if (p.bot) p.ai = null;
    p.fireHeld = false;
    p.history = [];
    this.event({ e: 'nasce', id: p.id, x: s.x, y: p.body.y, z: s.z, yaw: s.yaw });
  }

  // ---------- passo (20 al secondo) ----------

  tick() {
    this.sync();
    const now = this.now();
    this.tickN += 1;
    if (this.mode === 'poligono') return this.broadcast(now);
    if (this.phase === 'partita' && now >= this.endsAt) this.finish(now);
    else if (this.phase === 'fine' && now >= this.endsAt) {
      if (this.players.size) this.begin(now);
      else {
        this.phase = 'attesa';
        this.results = null;
      }
    }
    // i bot pensano e si muovono con tre comandi da 1/60 di secondo, come un telefono
    if (this.phase !== 'fine')
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        const c = botThink(this, bot, now, ZONA.tick / 1000);
        bot.view = now;
        for (let k = 0; k < 3; k++) {
          const fire = c.fire && (c.auto || k === 0);
          // i bot camminano (la velocità che fino alla 1.0.73 era la corsa)
          const bits = (c.jump && k === 0 ? BIT.jump : 0) | (fire ? BIT.fire : 0) | BIT.walk;
          this.command(bot, [c.fwd, c.side, bits, c.yaw, c.pitch, ARMI.indexOf(bot.current)], now);
        }
      }
    for (const p of this.all()) {
      if (!p.alive && now >= p.deadUntil && this.phase !== 'fine') this.spawn(p);
      p.history.push({ t: now, x: p.body.x, y: p.body.y, z: p.body.z, crouch: p.body.crouch });
      while (p.history.length && p.history[0].t < now - ZONA.history) p.history.shift();
    }
    this.broadcast(now);
  }

  broadcast(now) {
    const list = this.all();
    const range = this.mode === 'poligono';
    const others = list
      .filter(p => !range || p.posed)
      .map(p => [
        p.id,
        +p.body.x.toFixed(3),
        +p.body.y.toFixed(3),
        +p.body.z.toFixed(3),
        +p.body.yaw.toFixed(3),
        +p.body.pitch.toFixed(3),
        (p.body.crouch ? 1 : 0) | (p.alive ? 0 : 2) | (p.body.onGround ? 4 : 0),
        ARMI.indexOf(p.current),
        TEAMS.indexOf(p.team)
      ]);
    const score = this.teamScore();
    const base = {
      t: 's',
      k: this.tickN,
      time: now,
      ph: this.phase,
      left: this.endsAt ? Math.max(0, this.endsAt - now) : 0,
      p: others,
      it: this.items.map((i, n) => (i.readyAt > now ? n : -1)).filter(n => n >= 0),
      sc: list.map(p => [p.id, p.name, p.kills, p.deaths, TEAMS.indexOf(p.team), p.bot ? 1 : 0]),
      sq: [score.blu, score.rossa],
      ev: this.events
    };
    this.events = [];
    if (range) {
      for (const p of list) this.send(p, base);
      return;
    }
    for (const p of this.players.values()) {
      const b = p.body;
      this.send(p, {
        ...base,
        ack: p.seq,
        me: {
          x: b.x,
          y: b.y,
          z: b.z,
          vx: b.vx,
          vy: b.vy,
          vz: b.vz,
          g: b.onGround,
          c: b.crouch,
          hp: p.hp,
          al: p.alive,
          ru: p.alive ? 0 : Math.max(0, p.deadUntil - now),
          tm: p.team,
          s1: p.slot1,
          cur: p.current,
          am: Object.fromEntries(
            Object.values(p.guns).map(g => [g.weapon, g.ammo === Infinity ? -1 : g.ammo])
          )
        }
      });
    }
  }

  // ---------- comandi dal telefono ----------

  message(socket, raw) {
    if (typeof raw !== 'string' || raw.length > 3000) return;
    this.sync();
    const p = this.players.get(socket);
    if (!p) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (this.mode === 'poligono') return this.rangeMessage(p, m);
    if (m?.t === 'squadra') return this.changeTeam(p, m.s);
    if (m?.t !== 'in' || !Array.isArray(m.c) || !Number.isInteger(m.s)) return;
    const now = this.now();
    // tempo a disposizione: chi manda più comandi del tempo passato (troppo veloce) se li vede scartare
    p.budget = Math.min(0.3, p.budget + (now - p.budgetAt) / 1000);
    p.budgetAt = now;
    if (Number.isFinite(m.v)) p.view = clamp(m.v, now - ZONA.rewind, now);
    for (const c of m.c.slice(0, 20)) {
      if (!Array.isArray(c)) continue;
      if (p.budget < ZONA.cmdDt - 1e-6) break;
      p.budget -= ZONA.cmdDt;
      this.command(p, c, now);
    }
    p.seq = Math.max(p.seq, m.s);
  }

  // scelta della squadra (all'inizio, e si può cambiare): si rinasce alla nuova partenza, senza contare un'eliminazione
  changeTeam(p, want) {
    if (!['blu', 'rossa', 'auto'].includes(want)) return;
    const a = p.socket.deserializeAttachment();
    p.socket.serializeAttachment({ ...a, team: want === 'auto' ? null : want });
    const team = want === 'auto' ? p.team : this.pickTeam(want, p);
    if (team === p.team) return;
    p.team = team;
    this.fillBots();
    if (this.phase !== 'fine') this.spawn(p);
    this.event({ e: 'squadra', id: p.id, s: team });
  }

  // Poligono condiviso: ognuno si muove da sé e manda dove sta ({t:'posa', p:[x, y, z, yaw, pitch, bit, arma]}) e
  // quando spara ({t:'spara', w}). Niente danni tra giocatori: il server lo passa soltanto agli altri.
  rangeMessage(p, m) {
    if (m?.t === 'posa' && Array.isArray(m.p)) {
      const [x, y, z, yaw, pitch, bits, arma] = m.p;
      if (![x, y, z, yaw].every(Number.isFinite)) return;
      Object.assign(p.body, {
        x: clamp(x, -40, 40),
        y: clamp(y, -2, 10),
        z: clamp(z, -80, 40),
        yaw,
        pitch: num(pitch, -1.5, 1.5),
        crouch: !!((bits | 0) & 1),
        onGround: !!((bits | 0) & 4)
      });
      p.alive = true;
      p.posed = true;
      if (ARMI[arma]) p.current = ARMI[arma];
    } else if (m?.t === 'spara' && ARMI.includes(m.w) && p.posed)
      this.event({ e: 'spara', id: p.id, w: m.w });
  }

  command(p, c, now) {
    const [fwd, side, bits, yaw, pitch, arma] = c;
    if (!p.alive || this.phase === 'fine') return;
    const bit = k => !!((bits | 0) & BIT[k]);
    const want = ARMI[arma];
    if (want && p.guns[want] && want !== p.current) {
      p.current = want;
      p.scoped = false;
    }
    // mira (tasto destro): meno dispersione, e mirando si va piano
    p.scoped = bit('scope') && !WEAPONS[p.current].melee;
    const input = {
      fwd: num(fwd, -1, 1),
      side: num(side, -1, 1),
      jump: bit('jump'),
      crouch: bit('crouch'),
      walk: bit('walk') || p.scoped,
      aim: p.scoped,
      yaw: Number.isFinite(yaw) ? yaw : p.body.yaw,
      pitch: num(pitch, -1.5, 1.5)
    };
    moveStep(p.body, input, ZONA.cmdDt, this.world);
    for (const g of Object.values(p.guns)) tickGun(g, ZONA.cmdDt);
    const gun = p.guns[p.current];
    if (bit('reload')) startReload(gun);
    if (bit('take')) this.takeWeapon(p, now);
    this.medkit(p, now);
    const fire = bit('fire');
    const w = WEAPONS[p.current];
    if (fire && (w.auto || !p.fireHeld) && tryFire(gun) === 'spara') this.shoot(p, now);
    p.fireHeld = fire;
  }

  near(p, kind) {
    const now = this.now();
    let best = null;
    for (const i of this.items) {
      if (i.readyAt > now || (kind === 'arma') === (i.kind === 'cassa_medica')) continue;
      const d = Math.hypot(i.x - p.body.x, i.z - p.body.z);
      if (d < ZONA.take && Math.abs(i.y - p.body.y) < 1.6 && (!best || d < best.d)) best = { i, d };
    }
    return best?.i;
  }

  takeWeapon(p, now) {
    const i = this.near(p, 'arma');
    if (!i || (p.slot1 === i.kind && p.guns[i.kind].ammo === WEAPONS[i.kind].mag)) return;
    if (p.slot1 && p.slot1 !== i.kind) delete p.guns[p.slot1];
    p.slot1 = i.kind;
    p.guns[i.kind] = newGun(i.kind);
    p.current = i.kind;
    i.readyAt = now + ZONA.weaponBack;
    this.event({ e: 'prende', id: p.id, w: i.kind, i: this.items.indexOf(i) });
  }

  medkit(p, now) {
    if (p.hp >= PLAYER.health) return;
    const i = this.near(p, 'cassa');
    if (!i) return;
    p.hp = Math.min(PLAYER.health, p.hp + ZONA.medHeal);
    i.readyAt = now + ZONA.medBack;
    this.event({ e: 'cura', id: p.id, hp: p.hp, i: this.items.indexOf(i) });
  }

  // dove stava un giocatore al tempo t (tra due passi si fa la media)
  positionAt(p, t) {
    const h = p.history;
    const cur = { x: p.body.x, y: p.body.y, z: p.body.z, crouch: p.body.crouch, yaw: p.body.yaw };
    if (!h.length || t >= h[h.length - 1].t) return cur;
    if (t <= h[0].t) return { ...h[0], yaw: cur.yaw };
    for (let n = h.length - 1; n > 0; n--) {
      const a = h[n - 1];
      const b = h[n];
      if (t >= a.t) {
        const k = (t - a.t) / (b.t - a.t || 1);
        return {
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
          z: a.z + (b.z - a.z) * k,
          crouch: k < 0.5 ? a.crouch : b.crouch,
          yaw: cur.yaw
        };
      }
    }
    return cur;
  }

  shoot(p, now) {
    const weapon = p.current;
    const w = WEAPONS[weapon];
    const b = p.body;
    const eye = { x: b.x, y: eyeHeight(b), z: b.z };
    const dir = lookDir(b.yaw, b.pitch);
    const dirs = pelletDirs(dir, spreadFor(weapon, b, p.scoped), w.pellets, this.random);
    const t = clamp(p.view, now - ZONA.rewind, now);
    // niente fuoco amico: i compagni non si colpiscono e i colpi li attraversano
    const targets = this.all()
      .filter(o => o !== p && o.alive && o.team !== p.team)
      .map(o => ({ o, at: this.positionAt(o, t) }));
    const dealt = new Map();
    let impact = null;
    for (const d of dirs) {
      const maxT = w.melee ? w.range : 300;
      const wall = this.world.ray(eye, d, maxT);
      let best = null;
      for (const tg of targets) {
        const h = playerHit(eye, d, tg.at, wall ? wall.t : maxT);
        if (h && (!best || h.t < best.h.t)) best = { tg, h };
      }
      if (best) {
        let amount = damage(weapon, best.h.zone, best.h.t);
        if (w.melee) amount = fromBehind(b, best.tg.at) ? w.backDamage : w.damage;
        const old = dealt.get(best.tg.o) || { amount: 0, head: false };
        dealt.set(best.tg.o, { amount: old.amount + amount, head: old.head || best.h.zone === 'testa' });
      } else if (wall && !impact && (!w.melee || wall.t <= w.range))
        impact = [
          +(eye.x + d.x * wall.t).toFixed(2),
          +(eye.y + d.y * wall.t).toFixed(2),
          +(eye.z + d.z * wall.t).toFixed(2)
        ];
    }
    this.event({ e: 'spara', id: p.id, w: weapon, ...(impact ? { at: impact } : {}) });
    for (const [o, hit] of dealt) {
      o.hp = Math.max(0, o.hp - hit.amount);
      this.event({ e: 'colpo', a: p.id, v: o.id, d: hit.amount, h: hit.head, hp: o.hp });
      if (o.hp <= 0) {
        o.alive = false;
        o.deadUntil = now + ZONA.respawn;
        o.deaths += 1;
        o.fireHeld = false;
        p.kills += 1;
        this.event({ e: 'elimina', a: p.id, v: o.id, w: weapon, h: hit.head });
      }
    }
  }
}
