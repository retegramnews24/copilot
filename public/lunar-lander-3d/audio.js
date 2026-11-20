export function createSound() {
  let context, noise, motor, muted = false, volume = 0;

  function unlock() {
    if (muted) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

        const source = context.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 125;
        motor = context.createGain();
        motor.gain.value = 0;
        source.connect(filter).connect(motor).connect(context.destination);
        source.start();
      }
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // Audio is optional in hosts that restrict Web Audio.
    }
  }

  function thrust(power) {
    if (!motor) return;
    const next = muted ? 0 : power * 0.085;
    if (next === volume) return;
    volume = next;
    motor.gain.setTargetAtTime(volume, context.currentTime, 0.12);
  }

  function crash() {
    if (muted || context?.state !== 'running' || !noise) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(510, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.46);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
    source.stop(now + 0.6);
  }

  function toggle() {
    muted = !muted;
    if (muted) thrust(0);
    else unlock();
    return !muted;
  }

  return { unlock, thrust, crash, toggle };
}
