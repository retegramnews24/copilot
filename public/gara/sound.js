// Suoni della gara, creati al momento con Web Audio: nessun file da scaricare.
// Il browser li permette solo dopo il primo tocco: unlock() va chiamato su un tocco.

const KEY = 'gara.audio';

export class Sfx {
  constructor() {
    this.ctx = null;
    let on = true;
    try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* senza memoria del browser: audio acceso */ }
    this.on = on;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.7 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setOn(v) {
    this.on = v;
    try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* niente */ }
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  ready() { return this.ctx && this.on && this.ctx.state === 'running'; }

  noiseBuf() {
    if (!this.nb) {
      const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.nb = b;
    }
    return this.nb;
  }

  noise(t0, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf(); s.loop = true;
    s.start(t0, Math.random()); s.stop(t0 + dur);
    return s;
  }

  env(g, t0, a, peak, d, end) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.setValueAtTime(peak, t0 + Math.max(a, end - d));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + end);
  }

  // motore: due onde a dente di sega filtrate; sale di giri durante la mossa, più acuto con le marce alte
  engine(gear, ms) {
    if (!this.ready()) return;
    const c = this.ctx, t0 = c.currentTime, dur = ms / 1000 + 0.15, g = Math.max(1, gear);
    const base = 48 + g * 16, out = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700 + g * 180; lp.Q.value = 3;
    this.env(out, t0, 0.05, 0.22, 0.25, dur);
    lp.connect(out); out.connect(this.master);
    for (const [mul, det] of [[1, 0], [1.5, 7], [0.5, -5]]) {
      const o = c.createOscillator();
      o.type = mul === 1.5 ? 'square' : 'sawtooth'; o.detune.value = det;
      o.frequency.setValueAtTime(base * mul, t0);
      o.frequency.exponentialRampToValueAtTime(base * mul * (1.45 + g * 0.04), t0 + dur * 0.55);
      o.frequency.exponentialRampToValueAtTime(base * mul * 1.15, t0 + dur);
      const og = c.createGain(); og.gain.value = mul === 1 ? 0.6 : 0.25;
      o.connect(og); og.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    // vibrazione dei pistoni
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 18 + g * 4; lg.gain.value = 0.08;
    lfo.connect(lg); lg.connect(out.gain); lfo.start(t0); lfo.stop(t0 + dur);
  }

  // motore continuo (Sprint): resta acceso e cambia giri e carico in tempo reale.
  // Tre onde (fondamentale, sottarmonica, armonica) filtrate, pulsazione dei cilindri, un filo di rumore d'aspirazione.
  // Restituisce { set(giri 0..1, carico 0..1, volume 0..1), stop() }.
  makeEngine() {
    if (!this.ctx) return null;
    const c = this.ctx, t0 = c.currentTime;
    const out = c.createGain(), lp = c.createBiquadFilter(), shaper = c.createWaveShaper(), pulse = c.createGain();
    out.gain.value = 0.0001;
    lp.type = 'lowpass'; lp.Q.value = 2.2; lp.frequency.value = 800;
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; curve[i] = Math.tanh(x * 2.2); }
    shaper.curve = curve;
    pulse.gain.value = 0.75;
    const oscs = [[1, 'sawtooth', 0.5, 0], [0.5, 'square', 0.32, -6], [2, 'sawtooth', 0.16, 9]].map(([mul, type, vol, det]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.detune.value = det; g.gain.value = vol;
      o.connect(g); g.connect(shaper); o.start(t0);
      return { o, mul };
    });
    shaper.connect(lp); lp.connect(pulse); pulse.connect(out); out.connect(this.master);
    // pulsazione dei cilindri: modula il volume alla frequenza degli scoppi
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.type = 'triangle'; lfoG.gain.value = 0.25; lfo.connect(lfoG); lfoG.connect(pulse.gain); lfo.start(t0);
    // aspirazione: rumore filtrato che cresce con il carico
    const nz = this.noise(t0, 3600), bp = c.createBiquadFilter(), ng = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.value = 1200; ng.gain.value = 0;
    nz.connect(bp); bp.connect(ng); ng.connect(out);
    let alive = true;
    return {
      set: (rpm, load, vol = 1) => {
        if (!alive) return;
        const t = c.currentTime, f = 42 + rpm * 210, k = 0.035;
        for (const { o, mul } of oscs) o.frequency.setTargetAtTime(f * mul, t, k);
        lfo.frequency.setTargetAtTime(f * 0.5, t, k);
        lp.frequency.setTargetAtTime(500 + rpm * 2400 + load * 900, t, k);
        bp.frequency.setTargetAtTime(900 + rpm * 1800, t, k);
        ng.gain.setTargetAtTime(0.05 * load * vol, t, 0.08);
        out.gain.setTargetAtTime(Math.max(0.0001, vol * (0.07 + 0.07 * load + 0.04 * rpm)), t, 0.06);
      },
      stop: () => {
        if (!alive) return;
        alive = false;
        const t = c.currentTime;
        out.gain.setTargetAtTime(0.0001, t, 0.08);
        for (const { o } of oscs) o.stop(t + 0.4);
        lfo.stop(t + 0.4); nz.stop(t + 0.4);
        setTimeout(() => out.disconnect(), 600);
      }
    };
  }

  // cambio marcia: un piccolo colpo meccanico
  shift(up) {
    if (!this.ready()) return;
    const c = this.ctx, t0 = c.currentTime, hp = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = up ? 1800 : 1200;
    this.env(g, t0, 0.002, 0.06, 0.03, 0.05);
    this.noise(t0, 0.06).connect(hp); hp.connect(g); g.connect(this.master);
  }

  // stridio delle gomme quando si scala
  skid(ms) {
    if (!this.ready()) return;
    const c = this.ctx, t0 = c.currentTime + (ms / 1000) * 0.35, dur = (ms / 1000) * 0.6;
    const bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(2300, t0); bp.frequency.linearRampToValueAtTime(1600, t0 + dur); bp.Q.value = 6;
    this.env(g, t0, 0.04, 0.14, 0.2, dur);
    this.noise(t0, dur).connect(bp); bp.connect(g); g.connect(this.master);
  }

  // urto: botto sordo, rumore che si spegne e un colpo metallico
  crash() {
    if (!this.ready()) return;
    const c = this.ctx, t0 = c.currentTime;
    const lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t0); lp.frequency.exponentialRampToValueAtTime(300, t0 + 0.7);
    this.env(g, t0, 0.005, 0.8, 0.6, 0.75);
    this.noise(t0, 0.8).connect(lp); lp.connect(g); g.connect(this.master);
    const th = c.createOscillator(), tg = c.createGain();
    th.frequency.setValueAtTime(120, t0); th.frequency.exponentialRampToValueAtTime(40, t0 + 0.3);
    this.env(tg, t0, 0.005, 0.9, 0.25, 0.35);
    th.connect(tg); tg.connect(this.master); th.start(t0); th.stop(t0 + 0.4);
    for (const f of [420, 610, 890]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(f, t0 + 0.02); o.frequency.exponentialRampToValueAtTime(f * 0.6, t0 + 0.35);
      this.env(og, t0 + 0.02, 0.003, 0.05, 0.3, 0.4);
      o.connect(og); og.connect(this.master); o.start(t0 + 0.02); o.stop(t0 + 0.45);
    }
  }

  tone(f, t0, dur, type = 'triangle', vol = 0.18) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    this.env(g, t0, 0.01, vol, Math.min(0.15, dur * 0.6), dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // passaggio sulla linea: doppio bip
  line() {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    this.tone(880, t0, 0.1, 'sine', 0.2); this.tone(1320, t0 + 0.12, 0.16, 'sine', 0.2);
  }

  // semaforo: bip basso per ogni luce rossa, bip alto e lungo quando diventa verde
  light(green) {
    if (!this.ready()) return;
    this.tone(green ? 880 : 440, this.ctx.currentTime, green ? 0.5 : 0.16, 'square', 0.12);
  }

  // turno saltato: due note che scendono
  skip() {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    this.tone(330, t0, 0.14, 'triangle', 0.14); this.tone(247, t0 + 0.16, 0.2, 'triangle', 0.14);
  }

  // tocco sui dischi e sulle caselle
  tick(hi) {
    if (!this.ready()) return;
    this.tone(hi ? 1400 : 1000, this.ctx.currentTime, 0.05, 'sine', 0.08);
  }

  // vittoria: fanfara, pubblico che esulta e applausi
  win() {
    if (!this.ready()) return;
    const c = this.ctx, t0 = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t0 + i * 0.14, i === 3 ? 0.6 : 0.13, 'triangle', 0.2));
    const bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.6); g.gain.setValueAtTime(0.25, t0 + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
    this.noise(t0, 3.3).connect(bp); bp.connect(g); g.connect(this.master);
    for (let k = 0; k < 40; k++) {
      const tk = t0 + 0.3 + Math.random() * 2.6, hp = c.createBiquadFilter(), cg = c.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 1500;
      this.env(cg, tk, 0.002, 0.12 + Math.random() * 0.1, 0.03, 0.05);
      this.noise(tk, 0.06).connect(hp); hp.connect(cg); cg.connect(this.master);
    }
  }
}
