// Errori del server (analisi Fable, area 5, punto 5.4): i messaggi voluti arrivano al giocatore, gli errori di
// programmazione finiscono nei log con un messaggio generico, una richiesta illeggibile dice che il server non l'ha capita e cosa fare (messaggi in public/messages.js).
import assert from 'node:assert/strict';
import { failure } from '../worker-shared.js';
import { MSG } from '../public/messages.js';

const logged = [];
const realError = console.error;
console.error = (...args) => logged.push(args.join(' '));
try {
  const wanted = failure(new Error('Non tocca a te.'), 409, 'test');
  assert.equal(wanted.status, 409);
  assert.deepEqual(await wanted.json(), { error: 'Non tocca a te.' });
  assert.equal(logged.length, 0, 'wanted messages are not logged');

  let bug;
  try {
    undefined.x;
  } catch (e) {
    bug = e;
  }
  const crash = failure(bug, 409, 'biliardo');
  assert.equal(crash.status, 500);
  assert.deepEqual(await crash.json(), { error: 'Errore del server: riprova tra poco.' });
  assert.equal(logged.length, 1);
  const entry = JSON.parse(logged[0]);
  assert.equal(entry.type, 'game-error');
  assert.equal(entry.where, 'biliardo');
  assert.match(entry.message, /undefined/);

  let parse;
  try {
    JSON.parse('{');
  } catch (e) {
    parse = e;
  }
  const badJson = failure(parse, 409);
  assert.equal(badJson.status, 400);
  assert.deepEqual(await badJson.json(), { error: MSG.unreadable });
} finally {
  console.error = realError;
}
console.log(
  'PASS Server failures: wanted messages pass through, code errors are logged and hidden, bad JSON is 400.'
);
