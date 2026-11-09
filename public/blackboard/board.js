import {avatarSVG} from '../labyrinth/avatar.js?v=8';
import {BOARD_WIDTH, BOARD_HEIGHT, CHALKS, MAX_POINTS, ERASER, DEFAULT_SIZE} from './chalk.js?v=2';

const board = document.createElement('canvas');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const pending = new Map();
const clearButton = document.getElementById('clear');
const confirmClear = document.getElementById('confirm-clear');
const confirmClearButton = document.getElementById('confirm-clear-action');
const cancelClearButton = document.getElementById('cancel-clear');
const sizeControl = document.getElementById('size');
const eraser = document.getElementById('eraser');
let epoch = 0, clearing = false, clearTimer;
let color = 0, pointer = null, current = null, last = null;
let online = false, needsPreview = false, flushTimer;
for (const canvas of [board, preview]) {
  canvas.width = BOARD_WIDTH;
  canvas.height = BOARD_HEIGHT;
}
const saved = board.getContext('2d');
const draft = preview.getContext('2d');

function paint(ctx, stroke) {
  const {points, size = DEFAULT_SIZE} = stroke;
  const erase = stroke.color === ERASER;
  let seed = Number.parseInt(stroke.id.slice(0, 8), 16);
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  ctx.save();
  if (erase) ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = ctx.strokeStyle = erase ? '#000' : CHALKS[stroke.color][1];
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.lineWidth = erase ? size * 3 : size * 4 / DEFAULT_SIZE;
  ctx.globalAlpha = erase ? 1 : 0.24;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  if (points.length === 1) ctx.lineTo(points[0][0] + 0.1, points[0][1]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
  if (erase) { ctx.restore(); return; }

  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  function dust(x, y) {
    for (let i = 0; i < 6; i++) {
      const speck = (0.65 + random() * 1.35) * Math.sqrt(size / DEFAULT_SIZE);
      ctx.rect(x + (random() - 0.5) * size, y + (random() - 0.5) * size, speck, speck);
    }
  }

  dust(...points[0]);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const dx = points[i][0] - x, dy = points[i][1] - y;
    const samples = Math.ceil(Math.hypot(dx, dy) / 2.6);
    for (let k = 1; k <= samples; k++) dust(x + dx * k / samples, y + dy * k / samples);
  }
  ctx.fill();
  ctx.restore();
}

function refreshPreview() {
  if (needsPreview) return;
  needsPreview = true;
  requestAnimationFrame(() => {
    needsPreview = false;
    draft.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    draft.drawImage(board, 0, 0);
    for (const stroke of pending.values()) paint(draft, stroke);
    if (current) paint(draft, current);
  });
}

function post(type, data = {}) {
  parent.postMessage({type:'blackboard:' + type, ...data}, location.origin);
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  if (!current) return;
  const stroke = current;
  current = null;
  pending.set(stroke.id, stroke);
  if (online) post('stroke', {command:stroke});
  refreshPreview();
}

function point(event, rect) {
  const x = Math.round((event.clientX - rect.left) / rect.width * BOARD_WIDTH);
  const y = Math.round((event.clientY - rect.top) / rect.height * BOARD_HEIGHT);
  return [Math.max(0, Math.min(BOARD_WIDTH, x)), Math.max(0, Math.min(BOARD_HEIGHT, y))];
}

let drawingColor, drawingSize;
function addPoint(next) {
  if (last && Math.hypot(next[0] - last[0], next[1] - last[1]) < 1.8) return;
  if (!current) {
    current = {type:'stroke', id:crypto.randomUUID(), color:drawingColor, size:drawingSize, epoch, points:last ? [last] : []};
    flushTimer = setTimeout(flush, 95);
  }
  current.points.push(next);
  last = next;
  if (current.points.length === MAX_POINTS) flush();
  refreshPreview();
}

