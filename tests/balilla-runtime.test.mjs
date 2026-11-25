// Calcio balilla attraverso il server vero (Miniflare, come in produzione ma in locale) con quattro telefoni finti,
// due per lato: ognuno prende il suo posto, muove solo la sua coppia di aste, la partita si ferma se uno tace e
// riparte quando torna, la stessa persona da un secondo dispositivo non ruba il posto, chi si ricollega con una
// connessione nuova riprende il suo posto e chi tace da SEAT_GRACE lo lascia.
// Non provato qui: la pausa del server (ibernazione) con i posti rimessi a posto, che Miniflare non sa simulare;
// la parte che li ricostruisce (BalillaHub.restore) è provata in balilla-restore.test.mjs.
// Si lancia dopo wrangler deploy --dry-run (npm run test:multiplayer-runtime).
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { rows } from '../public/lobby3d/balilla-rules.js';
import { PAUSE, TAKEOVER, SEAT_GRACE } from '../balilla-hub.js';

const bundle = resolve(process.argv[2] || '.test-bundle/worker.js');
const directory = await mkdtemp(join(tmpdir(), 'binottoland-balilla-')),
  bot = 'synthetic-test-bot';
const mac = (k, v) => createHmac('sha256', k).update(v).digest('hex');
const token = id => {
  const user = { id: String(id), player: 'tg:' + id, name: 'Test ' + id },
    payload = Buffer.from(
      JSON.stringify({ user, expires: Date.now() + 3600000, accessTag: mac(bot, 'telegram-session-v1') })
    ).toString('base64url');
  return 'session.' + payload + '.' + mac(bot, 'session.' + payload);
};
const mf = new Miniflare(
  convertV4MiniflareOptions({
    rootPath: dirname(bundle),
    modulesRoot: dirname(bundle),
    modules: true,
    scriptPath: bundle,
    compatibilityDate: '2026-11-04',
    durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
    resourcePersistencePath: directory,
    bindings: { BOT_TOKEN: bot },
    outboundService: async () => Response.json({ ok: true, result: { status: 'member' } })
  })
);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const phones = [];

// un telefono finto: entra nel club della Lobby 3D e tiene gli ultimi messaggi del balilla
async function phone(id) {
  const res = await mf.dispatchFetch('https://unit.test/api/lobby/ws', {
    headers: { Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'checkmate,' + token(id) }
  });
  assert.equal(res.status, 101);
  const p = { id, ws: res.webSocket, last: null, all: [] };
  p.ws.addEventListener('message', e => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === 'balilla' && m.field) {
        p.last = m;
        p.all.push(m);
      }
    } catch {}
  });
  p.ws.accept();
  p.send = b => p.ws.send(JSON.stringify(b));
  p.balilla = (action, data = {}) => p.send({ type: 'balilla', action, ...data });
  p.send({ type: 'presence', inClub: true, room: null, away: false });
  await sleep(50);
  p.balilla('watch');
  phones.push(p);
  return p;
}
// aspetta finché l'ultimo messaggio del balilla di quel telefono soddisfa la condizione
async function until(p, check, what, ms = 4000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(25))
    if (p.last && check(p.last)) return p.last;
  throw Error('Tempo scaduto: ' + what + '\nultimo: ' + JSON.stringify(p.last)?.slice(0, 300));
}
const rodsOf = (m, team, attack) =>
  rows.map((row, i) => [row, m.field.rods[i]]).filter(([row]) => row.team === team && row.attack === attack);
const near = (a, b) => Math.abs(a - b) < 0.05;

