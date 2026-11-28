// Macchinette della Lobby 3D (caffè e snack, carrello dei popcorn, hot dog): una persona alla volta, e tutti vedono
// quello che fa. Chi la usa lo dice nella posa: use = {m: quale macchinetta, k: scelta o codice che sta
// scrivendo, n: ordini fatti, t: prodotti presi}. Il server lo lascia passare solo se nessun altro, collegato e nel
// club, la sta già usando: chi arriva dopo non la ottiene e il suo telefono, vedendo l'altro, esce. Chi va via
// mentre prepara lascia l'ordine nella posa (orders, machineOrders).
// 'coin' è la macchinetta cambia-gettoni sul mobile della radio (docs/gettoni.md): k è 1, 5 o 10 (BTN cambiati)
export const MACHINES = ['vend', 'pop', 'dog', 'coin'];
const person = a => a?.memberId || a?.user?.id || null;
const live = (o, now) => !!o && !o.closed && !!o.inClub && now - (o.seen || now) < 65000;

export function machineUse(pose, me, others, now = Date.now()) {
  const u = pose?.use;
  if (!u || pose.station !== 'walk' || !MACHINES.includes(u.m)) return undefined;
  const k = typeof u.k === 'string' && /^[a-z0-9-]{0,12}$/i.test(u.k) ? u.k : '';
  const count = v => (Number.isInteger(v) && v > 0 ? v % 1e9 : 0);
  const busy = others.some(
    o => o !== me && live(o, now) && o.clubPose?.use?.m === u.m && !(person(o) && person(o) === person(me))
  );
  return busy ? undefined : { m: u.m, k, n: count(u.n), t: count(u.t) };
}

// ordini lasciati: chi va via mentre la macchinetta prepara lascia l'ordine (m, k, n come in use) finché è nel club;
// la macchinetta finisce per tutti e chiunque passi può ritirare il prodotto. Al massimo uno per macchinetta.
export function machineOrders(list) {
  if (!Array.isArray(list)) return undefined;
  const out = [];
  for (const o of list.slice(0, MACHINES.length)) {
    if (!o || !MACHINES.includes(o.m) || out.some(x => x.m === o.m)) continue;
    if (!Number.isInteger(o.n) || o.n < 1 || typeof o.k !== 'string' || !/^[a-z0-9-]{0,12}$/i.test(o.k)) continue;
    out.push({ m: o.m, k: o.k, n: o.n % 1e9 });
  }
  return out.length ? out : undefined;
}

// prodotto in mano (solo visivo): quale, quanti morsi o sorsi restano, quanti fatti. I popcorn si mangiano in sei
// manciate, l'hot dog in quattro morsi (id «hotdog-» più tipo e salse, es. «hotdog-vsk»), il resto in tre.
export function heldSnack(s) {
  if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]{1,16}$/i.test(s.id)) return undefined;
  const max = s.id === 'popcorn' ? 6 : /^hotdog-[cv]m?s?k?$/.test(s.id) ? 4 : 3;
  if (!Number.isInteger(s.left) || s.left < 1 || s.left > max) return undefined;
  return { id: s.id, left: s.left, n: Number.isInteger(s.n) ? Math.max(0, s.n) % 1e9 : 0 };
}
// la bibita del carrello nell'altra mano, o nel portabicchiere del divanetto (cup: 1) da seduti al cinema
export function heldDrink(d) {
  if (!d || d.id !== 'cola' || !Number.isInteger(d.left) || d.left < 1 || d.left > 4) return undefined;
  return {
    id: 'cola',
    left: d.left,
    n: Number.isInteger(d.n) ? Math.max(0, d.n) % 1e9 : 0,
    ...(d.cup ? { cup: 1 } : {})
  };
}
