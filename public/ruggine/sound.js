// Suoni di Ruggine 89 (WebAudio, niente file): motore che sale di giri, colpi, impatti, sterzate, semaforo.
// Partono spenti se in Impostazioni «Suoni» è spento (analisi 10.12); il tasto del gioco li riaccende.
import { soundAllowed } from '../sound-pref.js';
export class Sfx {
  constructor() {
    this.ctx = null;
    this.on = true;
    try { this.on = localStorage.getItem('ruggine.snd') !== '0'; } catch (e) { /* niente storage */ }
    if (!soundAllowed()) this.on = false;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.on ? 0.5 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.out.connect(comp); comp.connect(c.destination);
    const n = c.sampleRate;
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // motore: due seghe stonate + rumore, filtrate; la frequenza segue i giri
    this.eng = c.createGain(); this.eng.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    const g2 = c.createGain(); g2.gain.value = 0.35;
    this.o1.connect(lp); this.o2.connect(g2); g2.connect(lp); lp.connect(this.eng); this.eng.connect(this.out);
    this.o1.start(); this.o2.start(); this.lp = lp;
    // stridio delle gomme
    const sn = c.createBufferSource(); sn.buffer = this.noise; sn.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 6;
    this.screech = c.createGain(); this.screech.gain.value = 0;
    sn.connect(bp); bp.connect(this.screech); this.screech.connect(this.out); sn.start();
  }
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('ruggine.snd', this.on ? '1' : '0'); } catch (e) { /* niente storage */ }
    if (this.out) this.out.gain.value = this.on ? 0.5 : 0;
  }
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; }
  engine(speed, gas, slide, running) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, rpm = 0.25 + Math.min(1, Math.abs(speed) / 30);
    // cambio: i giri salgono e ricadono su tre marce
    const gear = rpm < 0.5 ? rpm / 0.5 : rpm < 0.78 ? (rpm - 0.5) / 0.28 : (rpm - 0.78) / 0.22;
    const f = 48 + gear * 70 + rpm * 40;
    this.o1.frequency.setTargetAtTime(f, t, 0.05); this.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
    this.lp.frequency.setTargetAtTime(500 + rpm * 1400 + (gas ? 500 : 0), t, 0.08);
    this.eng.gain.setTargetAtTime(running ? 0.08 + (gas ? 0.07 : 0) : 0, t, 0.1);
    this.screech.gain.setTargetAtTime(running && slide > 3 ? Math.min(0.12, (slide - 3) * 0.03) : 0, t, 0.06);
  }
  burst(dur, vol, freq, type = 'bandpass', q = 1, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  tone(freq, dur, vol, type = 'sine', when = 0, glide = 1) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  shot(near = 1) { if (this.ok()) { this.tone(900, 0.16, 0.16 * near, 'sawtooth', 0, 0.25); this.burst(0.08, 0.12 * near, 3000, 'highpass'); } }
  hit() { if (this.ok()) { this.burst(0.25, 0.4, 900, 'bandpass', 0.8); this.tone(140, 0.3, 0.3, 'triangle', 0, 0.5); } }
  crash(s) { if (this.ok()) { const v = Math.min(0.5, s * 0.05); this.burst(0.18, v, 400, 'lowpass'); this.tone(90, 0.2, v, 'sine', 0, 0.6); } }
  beep(go) { if (this.ok()) this.tone(go ? 880 : 440, go ? 0.5 : 0.22, 0.2, 'square'); }
  pickup() { if (this.ok()) [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 0.12, 'triangle', i * 0.06)); }
  win() { if (this.ok()) [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 0.14, 'triangle', i * 0.14)); }
}
