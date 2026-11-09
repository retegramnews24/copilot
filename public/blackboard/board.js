import {avatarSVG} from '../labyrinth/avatar.js?v=8';
import {BOARD_WIDTH, BOARD_HEIGHT, CHALKS, MAX_POINTS} from './chalk.js';

const board = document.getElementById('board');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const pending = new Map();
let color = 0, pointer = null, current = null, last = null;
let online = false, needsPreview = false, flushTimer;
for (const canvas of [board, preview]) {
  canvas.width = BOARD_WIDTH;
  canvas.height = BOARD_HEIGHT;
}
const saved = board.getContext('2d');
const draft = preview.getContext('2d');

function paint(ctx, stroke) {
  const {points} = stroke;
  let seed = Number.parseInt(stroke.id.slice(0, 8), 16);
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  ctx.fillStyle = ctx.strokeStyle = CHALKS[stroke.color][1];
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  if (points.length === 1) ctx.lineTo(points[0][0] + 0.1, points[0][1]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();

  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  function dust(x, y) {
    for (let i = 0; i < 6; i++) {
      const size = 0.65 + random() * 1.35;
      ctx.rect(x + (random() - 0.5) * 9, y + (random() - 0.5) * 9, size, size);
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
  ctx.globalAlpha = 1;
}

function refreshPreview() {
  if (needsPreview) return;
  needsPreview = true;
  requestAnimationFrame(() => {
    needsPreview = false;
    draft.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
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
  if (online) post('stroke', {stroke});
  refreshPreview();
}

function point(event, rect) {
  const x = Math.round((event.clientX - rect.left) / rect.width * BOARD_WIDTH);
  const y = Math.round((event.clientY - rect.top) / rect.height * BOARD_HEIGHT);
  return [Math.max(0, Math.min(BOARD_WIDTH, x)), Math.max(0, Math.min(BOARD_HEIGHT, y))];
}

let drawingColor;
function addPoint(next) {
  if (last && Math.hypot(next[0] - last[0], next[1] - last[1]) < 1.8) return;
  if (!current) {
    current = {type:'stroke', id:crypto.randomUUID(), color:drawingColor, points:last ? [last] : []};
    flushTimer = setTimeout(flush, 95);
  }
  current.points.push(next);
  last = next;
  if (current.points.length === MAX_POINTS) flush();
  refreshPreview();
}

preview.addEventListener('pointerdown', event => {
  if (!online || pointer !== null || event.button !== 0) return;
  pointer = event.pointerId;
  last = null;
  drawingColor = color;
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
  button.onclick = () => {
    chalks.children[color].setAttribute('aria-pressed', 'false');
    color = index;
    button.setAttribute('aria-pressed', 'true');
  };
  chalks.append(button);
});

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
    case 'history': packet.strokes.forEach(commit); break;
    case 'stroke': commit(packet); break;
    case 'ack': pending.delete(packet.id); break;
    case 'rejected':
      pending.delete(packet.id);
      status.textContent = 'Tratto non salvato';
      break;
    case 'ready':
      online = true;
      status.textContent = 'In diretta';
      for (const stroke of pending.values()) post('stroke', {stroke});
      break;
    case 'offline':
      online = false;
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
