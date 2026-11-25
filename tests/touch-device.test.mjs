// «È un telefono?» (public/touch-device.js, analisi 9.8): conta il puntatore principale, non la sola possibilità
// del tocco, e l'ultimo uso ricordato del dispositivo vale dalla prossima apertura. Nessun file della 3D decide più
// da solo con 'ontouchstart'.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideTouch, rememberPointer, isTouchDevice } from '../public/touch-device.js';

// telefono: dito come puntatore principale
assert.equal(decideTouch(true, null), true);
// computer, anche con schermo tattile ma usato con mouse e tastiera
assert.equal(decideTouch(false, null), false);
// l'ultimo uso ricordato vince
assert.equal(decideTouch(false, '1'), true, 'laptop last used with the finger');
assert.equal(decideTouch(true, '0'), false, 'tablet last used with a mouse');

// cosa ricordare dopo un tocco o un clic vero
assert.equal(rememberPointer('touch', false), '1', 'a real touch on a computer layout');
assert.equal(rememberPointer('mouse', true), '0', 'a mouse on a phone layout');
assert.equal(rememberPointer('touch', true), null, 'nothing changes');
assert.equal(rememberPointer('mouse', false), null, 'nothing changes');
assert.equal(rememberPointer('pen', false), null, 'a pen does not decide');

// senza matchMedia e senza localStorage (Node) non si rompe: computer
assert.equal(isTouchDevice(), false);

// i file che prima decidevano da soli ora chiedono a touch-device.js
for (const file of ['lobby3d/lobby3d.js', 'lobby3d/flipper3d.js', 'lobby3d/balilla.js', 'settings.js']) {
  const text = readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
  assert.ok(!text.includes("'ontouchstart' in window"), file + ' still decides with ontouchstart');
  assert.ok(text.includes('isTouchDevice()'), file + ' uses isTouchDevice()');
}

console.log(
  'PASS touch device: primary pointer decides, last real use remembered, one place for 3D, pinball, balilla and help.'
);
