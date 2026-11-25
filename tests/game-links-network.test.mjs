// F1 e Biliardo sul telefono (f1-link.js, biliardo-link.js) con una rete finta: dopo tre richieste di stato fallite
// il gioco dice «Collegamento perso, riprovo…», al ritorno della rete «Collegamento ripreso.», con la sessione
// scaduta «Sessione scaduta: chiudi e riapri Binottoland dal bot.», e una partita sparita si chiude da sola.
import assert from 'node:assert/strict';

// pagina finta: solo quello che i due moduli usano
const elements = new Map();
const element = id => {
  if (!elements.has(id))
    elements.set(id, {
      id,
      hidden: true,
      src: '',
      posted: [],
      focus() {},
      addEventListener() {},
      contentWindow: { postMessage: msg => element(id).posted.push(msg) }
    });
  return elements.get(id);
};
globalThis.document = { getElementById: element, hidden: false };
globalThis.location = { origin: 'https://binottoland.test' };
globalThis.window = { addEventListener() {} };
let tick = null;
globalThis.setInterval = fn => ((tick = fn), 1);
globalThis.clearInterval = () => {};

const { createF1Link } = await import('../public/f1-link.js');
const { createBiliardoLink } = await import('../public/biliardo-link.js');

async function check(name, create, overlayId, frameId, prefix, goneText) {
  elements.clear();
  let answer = () => ({ state: { revision: 1, room: 'r1' }, track: {} });
  const errors = [],
    closed = [];
  const link = create({
    tg: null,
    me: () => ({ player: 'tg:1', name: 'Anna' }),
    request: async () => answer(),
    onError: message => errors.push(message),
    enterFullscreen() {},
    sendPresence() {},
    safeInsets: () => ({}),
    games: () => [],
    roomClosed: room => closed.push(room)
  });
  await link.open('r1');
  assert.equal(element(overlayId).hidden, false, name + ': opened');
  const frame = element(frameId);
  const net = () => frame.posted.filter(m => m.type === prefix + 'net').map(m => m.message);
  const fail = status => () => {
    throw Object.assign(new Error('rete'), { status });
  };
  const poll = async () => {
    await tick();
    await new Promise(r => setTimeout(r, 0));
  };

  // la rete cade: due errori in silenzio, al terzo l'avviso
  answer = fail(503);
  await poll();
  await poll();
  assert.deepEqual(net(), [], name + ': two failures, nothing said yet');
  await poll();
  assert.deepEqual(net(), ['Collegamento perso, riprovo…'], name + ': lost after three failures');
  // la rete torna
  answer = () => ({ state: { revision: 2, room: 'r1' } });
  await poll();
  assert.equal(net().at(-1), 'Collegamento ripreso.', name + ': back');
  // sessione scaduta
  answer = fail(401);
  for (let i = 0; i < 3; i++) await poll();
  assert.equal(
    net().at(-1),
    'Sessione scaduta: chiudi e riapri Binottoland dal bot.',
    name + ': expired session'
  );
  // la partita non c'è più: si chiude e lo dice
  answer = fail(404);
  await poll();
  assert.equal(element(overlayId).hidden, true, name + ': closed when gone');
  assert.deepEqual(closed, ['r1']);
  assert.deepEqual(errors, [goneText]);
}

await check('F1', createF1Link, 'f1-overlay', 'f1-frame', 'f1:', 'Gara chiusa.');
await check('Biliardo', createBiliardoLink, 'biliardo-overlay', 'biliardo-frame', 'bil:', 'Partita chiusa.');

console.log(
  'PASS game links network: F1 and Biliardo say «Collegamento perso» after three failures, «ripreso» when back, expired session, closed game.'
);
