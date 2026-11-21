// Biliardo online: creazione, ingresso, turni, colpi rifatti uguali sul telefono, pilota automatico, fine partita.
// Più le quattro specialità giocate dal computer fino alla fine (regole e fisica senza errori).
import assert from 'node:assert/strict';
import * as E from '../public/biliardo/engine.js';
import { plan } from '../public/biliardo/ai.js';
import {
  makeMatch,
  joinMatch,
  leaveMatch,
  startMatch,
  playMatch,
  advanceMatch,
  cleanShot,
  shooter
} from '../biliardo-server.js';

const anna = { player: 'p-anna', name: 'Anna' },
  bruno = { player: 'p-bruno', name: 'Bruno' },
  carla = { player: 'p-carla', name: 'Carla' },
  dario = { player: 'p-dario', name: 'Dario' },
  elena = { player: 'p-elena', name: 'Elena' };
let now = 1000;

// ---- a squadre: 4 giocatori (2 contro 2) e 3 giocatori (2 contro 1); chi arriva dopo guarda ----
{
  const t = makeMatch('room-t', 9, anna, 0, { variant: 'italiana', players: 4, seed: 2 });
  assert.equal(t.capacity, 4);
  assert.equal(makeMatch('r', 1, anna, 0, { variant: 'otto', players: 9 }).capacity, 2);
  joinMatch(t, bruno);
  joinMatch(t, carla);
  joinMatch(t, dario);
  assert.throws(() => joinMatch(t, elena), /completo/);
  startMatch(t, anna.player, 0);
  // squadre: Anna e Carla contro Bruno e Dario
  assert.deepEqual(
    t.match.players.map(p => p.name),
    ['Anna e Carla', 'Bruno e Dario']
  );
  // Elena guarda: non può tirare
  assert.throws(() => playMatch(t, elena.player, { dx: 1, dz: 0, speed: 2 }, 1), /Stai guardando/);
  // i compagni si alternano ogni volta che la squadra riprende il tavolo (5 birilli: un colpo a testa)
  const order = [];
  for (let i = 0; i < 8; i++) {
    const who = shooter(t);
    order.push(who);
    const other = t.seats.find(s => s !== who);
    assert.throws(() => playMatch(t, other, E.autoShot(t.match), 2 + i), /Non tocca a te|Stai guardando/);
    playMatch(t, who, E.autoShot(t.match), 2 + i);
    if (t.phase !== 'playing') break;
  }
  const sideA = ['p-anna', 'p-carla'],
    sideB = ['p-bruno', 'p-dario'];
  // si alternano le squadre e, dentro ogni squadra, i compagni
  for (let i = 0; i + 2 < order.length; i++)
    assert.notEqual(order[i], order[i + 2], 'il compagno successivo');
  for (let i = 0; i + 1 < order.length; i++)
    assert.notEqual(sideA.includes(order[i]), sideA.includes(order[i + 1]), 'squadre alternate');
  assert.ok(order.every(id => sideA.includes(id) || sideB.includes(id)));
  // vince tutta la squadra
  const g = makeMatch('room-w', 2, anna, 0, { variant: 'italiana', players: 4, target: 25, seed: 4 });
  [bruno, carla, dario].forEach(u => joinMatch(g, u));
  startMatch(g, anna.player, 0);
  for (let i = 0; i < 400 && g.phase === 'playing'; i++) playMatch(g, shooter(g), E.autoShot(g.match), i);
  if (!g.abandoned) assert.equal(g.winners.length, 2, 'due vincitori');
  // 2 contro 1: chi è da solo tira ogni volta che tocca alla sua squadra
  const three = makeMatch('room-3', 3, anna, 0, { variant: 'otto', players: 3, seed: 6 });
  joinMatch(three, bruno);
  joinMatch(three, carla);
  assert.equal(three.phase, 'waiting');
  startMatch(three, anna.player, 0);
  assert.deepEqual(
    three.match.players.map(p => p.name),
    ['Anna e Carla', 'Bruno']
  );
  // chi l'ha creata può partire anche prima che i posti siano pieni (qui: 3 su 4 → 2 contro 1)
  const early = makeMatch('room-e', 4, anna, 0, { variant: 'snooker', players: 4 });
  joinMatch(early, bruno);
  joinMatch(early, carla);
  startMatch(early, anna.player, 0);
  assert.equal(early.seats.length, 3);
}

