// Zona Operativa: suoni fatti nel codice con Web Audio (niente file, niente suoni presi da altri giochi).
// Rispettano l'interruttore «Suoni» delle Impostazioni (sound-pref.js) e il volume del menù.
import { soundAllowed } from '../sound-pref.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let volume = 0.8;

function ensure() {
  if (!soundAllowed()) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

export function unlockAudio() {
  ensure();
}

function noise(t, dur, freq, q, gain, type = 'lowpass') {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(t, dur, f0, f1, gain, type = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Ogni arma ha la sua voce: scoppio (rumore filtrato) + colpo basso + coda.
const VOICE = {
  baretta: { crack: [3200, 0.09, 0.9], thump: [160, 60, 0.12, 0.7], tail: [900, 0.25, 0.25] },
  calabrone: { crack: [2600, 0.07, 0.7], thump: [140, 70, 0.08, 0.5], tail: [700, 0.18, 0.18] },
  tuono: { crack: [1400, 0.22, 1.0], thump: [90, 35, 0.25, 1.0], tail: [400, 0.6, 0.5] },
  ruggito: { crack: [2200, 0.1, 0.9], thump: [120, 45, 0.14, 0.8], tail: [600, 0.35, 0.3] },
  falco: { crack: [1800, 0.18, 1.0], thump: [70, 30, 0.3, 1.0], tail: [350, 1.2, 0.45] }
};

export function shot(weapon) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  if (weapon === 'coltello') {
    noise(t, 0.12, 2500, 1.5, 0.35, 'bandpass');
    return;
  }
  const v = VOICE[weapon];
  noise(t, v.crack[1], v.crack[0], 0.8, v.crack[2]);
  tone(t, v.thump[2], v.thump[0], v.thump[1], v.thump[3]);
  noise(t + 0.02, v.tail[1], v.tail[0], 0.5, v.tail[2]);
}

export function click() {
  if (!ensure()) return;
  const t = ctx.currentTime;
  tone(t, 0.03, 1800, 1200, 0.25, 'square');
}

export function reload(weapon) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const clack = (dt, f) => {
    noise(t + dt, 0.05, f, 4, 0.4, 'bandpass');
    tone(t + dt, 0.04, f / 2, f / 3, 0.15, 'triangle');
  };
  if (weapon === 'tuono') clack(0.15, 1500);
  else if (weapon === 'falco') {
    clack(0.3, 1200);
    clack(0.9, 1600);
    clack(1.8, 1300);
  } else {
    clack(0.25, 1100);
    clack(0.9, 1500);
    clack(1.3, 1900);
  }
}

export function pump() {
  if (!ensure()) return;
  const t = ctx.currentTime;
  noise(t + 0.2, 0.06, 900, 3, 0.4, 'bandpass');
  noise(t + 0.42, 0.06, 1300, 3, 0.45, 'bandpass');
}

// sagoma colpita: «tac» del cartone, più acuto in testa
export function targetHit(zone) {
  if (!ensure()) return;
  const t = ctx.currentTime + 0.03;
  noise(t, 0.06, zone === 'testa' ? 3500 : 1800, 3, 0.5, 'bandpass');
  if (zone === 'testa') tone(t, 0.18, 1400, 1300, 0.12, 'triangle');
}

export function pickup() {
  if (!ensure()) return;
  const t = ctx.currentTime;
  noise(t, 0.08, 1200, 2, 0.3, 'bandpass');
  tone(t + 0.05, 0.08, 600, 900, 0.1, 'triangle');
}

export function step() {
  if (!ensure()) return;
  noise(ctx.currentTime, 0.07, 400, 1, 0.12);
}
