// Suoni del calcio balilla presi da due registrazioni vere (sounds/): la pallina che entra dal foro
// e una partita al tavolo. Per ogni colpo un pezzo [file, inizio s, durata s, volume], scelto ascoltandoli.
const FILES = { rimessa: 'sounds/balilla-rimessa.mp3', partita: 'sounds/balilla-partita.mp3' };
const PIECES = {
  throw: ['rimessa', 0.17, 0.9, 0.9],
  kick: ['partita', 7.345, 0.1, 1],
  stop: ['partita', 1.385, 0.07, 1.2],
  rail: ['partita', 7.06, 0.2, 1.6],
  post: ['partita', 3.75, 0.22, 0.7],
  goal: ['partita', 8.21, 0.6, 1.3]
};
const buffers = {};
let loading = null;
export function loadBalillaSounds(ctx) {
  if (!loading)
    loading = Promise.all(
      Object.entries(FILES).map(async ([k, file]) => {
        const res = await fetch(new URL(file, import.meta.url));
        buffers[k] = await ctx.decodeAudioData(await res.arrayBuffer());
      })
    ).catch(() => {
      loading = null;
    });
  return loading;
}
// Suona il pezzo del colpo sull'uscita data; false se non è pronto (allora resta il suono sintetizzato).
export function playBalillaSound(ctx, out, type, power = 0.6) {
  const piece = PIECES[type];
  if (!piece) return false;
  const buf = buffers[piece[0]];
  if (!buf) {
    loadBalillaSounds(ctx);
    return false;
  }
  const [, off, dur, vol] = piece,
    now = ctx.currentTime;
  const src = ctx.createBufferSource(),
    g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = 0.94 + Math.random() * 0.12; // ogni colpo un filo diverso
  const level = vol * (0.3 + 0.7 * Math.max(0, Math.min(1, power)));
  g.gain.setValueAtTime(level, now);
  g.gain.setValueAtTime(level, now + Math.max(0, dur - 0.025));
  g.gain.linearRampToValueAtTime(0.0001, now + dur);
  src.connect(g).connect(out);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
  };
  src.start(now, off, dur + 0.01);
  return true;
}
