// Suoni del biliardo, sintetizzati con WebAudio (niente file).
// Ogni urto è un colpetto di rumore brevissimo che fa "suonare" dei risonatori (filtri stretti) accordati sul
// materiale: resina dura delle bilie (clack secco e acuto), cuoio della stecca (toc sordo), gomma delle sponde
// (tonfo morbido), legno dei birilli, cuoio delle buche. Così il suono nasce come quello vero: un impulso e il
// corpo che vibra per pochi millesimi di secondo. Niente fruscio continuo, un filo appena di eco della sala.
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
    this.out = c.createGain(); this.out.gain.value = 0.55;
    // compressore leggero: lo spacco (tanti urti insieme) non satura
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.001; comp.release.value = 0.08;
    this.out.connect(comp); comp.connect(c.destination);
    // eco della sala appena accennata: poche riflessioni corte
    const len = Math.floor(c.sampleRate * 0.28), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4) * 0.6;
    }
    const verb = c.createConvolver(); verb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.045;
    this.bus = c.createGain();
    this.bus.connect(this.out); this.bus.connect(verb); verb.connect(wet); wet.connect(this.out);
    // impulso: 3 ms di rumore che si spegne subito (la "botta")
    const n = Math.floor(c.sampleRate * 0.004);
    this.imp = c.createBuffer(1, n, c.sampleRate);
    const d = this.imp.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.22));
    // impulso morbido (gomma, cuoio, mano): più lungo e smussato
    const m = Math.floor(c.sampleRate * 0.012);
    this.soft = c.createBuffer(1, m, c.sampleRate);
    const s = this.soft.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < m; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.08; s[i] = lp * 6 * Math.sin((Math.PI * i) / m); }
  }
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('biliardo.snd', this.on ? '1' : '0'); } catch (e) { /* niente storage */ }
  }
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; }

  // un urto: impulso → risonatori [frequenza, Q, volume]; lp = taglio delle alte (materiali morbidi)
  knock(modes, vol, { when = 0, soft = false, lp = 0, direct = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + when;
    const src = c.createBufferSource(); src.buffer = soft ? this.soft : this.imp;
    let head = src;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5; src.connect(f); head = f; }
    for (const [freq, q, g] of modes) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      const gg = c.createGain(); gg.gain.value = vol * g * Math.sqrt(q); // un filtro stretto lascia passare poca energia: si compensa
      head.connect(bp); bp.connect(gg); gg.connect(this.bus);
    }
    if (direct) { const gd = c.createGain(); gd.gain.value = vol * direct; head.connect(gd); gd.connect(this.bus); }
    src.start(t);
  }

  // stecca sulla bilia: cuoio del puntale (toc sordo) + un filo di risonanza della bilia; sullo spacco più secco
  cue(power) {
    if (!this.ok()) return;
    const v = 0.25 + power * 0.75, k = 0.97 + Math.random() * 0.06;
    this.knock([[620 * k, 3, 0.9], [1250 * k, 5, 0.45], [2900 * k, 14, 0.18]], v, { soft: power < 0.6, lp: 3500, direct: 0.15 });
    if (power > 0.75) this.knock([[3300 * k, 18, 0.35], [5100 * k, 20, 0.2]], v * 0.6, { direct: 0.2 });
  }
  // bilia contro bilia: clack della resina fenolica, corto e brillante; più forte = più acuto e secco
  click(speed) {
    if (!this.ok()) return;
    const now = this.ctx.currentTime;
    if (now - this.last < 0.006) return; // lo spacco: troppi urti nello stesso istante
    this.last = now;
    const v = Math.min(1, 0.05 + Math.pow(speed, 0.8) * 0.28), k = 0.95 + Math.random() * 0.1 + Math.min(speed, 6) * 0.01;
    this.knock([[2350 * k, 22, 0.55], [3650 * k, 26, 0.5], [5300 * k, 28, 0.3], [7900 * k, 30, 0.15]], v, { direct: 0.35 });
  }
  // sponda: gomma sotto il panno (tonfo morbido) e il legno del bordo che risponde appena
  rail(speed) {
    if (!this.ok() || speed < 0.05) return;
    const v = Math.min(0.9, speed * 0.22), k = 0.95 + Math.random() * 0.1;
    this.knock([[150 * k, 2.5, 1], [340 * k, 4, 0.45], [780 * k, 7, 0.15]], v, { soft: true, lp: 1400 });
  }
  // in buca: la bilia batte sul cuoio della tasca, poi un paio di colpetti sordi mentre si ferma
  pocket(speed) {
    if (!this.ok()) return;
    const v = Math.min(0.9, 0.3 + speed * 0.18);
    this.knock([[210, 3, 1], [480, 5, 0.4]], v, { soft: true, lp: 1200 });
    for (let i = 0; i < 3; i++) {
      const w = 0.09 + i * 0.07 + Math.random() * 0.03;
      this.knock([[260 + Math.random() * 60, 4, 0.8], [1900, 16, 0.12]], v * 0.35 * Math.pow(0.6, i), { when: w, soft: true, lp: 2500 });
    }
  }
  // birillo che cade: legno leggero, poi rimbalza sul panno
  pin(speed) {
    if (!this.ok()) return;
    const v = Math.min(0.8, 0.25 + speed * 0.15), k = 0.95 + Math.random() * 0.1;
    this.knock([[1650 * k, 14, 0.7], [2750 * k, 16, 0.5], [4300 * k, 18, 0.25]], v, { direct: 0.2 });
    this.knock([[1400 * k, 10, 0.5], [2300 * k, 12, 0.3]], v * 0.4, { when: 0.06 + Math.random() * 0.04 });
    this.knock([[900, 6, 0.6]], v * 0.25, { when: 0.13 + Math.random() * 0.05, soft: true, lp: 2000 });
  }
  // boccette: la bilia lasciata dalla mano che si appoggia sul panno
  release(power) {
    if (!this.ok()) return;
    this.knock([[120, 2, 1], [260, 3, 0.4]], 0.15 + power * 0.35, { soft: true, lp: 700 });
  }
  // (il fruscio di rotolamento è stato tolto: disturbava)
  roll() {}
  // avvisi di gioco: brevi e discreti
  tone(freq, dur, vol, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  foul() { if (this.ok()) { this.tone(330, 0.22, 0.08); this.tone(247, 0.3, 0.07, 0.16); } }
  win() { if (this.ok()) [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.45, 0.09, i * 0.12)); }
  tick() { if (this.ok()) this.knock([[2600, 12, 0.5]], 0.12); }
}