try {
  // quattro persone, due per lato: chi arriva prende il posto libero del suo lato
  const [anna, bruno, carla, dario] = [await phone(71), await phone(72), await phone(73), await phone(74)];
  anna.balilla('join', { slot: 0, mode: 2, target: 10, bar: true });
  await until(anna, m => m.slot === 0, 'Anna seduta al posto 0');
  bruno.balilla('join', { slot: 0, mode: 2, target: 10, bar: true });
  await until(bruno, m => m.slot === 1, 'Bruno al posto 1, compagno di Anna');
  carla.balilla('join', { slot: 2, mode: 2, target: 10, bar: true });
  await until(carla, m => m.slot === 2, 'Carla al posto 2, dall’altro lato');
  dario.balilla('join', { slot: 2, mode: 2, target: 10, bar: true });
  const full = await until(dario, m => m.slot === 3, 'Dario al posto 3');
  assert.deepEqual([...full.occupied].sort(), [0, 1, 2, 3], 'four seats taken');
  assert.equal(full.playing, true, 'the table runs');
  console.log('PASS balilla runtime: four phones, two per side, each on its own seat.');

  // con un compagno ognuno ha la sua coppia: Anna (posto 0) muove la difesa, Bruno (posto 1) l'attacco
  const keep = setInterval(() => {
    for (const p of [anna, bruno, carla]) p.balilla('watch');
  }, 1000);
  anna.balilla('input', { pair: 1, slide: 0, angle: 0.6 }); // chiede l'attacco, ma con un compagno muove la sua coppia
  bruno.balilla('input', { pair: 0, slide: 0, angle: -0.6 });
  const moved = await until(
    carla,
    m =>
      rodsOf(m, 0, 0).every(([, r]) => near(r.angle, 0.6)) &&
      rodsOf(m, 0, 1).every(([, r]) => near(r.angle, -0.6)),
    'aste di Anna a 0.6 e di Bruno a -0.6'
  );
  for (const [, r] of [...rodsOf(moved, 1, 0), ...rodsOf(moved, 1, 1)])
    assert.ok(near(r.angle, 0), 'the other side does not move');
  console.log('PASS balilla runtime: with a partner each phone moves only its own pair of rods.');

  // Dario tace (app nascosta, rete caduta): dopo PAUSE la partita si ferma per tutti, al suo ritorno riparte
  dario.balilla('watch');
  await sleep(PAUSE + 600);
  await until(anna, m => m.paused === true, 'pausa per tutti quando Dario tace');
  dario.balilla('watch');
  await until(anna, m => m.paused === false, 'si riparte quando Dario torna');
  console.log('PASS balilla runtime: one silent phone pauses the table, it resumes when it is back.');

  // Anna apre il tavolo anche dal computer mentre il telefono è vivo: il secondo non le ruba il posto e sa perché
  // (analisi 9.7: prima la riga di stato diceva «Aspetto il posto…» per sempre)
  const annaPC = await phone(71);
  annaPC.balilla('join', { slot: 0, mode: 2, target: 10, bar: true });
  await until(
    annaPC,
    m => m.slot === -1 && m.elsewhere === true,
    'secondo dispositivo di Anna: «già al tavolo»'
  );
  await sleep(300);
  assert.equal(anna.last.slot, 0, 'Anna keeps her seat on the phone');
  assert.equal(anna.last.elsewhere, false, 'the seated device is not told it plays elsewhere');
  assert.equal(carla.last.elsewhere, false, 'other people are not told anything');
  annaPC.ws.close();
  console.log(
    'PASS balilla runtime: the same person from a second live device does not steal the seat and is told so.'
  );

  // Dario si ricollega con una connessione nuova mentre la vecchia tace da più di TAKEOVER: riprende il posto 3
  await sleep(TAKEOVER + 300);
  const again = await phone(74);
  again.balilla('join', { slot: 2, mode: 2, target: 10, bar: true });
  const back = await until(again, m => m.slot === 3, 'Dario riprende il posto 3 dalla connessione nuova');
  assert.deepEqual([...back.occupied].sort(), [0, 1, 2, 3], 'still four seats, no duplicate');
  console.log('PASS balilla runtime: a new connection of the same person takes back the seat.');

  // Dario tace del tutto (analisi 9.11): dopo SEAT_GRACE il posto 3 si libera, gli altri restano seduti
  await sleep(SEAT_GRACE + 1500);
  const freed = await until(anna, m => !m.occupied.includes(3), 'posto 3 libero dopo SEAT_GRACE', 8000);
  assert.deepEqual([...freed.occupied].sort(), [0, 1, 2], 'only the silent seat is freed');
  clearInterval(keep);
  console.log('PASS balilla runtime: a seat silent for SEAT_GRACE is freed, the others stay.');
} finally {
  for (const p of phones)
    try {
      p.ws.close();
    } catch {}
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
