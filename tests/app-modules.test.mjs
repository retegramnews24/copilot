import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  `<meta name="theme-color" content=""><pre id="terminal"></pre><p id="debug-result"></p>
   <button id="clear-terminal"></button><button id="copy-terminal"></button>
   <button data-theme-choice="ocean"></button><button data-board-choice="walnut"></button><button data-piece-choice="plum"></button>
   <ol id="leaderboard-solo"></ol><p id="leaderboard-solo-empty"></p><ol id="leaderboard-multi"></ol><p id="leaderboard-multi-empty"></p>
   <ol id="leaderboard-number"></ol><p id="leaderboard-number-empty"></p>`,
  { url: 'https://example.test/' }
);
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage });

const { gameTitle, staged, gameLimits, ongoing } = await import('../public/game-info.js');
assert.equal(gameTitle({ game: 'connect4' }), 'Forza 4');
assert.equal(gameTitle({ game: 'chess' }), 'Checkmate!');
assert.equal(staged({ game: 'uno' }), true);
assert.deepEqual(gameLimits({ game: 'uno' }), { min: 2, max: 10 });
assert.deepEqual(gameLimits({ game: 'briscola5' }), { min: 5, max: 5 });
assert.equal(ongoing({ phase: 'finished', series: { done: false } }), true);
assert.equal(ongoing({ phase: 'playing', archived: true }), false);

const { position, pieceSvg, checkerSvg, unoCard } = await import('../public/pieces.js');
const start = position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
assert.equal(start.e1, 'K');
assert.equal(start.d8, 'q');
assert.equal(Object.keys(start).length, 32);
assert.match(pieceSvg('Q'), /--white-piece/);
assert.match(checkerSvg('k'), /--black-piece/);
assert.equal(unoCard({ color: 'red', value: 'skip' }).getAttribute('aria-label'), 'Rosso · ⊘');

const { pref, setPref, read, save } = await import('../public/prefs.js');
setPref('a', 'x');
assert.equal(pref('a', 'y'), 'x');
assert.equal(pref('missing', 'y'), 'y');
save('obj', { n: 1 });
assert.deepEqual(read('obj', null), { n: 1 });

// Debug log: tokens are redacted, the log keeps the last 160 lines and the terminal shows it.
const { events, trace, initDebugLog } = await import('../public/debug-log.js');
trace('AUTH', 'token=abc123secret 123456789:AAAAAAAAAAAAAAAAAAAA');
assert.match(events.at(-1), /token=\[REDACTED\] \[REDACTED\]/);
for (let i = 0; i < 200; i++) trace('X', 'line ' + i);
assert.equal(events.length, 160);
assert.match(document.getElementById('terminal').textContent, /line 199/);
initDebugLog();
document.getElementById('clear-terminal').click();
assert.equal(events.length, 1);
assert.match(events[0], /Registro pulito/);

// Themes: saved choices are applied at start, a click changes and remembers them.
save('checkmate-board', 'forest');
const { initThemes } = await import('../public/themes.js');
initThemes({ onError: e => assert.fail(e), trace });
assert.equal(document.documentElement.dataset.theme, 'dark');
assert.equal(document.documentElement.dataset.board, 'forest');
document.querySelector('[data-theme-choice]').click();
document.querySelector('[data-piece-choice]').click();
assert.equal(document.documentElement.dataset.theme, 'ocean');
assert.equal(document.querySelector('meta[name="theme-color"]').content, '#102c35');
assert.equal(read('checkmate-pieces', ''), 'plum');

// Leaderboard: top five, wins per game, one load at a time, repeated while the server is still counting.
const { renderLeaders, createLeaderboardLoader } = await import('../public/leaderboard.js');
const rows = Array.from({ length: 7 }, (_, i) => ({
  id: 'p' + i,
  name: 'P' + i,
  wins: 7 - i,
  games: { uno: 2, connect4: 5 }
}));
renderLeaders({
  aiLeaderboard: [],
  leaderboard: rows,
  numberConnectLeaders: [{ name: 'N', points: 1200, level: 'hard' }]
});
assert.equal(document.querySelectorAll('#leaderboard-multi li').length, 5);
assert.match(document.querySelector('#leaderboard-multi p').textContent, /^Forza 4 5 · UNO 2$/);
assert.equal(document.getElementById('leaderboard-solo-empty').hidden, false);
assert.match(document.querySelector('#leaderboard-number span').textContent, /Difficile/);
let calls = 0;
const load = createLeaderboardLoader({
  request: async () => ({ leaderboard: rows, pending: ++calls < 3 }),
  onError: e => assert.fail(e),
  ready: () => true
});
await Promise.all([load(), load()]);
assert.equal(calls, 3, 'second call skipped while busy; pending repeats until done');

