// Calcio balilla della Lobby 3D: la partita online gira sul server della Lobby.
// Regole e fisica in public/lobby3d/balilla-rules.js (le stesse del telefono), decisioni in docs/balilla.md.
// Chi guarda o gioca è segnato anche nella connessione (attachment.balilla): se il server va in pausa
// (ibernazione) la lista si ricostruisce da lì, così chi era seduto al tavolo non perde il posto.
import {
  rows,
  figureZ,
  W,
  newField,
  simulate,
  throwIn,
  control,
  swapSides,
  tuneField,
  TARGETS
} from './public/lobby3d/balilla-rules.js';

const TICK = 33; // ms tra un aggiornamento e l'altro (30 al secondo)
export const IDLE_STOP = 5 * 60000; // tavolo fermo dopo 5 minuti senza comandi
// Il telefono di chi è seduto manda "watch" ogni 3 secondi. Se tace da PAUSE la partita si ferma (app nascosta,
// rete caduta) e nessuno segna contro chi non c'è; se tace da SEAT_GRACE il posto si libera (prima restava
// occupato da un collegamento morto). Chi si alza e torna entro SEAT_GRACE ritrova il punteggio.
export const PAUSE = 6000,
  SEAT_GRACE = 30000;
// Computer temporaneo sui blu quando al tavolo c'è una sola persona (per vedere come reagisce la pallina in allenamento):
// mette la figura sulla traiettoria, para con le figure giù e tira quando la palla è lenta davanti al piede.
export function practiceAI(f, team, dt, mem) {
  const b = f.ball,
    forward = team === 0 ? 1 : -1;
  mem.think = (mem.think ?? 0) - dt;
  const decide = mem.think <= 0;
  if (decide) mem.think = 0.08 + Math.random() * 0.06;
  rows.forEach((row, i) => {
    if (row.team !== team) return;
    const rod = f.rods[i],
      m = (mem[i] ??= { slide: 0, kick: 0, wait: 0 });
    if (decide) {
      // dove sarà la palla (z) quando arriva a quest'asta, con i rimbalzi sulle sponde
      let z = b.z;
      if (Math.abs(b.vx) > 0.05 && (row.x - b.x) * b.vx > 0) {
        z = b.z + b.vz * Math.min(1.2, (row.x - b.x) / b.vx);
        const span = 4 * W;
        z = ((((z + W) % span) + span) % span) - W;
        if (z > W) z = 2 * W - z;
      }
      z += (Math.random() - 0.5) * 0.02;
      let best = 0,
        bd = 1e9;
      for (let n = 0; n < row.count; n++) {
        const shift = Math.max(-row.travel, Math.min(row.travel, z - figureZ(row, n, 0)));
        const d = Math.abs(z - figureZ(row, n, shift));
        if (d < bd) {
          bd = d;
          best = shift;
        }
      }
      m.slide = best / row.travel;
    }
    const ahead = (b.x - row.x) * forward,
      speed = Math.hypot(b.vx, b.vz);
    let near = 1e9;
    for (let n = 0; n < row.count; n++) near = Math.min(near, Math.abs(b.z - figureZ(row, n, rod.shift)));
    let angle = 0;
    if (m.kick > 0) {
      m.kick -= dt;
      angle = forward * 1.3; // tiro in avanti
      if (m.kick <= 0) m.wait = 0.15;
    } else if (m.wait > 0) m.wait -= dt;
    else if (f.phase === 'play' && ahead > -0.01 && ahead < 0.1 && speed < 0.9 && near < 0.03) {
      // palla lenta appena davanti: carica indietro e tira
      if (rod.angle * forward < -0.5) m.kick = 0.08;
      else angle = -forward * 0.8;
    } else if (f.phase === 'play' && ahead < -0.03 && b.vx * forward > 0.25) angle = -forward * 1.3; // tiro di un compagno da dietro: figure su
    rod.tShift = m.slide;
    rod.tAngle = angle;
  });
}

