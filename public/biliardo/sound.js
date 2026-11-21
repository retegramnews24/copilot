// Suoni sintetizzati con WebAudio (niente file), costruiti sul suono vero:
// - bilia contro bilia: "clack" secco della resina fenolica (parziali acute, smorzate in pochi millisecondi)
// - stecca: "toc" del cuoio sul punto, più un corpo basso; sullo spacco anche lo schiocco del legno
// - sponda: tonfo morbido della gomma sotto il panno e il legno che vibra
// - buca: caduta nella tasca e le bilie che rotolano nella canala
// - rotolamento: fruscio continuo sul panno, proporzionale alla velocità delle bilie
// - un filo di eco della sala (riverbero) su tutto
export class Sfx {
  constructor() {
    this.ctx = null;
    this.on = true;
    try { this.on = localStorage.getItem('biliardo.snd') !== '0'; } catch (e) { /* niente storage */ }
    this.last = 0;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = 0.9;
    // compressore leggero: lo spacco non satura, i tocchi piccoli si sentono
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
    this.out.connect(comp); comp.connect(c.destination);
    // eco della sala: risposta all'impulso sintetica (rumore che decade)
    const len = Math.floor(c.sampleRate * 0.9), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < c.sampleRate * 0.012 ? 0.2 : 1);
    }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.16;
    this.bus = c.createGain(); // ingresso comune: diretto + riverbero
    this.bus.connect(this.out); this.bus.connect(this.verb); this.verb.connect(wet); wet.connect(this.out);
    // rumore bianco e rumore "rosa" per fruscii
    const n = c.sampleRate;
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, n * 2, c.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    // rotolamento: rumore bruno filtrato, volume guidato dal gioco
    const src = c.createBufferSource(); src.buffer = this.brown; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55;
    this.rollGain = c.createGain(); this.rollGain.gain.value = 0;
    this.rollLp = lp;
    src.connect(hp); hp.connect(lp); lp.connect(this.rollGain); this.rollGain.connect(this.out);
    src.start();
  }
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('biliardo.snd', this.on ? '1' : '0'); } catch (e) { /* niente storage */ }
    if (!this.on && this.rollGain) this.rollGain.gain.value = 0;
  }
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; }

  // parziale smorzata (sinusoide che si spegne)
  mode(freq, dur, vol, when = 0, type = 'sine', glide = 1) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // colpo di rumore filtrato
  hit(dur, vol, freq, q = 1, when = 0, type = 'bandpass', buf = this.noise) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.0006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // stecca sulla bilia: cuoio del puntale + legno; con tanta forza (spacco) uno schiocco in più
  cue(power) {
    if (!this.ok()) return;
    const v = 0.12 + power * 0.55;
    this.hit(0.012, v, 2200, 0.9);
    this.mode(950 + Math.random() * 80, 0.018, v * 0.5);
    this.mode(240, 0.045, v * 0.45, 0, 'sine', 0.8);
    if (power > 0.7) this.hit(0.03, v * 0.6, 4200, 1.5, 0.002, 'highpass');
  }
  // bilia contro bilia
  click(speed) {
    if (!this.ok()) return;
    const now = this.ctx.currentTime;
    if (now - this.last < 0.008) return; // troppi urti insieme (lo spacco): non saturare
    this.last = now;
    const v = Math.min(0.95, 0.03 + Math.pow(speed, 0.85) * 0.2);
    const k = 0.94 + Math.random() * 0.12;
    // parziali inarmoniche di una sfera dura, che si spengono quasi subito
    this.mode(3150 * k, 0.012 + speed * 0.002, v * 0.7);
    this.mode(5280 * k, 0.008, v * 0.45);
    this.mode(7400 * k, 0.005, v * 0.3);
    this.mode(1450 * k, 0.02, v * 0.25);
    this.hit(0.004, v * 0.6, 6000, 0.8, 0, 'highpass');
  }
  // sponda: gomma + legno
  rail(speed) {
    if (!this.ok() || speed < 0.05) return;
    const v = Math.min(0.7, speed * 0.17);
    this.mode(118 + Math.random() * 20, 0.09, v, 0, 'sine', 0.75);
    this.hit(0.05, v * 0.55, 420, 0.8, 0, 'lowpass');
    this.mode(330, 0.03, v * 0.18);
  }
  // in buca: urto sul cuoio, caduta, rotolata nella canala
  pocket(speed) {
    if (!this.ok()) return;
    const v = Math.min(0.75, 0.22 + speed * 0.14);
    this.hit(0.03, v * 0.6, 700, 1, 0, 'lowpass');
    this.mode(150, 0.12, v * 0.7, 0.01, 'sine', 0.6);
    for (let i = 0; i < 6; i++) {
      const t = 0.14 + i * 0.075 + Math.random() * 0.02, a = v * 0.32 * Math.pow(0.78, i);
      this.mode(2400 + Math.random() * 500, 0.008, a, t);
      this.hit(0.03, a * 0.6, 260, 1, t, 'lowpass', this.brown);
    }
  }
  // birillo che cade: legno leggero, poi rimbalza sul panno
  pin(speed) {
    if (!this.ok()) return;
    const v = Math.min(0.55, 0.15 + speed * 0.12);
    this.mode(1850 + Math.random() * 300, 0.025, v * 0.6);
    this.mode(3900, 0.01, v * 0.35);
    this.mode(1300, 0.02, v * 0.25, 0.07 + Math.random() * 0.03);
    this.hit(0.04, v * 0.3, 900, 1, 0.1, 'lowpass');
  }
  // boccette: la bilia lasciata dalla mano che tocca il panno
  release(power) {
    if (!this.ok()) return;
    const v = 0.08 + power * 0.25;
    this.hit(0.06, v, 300, 0.8, 0, 'lowpass', this.brown);
    this.mode(95, 0.07, v * 0.6, 0, 'sine', 0.8);
  }
  // fruscio di rotolamento: livello = somma delle velocità delle bilie in movimento
  roll(level) {
    if (!this.ctx || !this.rollGain) return;
    const g = this.ok() ? Math.min(0.5, Math.sqrt(level) * 0.22) : 0;
    const t = this.ctx.currentTime;
    this.rollGain.gain.setTargetAtTime(g, t, 0.05);
    this.rollLp.frequency.setTargetAtTime(220 + Math.min(level, 6) * 60, t, 0.08);
  }
  foul() { if (this.ok()) { this.mode(330, 0.2, 0.12, 0, 'triangle', 0.8); this.mode(247, 0.28, 0.1, 0.16, 'triangle', 0.8); } }
  win() { if (this.ok()) [523, 659, 784, 1046].forEach((f, i) => this.mode(f, 0.45, 0.13, i * 0.12, 'triangle')); }
  tick() { if (this.ok()) this.mode(1800, 0.015, 0.05); }
}