// creazione: specialità e opzioni controllate
assert.throws(() => makeMatch('r', 1, anna, now, { variant: 'bowling' }), /Specialità/);
const m = makeMatch('room-1', 3, anna, now, { variant: 'otto', seed: 12345 });
assert.equal(m.phase, 'waiting');
assert.equal(makeMatch('r', 1, anna, now, { variant: 'italiana', target: 999 }).opts.target, 60);
assert.equal(makeMatch('r', 1, anna, now, { variant: 'boccette', target: 50 }).opts.target, 50);
assert.equal(makeMatch('r', 1, anna, now, { variant: 'snooker', reds: 15 }).opts.reds, 15);
// il panno è della partita: quello di chi crea, uguale per tutti; un valore strano diventa verde
assert.equal(makeMatch('r', 1, anna, now, { variant: 'otto', cloth: 'viola' }).opts.cloth, 'viola');
assert.equal(makeMatch('r', 1, anna, now, { variant: 'otto', cloth: '<rosa>' }).opts.cloth, 'verde');
assert.equal(makeMatch('r', 1, anna, now, { variant: 'otto' }).opts.cloth, 'verde');

// ingresso: una volta sola, non oltre due; chi entra può uscire, chi crea no
assert.equal(joinMatch(m, anna), false);
assert.throws(() => startMatch(m, anna.player, now), /avversario/);
assert.equal(joinMatch(m, bruno), true);
assert.throws(() => joinMatch(m, carla), /completo/);
assert.equal(leaveMatch(m, bruno.player), true);
assert.throws(() => leaveMatch(m, anna.player), /chiude/);
joinMatch(m, bruno);
assert.throws(() => startMatch(m, bruno.player, now), /Solo chi/);
startMatch(m, anna.player, now);
assert.equal(m.phase, 'playing');
assert.deepEqual(m.seats, ['p-anna', 'p-bruno']);

// colpi: solo chi è di turno, solo numeri nei limiti
const turnId = () => m.seats[m.match.cur];
const other = () => m.seats[1 - m.match.cur];
assert.throws(() => playMatch(m, other(), { dx: 1, dz: 0, speed: 3 }, now), /Non tocca/);
assert.throws(() => cleanShot({ dx: 'a', dz: 0, speed: 3 }), /non valido/);
assert.throws(() => cleanShot({ dx: 1, dz: 0, speed: 50 }), /non valido/);
assert.throws(
  () => playMatch(m, turnId(), { dx: 1, dz: 0, speed: 3, px: 1.0, pz: 0 }, now),
  /non si può mettere/
);

// lo spacco; poi il telefono rifà il colpo da "prev" e ottiene esattamente lo stesso tavolo
playMatch(m, turnId(), { dx: 1, dz: 0.0021, speed: 6.4, sy: 0.1, sx: 0, px: -0.66, pz: 0.03 }, (now += 5000));
assert.equal(m.n, 1);
const replay = JSON.parse(JSON.stringify(m.prev));
E.playShot(replay, m.last.input);
assert.deepEqual(replay.balls, m.match.balls, 'stessa fisica sul telefono e sul server');
assert.deepEqual(replay.scores, m.match.scores);

// tempo scaduto: tira il pilota automatico; se nessuno gioca più la partita si chiude
now = m.turnAt + 1;
assert.equal(advanceMatch(m, now), true);
assert.equal(m.last.auto, true);
for (let i = 0; i < 20 && m.phase === 'playing'; i++) advanceMatch(m, (now = m.turnAt + 1));
assert.equal(m.phase, 'finished');

