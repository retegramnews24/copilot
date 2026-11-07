export class TrialAudio {
  constructor() {
    this.enabled = true;
  }

  resume() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!this.ctx) {
      const ctx = this.ctx = new Audio();
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      this.engine = ctx.createGain();
      this.engine.gain.value = 0;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 140;
      this.filter.Q.value = .7;
      this.filter.connect(this.engine).connect(this.master);
      this.oscillators = ['sawtooth', 'triangle'].map((type, i) => {
        const oscillator = ctx.createOscillator(), mix = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.value = i ? 49 : 24;
        mix.gain.value = i ? .25 : .7;
        oscillator.connect(mix).connect(this.filter);
        oscillator.start();
        return oscillator;
      });
      const buffer = this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .3), ctx.sampleRate);
      const noise = buffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    }
    this.ctx.resume().catch(() => {});
    this.master.gain.setTargetAtTime(.65, this.ctx.currentTime, .035);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.resume();
    else if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .025);
  }

  update(active, speed = 0, throttle = false, airborne = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const rev = 24 + Math.abs(speed) * 3.1 + (throttle ? (airborne ? 30 : 19) : 0);
    this.engine.gain.setTargetAtTime(active ? (throttle ? .13 : .048) : 0, now, active ? .09 : .035);
    this.filter.frequency.setTargetAtTime(throttle ? 335 + rev * 2.7 : 155 + rev, now, .075);
    this.oscillators.forEach((voice, i) => voice.frequency.setTargetAtTime(rev * (i ? 2.02 : 1), now, .085));
  }

  surface(landing, impact = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, now = ctx.currentTime, duration = landing ? .22 : .15;
    const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    noise.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(landing ? 670 : 210, now);
    filter.frequency.exponentialRampToValueAtTime(landing ? 110 : 810, now + duration);
    envelope.gain.setValueAtTime(.001, now);
    envelope.gain.exponentialRampToValueAtTime(landing ? .10 + Math.min(14, impact) * .012 : .092, now + .014);
    envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
    noise.connect(filter).connect(envelope).connect(this.master);
    noise.start(now);
    noise.stop(now + duration);
    if (landing) {
      const bass = ctx.createOscillator(), bounce = ctx.createGain();
      bass.frequency.setValueAtTime(82, now);
      bass.frequency.exponentialRampToValueAtTime(39, now + .13);
      bounce.gain.setValueAtTime(.095, now);
      bounce.gain.exponentialRampToValueAtTime(.001, now + .14);
      bass.connect(bounce).connect(this.master);
      bass.start(now);
      bass.stop(now + .15);
    }
  }

  close() {
    this.ctx?.close().catch(() => {});
  }
}