const PRACTICE_AI = false; // da soli al tavolo ci si allena: l'altra squadra resta ferma (computer spento)
const SOUNDS = ['kick', 'rail', 'goal', 'stop', 'throw', 'post'];
const round = v => Math.round(v * 1000) / 1000;
// Solo quello che serve per disegnare il tavolo, con i numeri arrotondati (messaggi più leggeri).
export function publicField(f) {
  return {
    hit: f.hit,
    sound: f.sound,
    power: round(f.power || 0),
    phase: f.phase,
    ...(f.practice && { tuning: f.tuning }),
    thrower: f.thrower,
    wait: round(Math.max(0, f.wait)),
    target: f.target,
    bestOf: f.bestOf,
    games: f.games,
    gameNo: f.gameNo,
    score: f.score,
    finished: f.finished,
    ball: { x: round(f.ball.x), z: round(f.ball.z), vx: round(f.ball.vx), vz: round(f.ball.vz) },
    rods: f.rods.map(r => ({ shift: round(r.shift), angle: round(r.angle) }))
  };
}

export class BalillaHub {
  constructor(ctx = null) {
    this.ctx = ctx;
    this.viewers = new Map();
    this.mode = 2;
    this.field = newField();
    this.swap = 0;
    this.timer = null;
    this.restored = false;
    this.last = '';
  }
  // Dopo un'ibernazione: rimette in lista chi guardava o era seduto (dalle connessioni ancora aperte).
  restore() {
    if (this.restored) return;
    this.restored = true;
    for (const ws of this.ctx?.getWebSockets?.() ?? []) {
      let a;
      try {
        a = ws.deserializeAttachment();
      } catch {
        continue;
      }
      if (a?.kind !== 'lobby' || a.closed || !a.inClub || !a.balilla || this.viewers.has(ws)) continue;
      const id = a.memberId || a.user?.id || null;
      const seated = this.seated();
      let slot = Number.isInteger(a.balilla.slot) ? a.balilla.slot : -1;
      if (slot >= 0 && !seated.length) {
        this.mode = a.balilla.mode === 4 ? 4 : 2;
        this.field = newField({ bar: a.balilla.bar, target: a.balilla.target, bestOf: a.balilla.bestOf });
      }
      if (slot > 3 || (this.mode === 2 && slot % 2) || seated.some(v => v.slot === slot)) slot = -1;
      this.viewers.set(ws, { id, slot, local: false, seenAt: Date.now() });
    }
    if (this.field.bar) this.updateBar();
  }
  remember(ws, member) {
    try {
      const a = ws.deserializeAttachment() || {};
      a.balilla = member
        ? {
            slot: member.slot,
            bar: this.field.bar,
            mode: this.mode,
            target: this.field.target,
            bestOf: this.field.bestOf
          }
        : null;
      ws.serializeAttachment(a);
    } catch {}
  }
  seated() {
    return [...this.viewers.values()].filter(v => v.slot >= 0);
  }
  // Qualcuno gioca al tavolo contro il computer o sullo stesso telefono: online non ci si siede.
  // occupato da una partita sul telefono: vale finché chi l'ha dichiarato si fa sentire (il telefono manda "watch"
  // ogni 3 secondi); prima restava occupato per sempre, finché la persona restava collegata
  busy() {
    const now = Date.now();
    return [...this.viewers.values()].some(v => v.local && now - (v.seenAt || 0) < 15000);
  }
  // Posti tenuti da telefoni che non si fanno sentire da SEAT_GRACE: si liberano.
  sweep(now = Date.now()) {
    for (const [ws, v] of [...this.viewers])
      if (v.slot >= 0 && now - (v.seenAt || 0) > SEAT_GRACE) this.leave(ws);
  }
  // qualcuno seduto tace da PAUSE: partita ferma finché torna
  paused(now = Date.now()) {
    return this.seated().some(v => now - (v.seenAt || 0) > PAUSE);
  }
  message(ws, id, b) {
    this.restore();
    const sender = this.viewers.get(ws);
    if (sender) sender.seenAt = Date.now();
    this.sweep();
    if (b.action === 'leave') return this.leave(ws);
    let member = this.viewers.get(ws);
    if (!member) {
      if (b.action !== 'watch') return;
      member = { id, slot: -1, local: false, seenAt: Date.now() };
      this.viewers.set(ws, member);
      this.remember(ws, member);
      return this.send(ws, member);
    }
    member.seenAt = Date.now();
    // chi è seduto e muove o rimette la pallina: il tavolo riparte se si era fermato per inattività
    if (member.slot >= 0 && (b.action === 'input' || b.action === 'ready')) {
      this.lastInput = Date.now();
      if (!this.timer && !this.field.finished) this.start();
    }
    if (b.action === 'practice-sound') {
      // suoni di una partita sul telefono (computer, stesso telefono): li sentono anche gli altri vicini al tavolo
      const now = Date.now();
      if (this.timer || now - (member.lastSound ?? 0) < 90 || !SOUNDS.includes(b.sound)) return;
      member.lastSound = now;
      const text = JSON.stringify({
        type: 'balilla',
        sound: b.sound,
        power: Math.max(0, Math.min(1, Number(b.power) || 0.5))
      });
      for (const [peer] of this.viewers)
        if (peer !== ws)
          try {
            peer.send(text);
          } catch {}
      return;
    }
    if (b.action === 'watch') return this.send(ws, member);
    if (b.action === 'local') {
      const on = b.on === true && !this.seated().length;
      if (member.local !== on) {
        member.local = on;
        this.broadcast(true);
      } else this.send(ws, member);
      return;
    }
    if (b.action === 'join') {
      if (member.slot >= 0) return;
      // Ricollegato con una connessione nuova (rete caduta un attimo): la vecchia, ormai morta, teneva ancora il
      // posto e da qui si era solo spettatori (aste ferme, rilancio ignorato). La persona riprende il suo posto.
      if (id != null)
        for (const [peer, other] of [...this.viewers])
          if (peer !== ws && other.id === id) {
            const slot = other.slot;
            this.viewers.delete(peer);
            this.remember(peer, null);
            if (slot >= 0 && b.slot === slot) {
              member.slot = slot;
              this.remember(ws, member);
              if (this.field.bar) this.updateBar();
              else this.start();
              this.broadcast(true);
              return;
            }
          }
      const occupied = this.seated();
      if (!occupied.length && !this.busy()) {
        // chi apre il tavolo sceglie 1 contro 1 o 2 contro 2, i gol e se è secca o al meglio di 3
        this.mode = b.mode === 4 ? 4 : 2;
        this.field = newField({
          bar: b.bar === true && this.mode === 2,
          target: TARGETS.includes(b.target) ? b.target : 5,
          bestOf: b.bestOf === 3 ? 3 : 1
        });
        this.swap = this.field.swap;
      }
      if (
        this.busy() ||
        !Number.isInteger(b.slot) ||
        b.slot < 0 ||
        b.slot > 3 ||
        (this.mode === 2 && b.slot % 2) ||
        occupied.some(v => v.slot === b.slot || v.id === id) ||
        b.mode !== this.mode
      )
        return this.send(ws, member);
      member.slot = b.slot;
      this.remember(ws, member);
      if (this.field.bar) this.updateBar();
      else if (occupied.length + 1 === this.mode) this.start();
      // torna chi si era alzato da poco: riprende il punteggio; se si siede un altro si riparte da zero
      const held = this.held;
      this.held = null;
      if (
        held &&
        held.id === id &&
        held.slot === b.slot &&
        Date.now() < held.until &&
        this.field.bar &&
        !this.field.practice
      ) {
        this.field.score = held.score;
        this.field.games = held.games;
        this.field.gameNo = held.gameNo;
      }
      this.broadcast(true);
    } else if (b.action === 'tune' && member.slot >= 0 && this.field.practice) {
      tuneField(this.field, b.values);
      this.broadcast(true);
    } else if (b.action === 'ready' && member.slot >= 0 && this.timer) {
      // rimessa: la fa partire chi deve rimettere (nel 2 contro 2 uno qualsiasi dei due)
      if (this.field.practice) {
        this.field.thrower = member.slot / 2;
        this.field.phase = 'throw';
      }
      if (
        (this.field.practice || Math.floor(member.slot / 2) === this.field.thrower) &&
        throwIn(this.field, Math.random, b.pair === 0 ? 0 : 1)
      )
        this.broadcast(true);
    } else if (
      b.action === 'input' &&
      member.slot >= 0 &&
      Number.isFinite(b.slide) &&
      Number.isFinite(b.angle)
    ) {
      const team = Math.floor(member.slot / 2),
        pair = this.mode === 4 ? member.slot % 2 : b.pair === 0 ? 0 : 1;
      if (this.field.bar) {
        rows.forEach((row, i) => {
          if (row.team !== team || row.attack === pair) return;
          const rod = this.field.rods[i];
          rod.tShift = rod.shift / row.travel;
          rod.tAngle = rod.angle;
        });
      }
      control(this.field, team, pair, b.slide, b.angle);
    } else if (member.slot >= 0 && ((b.action === 'again' && this.field.finished) || b.action === 'reset')) {
      // nuova partita, oppure contapunti azzerati da chi è al tavolo
      this.field = newField({
        bar: this.field.bar,
        target: this.field.target,
        bestOf: this.field.bestOf,
        tuning: this.field.tuning
      });
      if (this.field.bar) this.updateBar();
      this.swap = this.field.swap;
      this.start();
      this.broadcast(true);
    }
  }
  // Cambio campo tra una partita e l'altra (2 contro 2): ognuno passa dall'altra parte del tavolo.
  changeSides() {
    swapSides(this.field);
    for (const [ws, m] of this.viewers)
      if (m.slot >= 0) {
        m.slot ^= 2;
        this.remember(ws, m);
      }
  }
  updateBar() {
    const seated = this.seated();
    this.field.practice = seated.length === 1;
    if (this.field.practice) {
      this.field.score = [0, 0];
      this.field.thrower = seated[0].slot / 2;
    } else tuneField(this.field);
    if (seated.length) this.start();
  }
  start() {
    if (this.timer || (this.field.bar ? !this.seated().length : this.seated().length !== this.mode)) return;
    let last = Date.now(),
      carry = 0;
    this.lastInput = Math.max(this.lastInput || 0, last);
    this.timer = setInterval(() => {
      const now = Date.now();
      this.sweep(now);
      if (!this.timer) return;
      if (this.paused(now)) {
        last = now;
        carry = 0;
        this.broadcast();
        return;
      }
      // 5 minuti senza comandi da chi è seduto: il tavolo si ferma (prima girava 30 volte al secondo per sempre e
      // l'oggetto Lobby non andava mai a riposo); riparte al primo comando
      if (now - this.lastInput > IDLE_STOP) {
        this.stop();
        return;
      }
      carry += Math.min(0.12, (now - last) / 1000);
      last = now;
      while (carry >= 1 / 120) {
        if (PRACTICE_AI && this.field.practice) {
          const human = this.seated()[0];
          if (human) practiceAI(this.field, 1 - Math.floor(human.slot / 2), 1 / 120, (this.aiMem ??= {}));
        }
        simulate(this.field, 1 / 120);
        carry -= 1 / 120;
      }
      if (this.field.swap !== this.swap) {
        this.swap = this.field.swap;
        if (this.mode === 4) this.changeSides();
      }
      if (this.field.finished) this.stop();
      this.broadcast();
    }, TICK);
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
  leave(ws) {
    this.restore();
    const member = this.viewers.get(ws);
    if (!member) return;
    this.viewers.delete(ws);
    this.remember(ws, null);
    if (member.slot >= 0) {
      // il punteggio resta da parte per SEAT_GRACE: se torna la stessa persona si continua
      if (this.field.bar && !this.field.practice && member.id != null)
        this.held = {
          id: member.id,
          slot: member.slot,
          score: [...this.field.score],
          games: Array.isArray(this.field.games) ? [...this.field.games] : this.field.games,
          gameNo: this.field.gameNo,
          until: Date.now() + SEAT_GRACE
        };
      // chi resta aspetta un altro giocatore; le aste di chi è uscito si fermano
      this.stop();
      const team = Math.floor(member.slot / 2);
      rows.forEach((row, i) => {
        if (row.team === team && (this.mode === 2 || row.attack === member.slot % 2)) {
          const rod = this.field.rods[i];
          rod.tAngle = rod.angle;
          rod.tShift = rod.shift / row.travel;
        }
      });
    }
    if (!this.seated().length) this.field = newField();
    else if (this.field.bar) this.updateBar();
    this.broadcast(true);
  }
  payload(slot, field, occupied, local) {
    return `{"type":"balilla","mode":${this.mode},"slot":${slot},"occupied":${occupied},"playing":${!!this.timer},"paused":${!!this.timer && this.paused()},"busy":${this.busy() && !local},"field":${field}}`;
  }
  send(ws, m) {
    try {
      ws.send(
        this.payload(
          m.slot,
          JSON.stringify(publicField(this.field)),
          JSON.stringify(this.seated().map(v => v.slot)),
          m.local
        )
      );
    } catch {}
  }
  // Un solo JSON del campo per tutti; se non è cambiato niente (palla ferma, aste ferme) non si manda.
  broadcast(force = false) {
    const field = JSON.stringify(publicField(this.field)),
      occupied = JSON.stringify(this.seated().map(v => v.slot)),
      key = field + occupied + this.mode + !!this.timer + this.busy();
    if (!force && key === this.last) return;
    this.last = key;
    for (const [ws, m] of this.viewers)
      try {
        ws.send(this.payload(m.slot, field, occupied, m.local));
      } catch {}
  }
}