// ---- regolamenti ----
const two = [{ name: 'A' }, { name: 'B' }];
const at = (g, id, x, z) => Object.assign(g.balls[id], { x, z, on: true, potted: false });
const park = (g, ids) =>
  ids.forEach((id, i) => at(g, id, -0.2 + (i % 6) * 0.08, -0.5 + Math.floor(i / 6) * 0.1));

// palla 8: spacco debole (meno di 4 bilie alla sponda, niente in buca) = si rifà il triangolo e spacca l'altro
{
  const g = E.newGame('otto', two, { seed: 3 });
  const { out } = E.playShot(g, { dx: 1, dz: 0, speed: 0.9, sy: 0, sx: 0 });
  assert.match(out.msg, /Spacco non valido/);
  assert.equal(g.cur, 1);
  assert.equal(g.breakShot, true);
  assert.equal(g.inHand, 'kitchen');
}
// palla 8: la nera va nella buca chiamata, altrimenti si perde
for (const [call, winner] of [
  [2, 0],
  [5, 1]
]) {
  const g = E.newGame('otto', two, { seed: 3 });
  Object.assign(g, { breakShot: false, open: false, inHand: null });
  g.players[0].group = E.SOLID;
  g.players[1].group = E.STRIPE;
  for (const b of g.balls) if (b.id && b.id !== 8 && b.id <= 7) b.on = false;
  park(g, [9, 10, 11, 12, 13, 14, 15]);
  at(g, 8, 1.1, -0.48);
  at(g, 0, 0.8, -0.24);
  const d = Math.hypot(1.1 - 0.8, -0.48 + 0.24),
    dx = (1.1 - 0.8) / d,
    dz = (-0.48 + 0.24) / d;
  const { out } = E.playShot(g, { dx, dz, speed: 2.2, sy: -0.9, sx: 0, call }); // colpo basso: la bianca torna indietro
  assert.equal(out.win, winner, 'buca chiamata ' + call);
}
// 5 birilli: bilia avversaria sul pallino = 3 punti ("casin")
{
  const g = E.newGame('italiana', two, {});
  Object.assign(g, { inHand: null });
  at(g, 0, -1.0, 0.4);
  at(g, 1, -0.6, 0.4);
  at(g, 2, -0.2, 0.4);
  E.playShot(g, { dx: 1, dz: 0, speed: 2.2, sy: -0.8, sx: 0 });
  assert.equal(g.scores[0], 3);
  assert.equal(g.cur, 1);
}
// 5 birilli: mancare la bilia avversaria = 2 punti all'avversario e bilia in mano
{
  const g = E.newGame('italiana', two, {});
  Object.assign(g, { inHand: null });
  at(g, 0, -1.0, 0.4);
  at(g, 1, -0.6, -0.4);
  at(g, 2, 1.0, 0.4);
  const { out } = E.playShot(g, { dx: 0, dz: -1, speed: 0.6, sy: 0, sx: 0 });
  assert.ok(out.foul);
  assert.equal(g.scores[1], 2);
  assert.ok(g.inHand === 'head' || g.inHand === 'foot');
}
// boccette, art. 9.3 p): pallino nella metà bassa → l'accosto diretto è irregolare, quello di sponda (in fondo) è valido
for (const [shot, ok] of [
  [{ dx: 1, dz: 0, speed: 0.45, sy: 0, sx: 0 }, false],
  [{ dx: 1, dz: 0, speed: 3.6, sy: 0, sx: 0 }, true]
]) {
  const g = E.newGame('boccette', two, {});
  Object.assign(g, { acchito: false, left: [3, 4] });
  at(g, 0, -0.35, 0); // pallino sotto la linea di mezzeria
  at(g, 5, 0.6, 0.45); // una bilia bianca oltre la metà
  g.cur = 0;
  g.nextBall = 2;
  g.inHand = 'throw';
  const { out } = E.playShot(g, { ...shot, px: -1.2, pz: 0.3 });
  assert.equal(!!out.foul, !ok, ok ? 'accosto di sponda valido' : 'accosto diretto irregolare');
  if (!ok) assert.equal(g.balls[2].on, false, 'boccetta annullata');
}
// boccette: acchito che manca il pallino = boccetta annullata, pallino in penitenza, tocca all'avversario
{
  const g = E.newGame('boccette', two, {});
  const { out } = E.playShot(g, { dx: 0, dz: 1, speed: 1, sy: 0, sx: 0 });
  assert.match(out.msg, /pallino non colpito/i);
  assert.equal(g.balls[1].on, false);
  assert.equal(g.cur, 1);
  assert.equal(g.left[0], 3);
}
// boccette: punti d'accosto 2/3/5/8
{
  const g = E.newGame('boccette', two, {});
  Object.assign(g, { acchito: false, left: [1, 0] });
  at(g, 0, 0.7, 0);
  at(g, 1, 0.72, 0.05);
  at(g, 2, 0.75, -0.06);
  at(g, 3, 0.6, 0.1);
  at(g, 5, 1.2, 0.5);
  at(g, 6, 0.2, 0.5);
  at(g, 7, 1.3, -0.5);
  at(g, 8, 1.0, -0.6);
  g.cur = 0;
  g.nextBall = 4;
  g.inHand = 'throw';
  const { out } = E.playShot(g, { dx: 0, dz: 1, speed: 0.3, sy: 0, sx: 0, px: -1.2, pz: -0.6 });
  assert.equal(out.round, true);
  assert.equal(g.scores[0], 5, 'tre bilie rosse più vicine della migliore bianca = 5 punti');
  assert.equal(g.cur, 0, "chi fa l'accosto rimette il pallino");
}

