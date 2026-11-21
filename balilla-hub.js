// Calcio balilla della Lobby 3D (prova su staging): la partita gira sul server della Lobby, 120 passi al secondo.
// Chi guarda o gioca è segnato anche nella connessione (attachment.balilla): se il server va in pausa
// (ibernazione) la lista si ricostruisce da lì, così chi era seduto al tavolo non perde il posto.
import { rows, newField, simulate } from './public/lobby3d/balilla-rules.js';

const TICK = 50; // ms tra un aggiornamento e l'altro
const round = v => Math.round(v * 1000) / 1000;
// Solo quello che serve per disegnare il tavolo, con i numeri arrotondati (messaggi più leggeri).
export function publicField(f) {
  return {
    hit: f.hit,
    sound: f.sound,
    ball: { x: round(f.ball.x), z: round(f.ball.z) },
    score: f.score,
    restart: f.restart,
    defence: f.defence,
    serve: f.serve,
    finished: f.finished,
    rods: f.rods.map(r => ({ shift: round(r.shift), angle: round(r.angle) }))
  };
}

export class BalillaHub {
  constructor(ctx = null) {
    this.ctx = ctx;
    this.viewers = new Map();
    this.mode = 2;
    this.field = newField();
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
      if (slot >= 0 && !seated.length) this.mode = a.balilla.mode === 4 ? 4 : 2;
      if (slot > 3 || (this.mode === 2 && slot % 2) || seated.some(v => v.slot === slot)) slot = -1;
      this.viewers.set(ws, { id, slot });
    }
  }
  remember(ws, member) {
    try {
      const a = ws.deserializeAttachment() || {};
      a.balilla = member ? { slot: member.slot, mode: this.mode } : null;
      ws.serializeAttachment(a);
    } catch {}
  }
  seated() {
    return [...this.viewers.values()].filter(v => v.slot >= 0);
  }
  controls(member, row) {
    return (
      member.slot >= 0 &&
      row.team === Math.floor(member.slot / 2) &&
      (this.mode === 2 || row.attack === member.slot % 2)
    );
  }
  message(ws, id, b) {
    this.restore();
    if (b.action === 'leave') return this.leave(ws);
    let member = this.viewers.get(ws);
    if (!member) {
      if (b.action !== 'watch') return;
      member = { id, slot: -1 };
      this.viewers.set(ws, member);
      this.remember(ws, member);
      return this.send(ws, member);
    }
    if (b.action === 'practice-sound') {
      const now = Date.now();
      if (this.timer || now - (member.lastSound ?? 0) < 110 || !['kick', 'rail', 'goal'].includes(b.sound))
        return;
      member.lastSound = now;
      const text = JSON.stringify({ type: 'balilla', sound: b.sound });
      for (const [peer] of this.viewers)
        if (peer !== ws)
          try {
            peer.send(text);
          } catch {}
      return;
    }
    if (b.action === 'watch') return this.send(ws, member);
    if (b.action === 'join') {
      if (member.slot >= 0) return;
      const occupied = this.seated();
      if (!occupied.length) {
        this.mode = b.mode === 4 ? 4 : 2;
        this.field = newField();
      }
      if (
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
      if (occupied.length + 1 === this.mode) this.start();
      this.broadcast(true);
    } else if (b.action === 'ready' && member.slot >= 0 && this.timer) {
      const serving = (this.field.serve === 1 ? 0 : 1) === Math.floor(member.slot / 2);
      if (
        serving &&
        this.field.restart === 'announce' &&
        (this.mode === 2 || member.slot % 2 === (this.field.defence ? 0 : 1))
      )
        this.field.restart = 'confirm';
      else if (!serving && this.field.restart === 'confirm') this.field.restart = '';
      this.broadcast(true);
    } else if (
      b.action === 'input' &&
      member.slot >= 0 &&
      Number.isFinite(b.slide) &&
      [-1, 0, 1].includes(b.turn)
    ) {
      rows.forEach((row, i) => {
        if (!this.controls(member, row)) return;
        const rod = this.field.rods[i];
        if (this.mode === 2 && (b.pair === 0 || b.pair === 1) && row.attack !== b.pair) {
          rod.turn = 0;
          return;
        }
        Object.assign(rod, { slide: Math.max(-1, Math.min(1, b.slide)), turn: b.turn * (row.team ? 1 : -1) });
      });
    } else if (b.action === 'again' && member.slot >= 0 && this.field.finished) {
      this.field = newField();
      this.start();
      this.broadcast(true);
    }
  }
  start() {
    if (this.timer || this.seated().length !== this.mode) return;
    let last = Date.now(),
      carry = 0;
    this.timer = setInterval(() => {
      const now = Date.now();
      carry += Math.min(0.12, (now - last) / 1000);
      last = now;
      while (carry >= 1 / 120) {
        simulate(this.field, 1 / 120);
        carry -= 1 / 120;
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
      this.stop();
      for (const [i, row] of rows.entries()) if (this.controls(member, row)) this.field.rods[i].turn = 0;
    }
    if (!this.seated().length) this.field = newField();
    this.broadcast(true);
  }
  payload(slot, field, occupied) {
    return `{"type":"balilla","mode":${this.mode},"slot":${slot},"occupied":${occupied},"playing":${!!this.timer},"field":${field}}`;
  }
  send(ws, m) {
    try {
      ws.send(
        this.payload(
          m.slot,
          JSON.stringify(publicField(this.field)),
          JSON.stringify(this.seated().map(v => v.slot))
        )
      );
    } catch {}
  }
  // Un solo JSON del campo per tutti; se non è cambiato niente (palla ferma, aste ferme) non si manda.
  broadcast(force = false) {
    const field = JSON.stringify(publicField(this.field)),
      occupied = JSON.stringify(this.seated().map(v => v.slot)),
      key = field + occupied + this.mode + !!this.timer;
    if (!force && key === this.last) return;
    this.last = key;
    for (const [ws, m] of this.viewers)
      try {
        ws.send(this.payload(m.slot, field, occupied));
      } catch {}
  }
}