preview.addEventListener('pointerdown', event => {
  if (!online || clearing || pointer !== null || event.button !== 0) return;
  pointer = event.pointerId;
  last = null;
  drawingColor = color;
  drawingSize = Number(sizeControl.value);
  preview.setPointerCapture(pointer);
  addPoint(point(event, preview.getBoundingClientRect()));
});
preview.addEventListener('pointermove', event => {
  if (event.pointerId !== pointer || !online) return;
  const rect = preview.getBoundingClientRect();
  const samples = event.getCoalescedEvents?.();
  for (const sample of samples?.length ? samples : [event]) addPoint(point(sample, rect));
});
function endStroke(event) {
  if (event.pointerId !== pointer) return;
  if (event.type === 'pointerup' && online) addPoint(point(event, preview.getBoundingClientRect()));
  pointer = null;
  last = null;
  flush();
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) preview.addEventListener(event, endStroke);

const chalks = document.getElementById('chalks');
CHALKS.forEach(([name, tint, angle], index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chalk';
  button.title = name;
  button.setAttribute('aria-label', 'Gessetto ' + name.toLowerCase());
  button.setAttribute('aria-pressed', index === color);
  button.style.setProperty('--chalk', tint);
  button.style.setProperty('--angle', angle + 'deg');
  button.append(document.createElement('i'));
  button.onclick = () => selectTool(index);
  chalks.append(button);
});

function selectTool(index) {
  color = index;
  for (const [i, button] of [...chalks.children, eraser].entries()) {
    button.setAttribute('aria-pressed', String(i === color));
  }
}
eraser.onclick = () => selectTool(ERASER);
clearButton.onclick = () => {
  if (!online || clearing) return;
  confirmClear.show();
};
cancelClearButton.onclick = () => confirmClear.close();
confirmClearButton.onclick = () => {
  confirmClear.close();
  if (!online || clearing) return;
  clearing = true;
  clearButton.disabled = true;
  pointer = null;
  last = null;
  flush();
  post('clear', {command:{type:'clear', epoch}});
  status.textContent = 'Cancellazione in corso…';
  clearTimer = setTimeout(() => {
    if (!clearing) return;
    clearing = false;
    clearButton.disabled = !online;
    status.textContent = 'Cancellazione non confermata. Riprova.';
  }, 8000);
};

function clearBoard(nextEpoch) {
  clearTimeout(clearTimer);
  epoch = nextEpoch;
  clearTimeout(flushTimer);
  current = null;
  last = null;
  pointer = null;
  pending.clear();
  saved.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  clearing = false;
  clearButton.disabled = !online;
  if (confirmClear.open) confirmClear.close('cancel');
}

function showPeople(people) {
  const list = document.getElementById('people');
  list.replaceChildren();
  document.getElementById('count').textContent = 'Presenti · ' + people.length;
  for (const person of people) {
    const item = document.createElement('li');
    item.innerHTML = avatarSVG(person.outfit);
    const label = document.createElement('span');
    label.textContent = person.name;
    item.append(label);
    list.append(item);
  }
}

function commit(stroke) {
  pending.delete(stroke.id);
  paint(saved, stroke);
}

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'blackboard:packet') return;
  const packet = event.data.packet;
  switch (packet.type) {
    case 'sync':
      if (epoch !== packet.epoch) clearBoard(packet.epoch);
      document.getElementById('room').textContent = 'Sala ' + packet.number;
      break;
    case 'clear':
      clearBoard(packet.epoch);
      status.textContent = 'Lavagna pulita';
      break;
    case 'clear-error':
      clearTimeout(clearTimer);
      clearing = false;
      clearButton.disabled = !online;
      status.textContent = 'Cancellazione non riuscita. Riprova.';
      break;
    case 'room-error': status.textContent = packet.message; break;
    case 'history': packet.strokes.forEach(commit); break;
    case 'stroke': commit(packet); break;
    case 'ack': pending.delete(packet.id); break;
    case 'rejected':
      pending.delete(packet.id);
      status.textContent = 'Tratto non salvato';
      break;
    case 'ready':
      online = true;
      clearing = false;
      clearButton.disabled = false;
      status.textContent = 'In diretta';
      for (const stroke of pending.values()) post('stroke', {command:stroke});
      break;
    case 'offline':
      online = false;
      clearButton.disabled = true;
      if (confirmClear.open) confirmClear.close('cancel');
      pointer = null;
      last = null;
      flush();
      showPeople([]);
      status.textContent = packet.expired ? 'Riapri da Telegram' : 'Riconnessione…';
      break;
    case 'people': showPeople(packet.people); break;
  }
  refreshPreview();
});

if (parent === window) status.textContent = 'Apri da Binottoland';
else post('ready');