// palla 9 (WPA): rombo con la 1 in punta e la 9 al centro; prima la più bassa; la 9 regolare vince; tre falli perdono
{
  const g = E.newGame('nove', two, { seed: 4 });
  const xs = g.balls.filter(b => b.id).map(b => b.x);
  assert.equal(g.balls[1].x, Math.min(...xs), 'la 1 in punta');
  assert.ok(Math.abs(g.balls[9].z) < 1e-9 && g.balls[9].x > g.balls[1].x, 'la 9 al centro');
  assert.deepEqual(E.legalFirst(g), [1]);
  // tiro sulla 9 quando la più bassa è un'altra: fallo, la 9 torna sul punto
  Object.assign(g, { breakShot: false, inHand: null });
  park(g, [2, 3, 4, 5, 6, 7, 8]);
  at(g, 1, -0.3, 0.5);
  at(g, 9, 1.1, -0.48);
  at(g, 0, 0.8, -0.24);
  const d = Math.hypot(0.3, 0.24);
  let r = E.playShot(g, { dx: 0.3 / d, dz: -0.24 / d, speed: 2.2, sy: -0.9, sx: 0 });
  assert.match(r.out.foul, /colpire per prima la 1/);
  assert.equal(g.balls[9].on, true, 'la 9 torna sul punto');
  assert.equal(g.inHand, 'any');
  // tre falli di fila: partita persa (il giocatore B manca due volte, poi ancora)
  const h = E.newGame('nove', two, { seed: 4 });
  Object.assign(h, { breakShot: false, inHand: null, cur: 1, fouls: [0, 2] });
  at(h, 0, -1.0, 0.5);
  r = E.playShot(h, { dx: 0, dz: -1, speed: 0.3, sy: 0, sx: 0 });
  assert.equal(r.out.win, 0, 'tre falli di fila');
  // la 9 imbucata regolarmente (prima la più bassa, qui sola rimasta) vince
  const w = E.newGame('nove', two, { seed: 4 });
  Object.assign(w, { breakShot: false, inHand: null });
  for (const b of w.balls) if (b.id && b.id !== 9) b.on = false;
  at(w, 9, 1.1, -0.48);
  at(w, 0, 0.8, -0.24);
  r = E.playShot(w, { dx: 0.3 / d, dz: -0.24 / d, speed: 2.2, sy: -0.9, sx: 0 });
  assert.equal(r.out.win, 0);
}
// carambola (UMB): in apertura prima il rosso; un punto quando si toccano le altre due, con le sponde richieste
{
  const g = E.newGame('carambola', two, { cush: 0, target: 10 });
  assert.deepEqual(E.legalFirst(g), [2]);
  Object.assign(g, { breakShot: false });
  at(g, 0, -0.8, 0);
  at(g, 2, -0.5, 0.059);
  at(g, 1, -0.2, 0);
  let r = E.playShot(g, { dx: 1, dz: 0, speed: 2, sy: 0, sx: 0 });
  assert.equal(g.scores[0], 1, 'carambola libera: punto');
  assert.equal(r.out.keep, true, 'chi fa punto continua');
  // la stessa carambola, ma nella partita a tre sponde: niente punto, tocca all'altro
  const h = E.newGame('carambola', two, { cush: 3, target: 10 });
  Object.assign(h, { breakShot: false });
  at(h, 0, -0.8, 0);
  at(h, 2, -0.5, 0.059);
  at(h, 1, -0.2, 0);
  r = E.playShot(h, { dx: 1, dz: 0, speed: 2, sy: 0, sx: 0 });
  assert.equal(h.scores[0], 0, 'tre sponde: senza sponde niente punto');
  assert.equal(h.cur, 1);
}
// snooker: dopo un fallo, se chi entra non vede le rosse (coperte da un colore) ha la free ball
{
  const g = E.newGame('snooker', two, { reds: 6 });
  for (let id = 2; id <= 15; id++) g.balls[id].on = false;
  at(g, 1, 1.2, 0);
  at(g, 0, 0.5, 0);
  at(g, 21, 0.85, 0); // la nera copre l'unica rossa
  for (const id of [16, 17, 18, 19, 20]) at(g, id, -1.5 + (id - 16) * 0.2, 0.7);
  Object.assign(g, { on: 'red', inHand: null, cur: 1 });
  assert.equal(E.snookered(g), true, 'snookerato');
  // l'avversario fa fallo (manca tutto lontano): tocca al giocatore 0, snookerato → free ball
  at(g, 0, 0.5, 0);
  g.cur = 1;
  E.playShot(g, { dx: 0, dz: 1, speed: 0.15, sy: 0, sx: 0 });
  assert.equal(g.cur, 0);
  assert.equal(g.freeBall, true, 'free ball assegnata');
  assert.ok(E.legalFirst(g).includes(21), 'con la free ball si può colpire anche un colore');
}

// tutte le specialità giocate fino in fondo dal computer, e online con il pilota automatico
for (const variant of Object.keys(E.VARIANTS)) {
  const g = E.newGame(variant, [{ name: 'A' }, { name: 'B' }], {
    target: variant === 'italiana' ? 25 : variant === 'carambola' ? 10 : 50,
    cush: 0,
    reds: 6,
    seed: 5
  });
  for (let i = 0; i < 400 && !g.over; i++) E.playShot(g, await plan(g, 'difficile'));
  assert.equal(g.over, true, variant + ' finisce');
  assert.ok(g.winner === 0 || g.winner === 1, variant + ' ha un vincitore');
  const o = makeMatch('r-' + variant, 1, anna, 0, { variant, seed: 9 });
  joinMatch(o, bruno);
  startMatch(o, anna.player, 0);
  playMatch(o, o.seats[o.match.cur], E.autoShot(o.match), 1);
  assert.equal(o.n, 1, variant + ' online');
}

console.log('biliardo: ok');