// Avatar: initials, photo only from https.
const { makeAvatar } = await import('../public/avatar.js');
assert.equal(makeAvatar({ name: 'mario rossi' }).textContent, 'MR');
assert.equal(makeAvatar({ name: 'A', photo: 'http://x/y.jpg' }).querySelector('img'), null);
assert.ok(makeAvatar({ name: 'A', photo: 'https://x/y.jpg' }).querySelector('img'));

// Chat: newest first, own messages marked, send adds the reply once and clears the field.
document.body.insertAdjacentHTML(
  'beforeend',
  `<form id="chat-form"><input id="chat-input"><button id="chat-send"></button></form><div id="chat-messages"></div>`
);
window.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.addEventListener = window.addEventListener.bind(window);
const { createChat } = await import('../public/chat.js');
let refreshed = 0,
  posted = null;
const chat = createChat({
  me: () => ({ id: '1' }),
  request: async (path, body) => {
    posted = [path, body];
    return { message: { id: 'm3', userId: '1', name: 'Io', at: 3, text: body.text } };
  },
  onError: e => assert.equal(e, ''),
  refresh: () => {
    refreshed++;
    chat.render(true);
  }
});
chat.set([
  { id: 'm1', userId: '2', name: 'Ada', at: 1, text: 'primo' },
  { id: 'm2', userId: '1', name: 'Io', at: 2, text: 'secondo' }
]);
chat.render(true);
const texts = () => [...document.querySelectorAll('#chat-messages p')].map(p => p.textContent);
assert.deepEqual(texts(), ['secondo', 'primo']);
assert.equal(document.querySelectorAll('#chat-messages .mine').length, 1);
assert.equal(document.getElementById('chat-send').disabled, false);
chat.render(false);
assert.equal(document.getElementById('chat-send').disabled, true, 'no sending while disconnected');
document.getElementById('chat-input').value = '  ciao  ';
document.getElementById('chat-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
await new Promise(r => setTimeout(r, 10));
assert.deepEqual(posted, ['/api/chat', { text: 'ciao' }]);
assert.deepEqual(texts(), ['ciao', 'secondo', 'primo']);
assert.equal(document.getElementById('chat-input').value, '');
assert.equal(refreshed, 2);

// Forza 4: full columns disabled, winning discs marked, a click sends the column.
const { renderConnect4 } = await import('../public/connect4-ui.js');
const board = document.createElement('div'),
  hint = document.createElement('p'),
  cells = Array(42).fill(null);
cells[35] = 0;
cells[0] = 1;
const moves = [];
renderConnect4(
  board,
  hint,
  { board: cells, legalMoves: [1, 2, 3, 4, 5, 6], winning: [35], lastMove: { row: 5, column: 0 } },
  { phase: 'playing', replaying: false, active: true, move: m => moves.push(m) }
);
assert.equal(board.children.length, 7);
assert.equal(board.children[0].disabled, true);
assert.match(board.children[0].getAttribute('aria-label'), /piena/);
assert.equal(board.querySelectorAll('.winning').length, 1);
assert.equal(hint.textContent, 'Scegli una colonna');
board.children[3].click();
assert.deepEqual(moves, [{ column: 3 }]);

// UNO: hand shown to the player, only legal cards enabled, the card is played with the chosen colour.
document.body.insertAdjacentHTML(
  'beforeend',
  `<p id="uno-message"></p><div id="uno-top"></div><span id="uno-active-color"></span><button id="uno-draw"></button>
   <button id="uno-pass"></button><div id="uno-color-row"></div><select id="uno-color"><option value="blue">b</option></select>
   <button id="uno-opening-color"></button><button id="uno-accept-four"></button><button id="uno-challenge-four"></button>
   <button id="uno-declare"></button><button id="uno-catch"></button><label id="uno-call-option"><input id="uno-call-with-card" type="checkbox"></label>
   <p id="uno-score"></p><div id="uno-revealed"></div><div id="uno-hand"></div><div id="uno-history"></div>`
);
const { renderUno } = await import('../public/uno-ui.js');
const played = [];
const unoState = {
  phase: 'playing',
  players: [{ name: 'Io' }, { name: 'Ada' }],
  moves: [{ by: 'Ada', description: 'gioca 5 rosso' }],
  uno: {
    top: { color: 'red', value: '5' },
    color: 'red',
    hand: [
      { id: 'a', color: 'red', value: '7' },
      { id: 'b', color: 'green', value: '2' }
    ],
    legalMoves: ['a'],
    canDraw: true,
    scores: [0, 40],
    lastEvent: 'Tocca a te'
  }
};
renderUno(unoState, { mine: 0, active: true, busy: false, move: m => played.push(m) });
const cards = document.querySelectorAll('#uno-hand button');
assert.equal(cards.length, 2);
assert.equal(cards[1].disabled, true);
assert.equal(document.getElementById('uno-active-color').textContent, 'Colore · Rosso');
assert.match(document.getElementById('uno-score').textContent, /Ada 40/);
document.getElementById('uno-call-with-card').checked = true;
cards[0].click();
assert.deepEqual(played, [{ kind: 'play', card: 'a', color: 'blue', uno: true }]);
renderUno(unoState, { mine: -1, active: false, busy: false, move: () => {} });
assert.match(document.getElementById('uno-hand').textContent, /private/);

// Turn alerts: Lobby invite, "later", Settings switch (needs the bot's chat first), table opened from the message.
document.body.insertAdjacentHTML(
  'beforeend',
  `<section id="alerts-card" hidden><button id="alerts-enable"></button><button id="alerts-later"></button></section>
   <input type="checkbox" id="setting-turn-alerts" disabled>`
);
const { initTurnAlerts } = await import('../public/turn-alerts.js');
const opened = [],
  requests = [];
let serverState = { enabled: false, started: false, bot: 'checkmategame_bot' };
const alertsUi = initTurnAlerts({
  tg: {
    openTelegramLink: link => opened.push(link),
    initDataUnsafe: { start_param: 't-0f8fad5b-d9cb-469f-a165-70867728950e' }
  },
  request: async (path, data) => {
    requests.push([path, data]);
    if (data) serverState = { ...serverState, enabled: data.enabled && serverState.started };
    return serverState;
  }
});
await alertsUi.refresh();
const card = document.getElementById('alerts-card'),
  toggle = document.getElementById('setting-turn-alerts');
assert.equal(card.hidden, false, 'invite shown while off');
assert.equal(toggle.disabled, false);
assert.equal(toggle.checked, false);
document.getElementById('alerts-enable').click();
assert.deepEqual(opened, ['https://t.me/checkmategame_bot?start=avvisi']);
// Switch on without the bot's chat started: opens the bot instead, the switch stays off.
toggle.checked = true;
toggle.dispatchEvent(new window.Event('change'));
await new Promise(r => setTimeout(r, 0));
assert.equal(opened.length, 2);
assert.equal(toggle.checked, false);
assert.equal(requests.filter(([, data]) => data).length, 0);
// After Start in the bot: on, invite gone; switching off asks the server.
serverState = { enabled: true, started: true, bot: 'checkmategame_bot' };
await alertsUi.refresh();
assert.equal(card.hidden, true);
assert.equal(toggle.checked, true);
toggle.checked = false;
toggle.dispatchEvent(new window.Event('change'));
await new Promise(r => setTimeout(r, 0));
assert.deepEqual(requests.at(-1), ['/api/notices', { enabled: false }]);
assert.equal(toggle.checked, false);
assert.equal(card.hidden, false);
document.getElementById('alerts-later').click();
assert.equal(card.hidden, true, '"Più tardi" hides the invite');
// Opened from a message: that table, only once; anything else in the link is ignored.
assert.equal(alertsUi.startRoom(), '0f8fad5b-d9cb-469f-a165-70867728950e');
assert.equal(alertsUi.startRoom(), null);
assert.equal(
  initTurnAlerts({
    tg: { initDataUnsafe: { start_param: 't-../../x' } },
    request: async () => null
  }).startRoom(),
  null
);

console.log(
  'PASS App modules: game info, pieces, preferences, debug log, themes, leaderboard, avatar, chat, Forza 4, UNO, turn alerts.'
);
