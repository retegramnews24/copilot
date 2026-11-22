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

// Error reports to the server: redacted, each message once, at most 10 per session.
{
  const { errorReporter } = await import('../public/debug-log.js');
  const reports = [];
  const report = errorReporter(e => reports.push(e));
  report({ message: 'boom token=session.abc.' + 'a'.repeat(64), source: 'https://x/app.js', line: 3 });
  report({ message: 'boom token=session.abc.' + 'a'.repeat(64), source: 'https://x/app.js', line: 3 });
  assert.equal(reports.length, 1, 'same error once');
  assert.ok(!reports[0].message.includes('session.abc'), 'session token redacted');
  for (let i = 0; i < 20; i++) report({ message: 'different ' + i });
  assert.equal(reports.length, 10, 'at most 10 per session');
  const broken = errorReporter(() => {
    throw Error('network');
  });
  broken({ message: 'x' }); // a failing report never breaks the app
}

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

// Chat: oldest first and newest at the bottom, own messages marked, send adds the reply once and clears the field.
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
assert.deepEqual(texts(), ['primo', 'secondo']);
assert.equal(document.querySelectorAll('#chat-messages .mine').length, 1);
assert.equal(document.getElementById('chat-send').disabled, false);
chat.render(false);
assert.equal(document.getElementById('chat-send').disabled, true, 'no sending while disconnected');
document.getElementById('chat-input').value = '  ciao  ';
document.getElementById('chat-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
await new Promise(r => setTimeout(r, 10));
assert.deepEqual(posted, ['/api/chat', { text: 'ciao' }]);
assert.deepEqual(texts(), ['primo', 'secondo', 'ciao']);
assert.equal(document.getElementById('chat-input').value, '');
assert.equal(refreshed, 2);

// Stored game notices (from the server): shown as notices, not as messages; no button when the table is closed.
const { tableNotice, winNotice } = await import('../lobby-hub.js');
const tableOpened = tableNotice({ id: '2', name: 'Sara' }, 'uno', 3, 'room-3');
assert.equal(tableOpened.notice, 'table');
assert.equal(tableOpened.text, 'Sara ha aperto UNO · Tavolo 3');
assert.equal(
  tableNotice({ id: '2', name: 'Sara' }, 'golf', 2, 'g').text,
  'Sara ha aperto Golf with your gay friends · sala 2'
);
assert.equal(
  winNotice({ game: 'uno', mode: 'people', winners: [{ id: 'tg:2', name: 'Sara' }] }).text,
  '🏆 Sara vince a UNO'
);
assert.equal(winNotice({ game: 'uno', mode: 'ai', winners: [{ id: 'tg:2', name: 'Sara' }] }), null);
// The chat shows messages only: notices stored there by 1.0.41 are left out.
chat.set([
  { id: 'm1', userId: '2', name: 'Ada', at: 1, text: 'primo' },
  { ...tableOpened, at: 5 }
]);
chat.render(true);
assert.deepEqual(texts(), ['primo']);

// Lobby bell: personal notices, own table left out, unread count, × removes, "Entra" only while open.
localStorage.clear();
document.body.insertAdjacentHTML('beforeend', '<header class="profile-bar"></header>');
const { createNotices } = await import('../public/notices.js');
let entered = null;
const bell = createNotices({
  me: () => ({ id: '1' }),
  isOpen: room => room === 'room-3',
  open: room => (entered = room)
});
bell.set([tableOpened, { ...tableNotice({ id: '1', name: 'Io' }, 'uno', 4, 'room-4'), at: Date.now() }]);
assert.equal(document.querySelector('.notices-count').textContent, '1', 'own table is not a notice');
bell.add({ text: 'Tocca a te · Scacchi', label: 'Gioca', urgent: true, action: () => (entered = 'chess') });
assert.equal(document.querySelector('.notices-count').textContent, '2');
document.getElementById('notices-bell').click();
assert.equal(document.querySelector('.notices-count').hidden, true, 'opening the bell marks them read');
assert.equal(document.querySelectorAll('#notices-list .notice-item').length, 2);
[...document.querySelectorAll('#notices-list .notice-item button')]
  .find(b => b.textContent === 'Entra')
  .click();
assert.equal(entered, 'room-3');
document.getElementById('notices-bell').click();
assert.equal(
  document.querySelectorAll('#notices-list .notice-item').length,
  1,
  'an approved notice (Entra) disappears'
);
document.querySelector('#notices-list .notice-remove').click();
assert.equal(document.querySelectorAll('#notices-list .notice-item').length, 0, '× removes the notice');
assert.deepEqual(bell.items(), [], 'the Lobby 3D board shows the same notices as the bell');
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

// Long-turn rule: the app and the server agree on which tables count.
const serverRules = await import('../turn-notices.js');
const clientRules = await import('../public/game-info.js');
assert.deepEqual(clientRules.LONG_GAMES, serverRules.LONG_GAMES);
assert.equal(clientRules.LONG_LIMIT, serverRules.LONG_LIMIT);
for (const g of [{ game: 'chess' }, { game: 'scarabeo', mode: 'ai' }, { game: 'uno' }, {}])
  assert.equal(clientRules.isLongTurn(g), serverRules.isLongTurn(g));

// "Le tue partite": only your open tables, your turn first, with who you play against.
document.body.insertAdjacentHTML(
  'beforeend',
  '<section id="my-games" hidden><span class="count-pill"></span><div class="my-games-list"></div></section>'
);
const { renderMyGames } = await import('../public/my-games.js');
const me = () => 'tg:1',
  openedRooms = [];
const lobbyGames = [
  {
    room: 'a',
    number: 4,
    game: 'chess',
    phase: 'playing',
    turn: 1,
    players: [{ id: 'tg:1' }, { id: 'tg:2', name: 'Bruno' }]
  },
  {
    room: 'b',
    number: 2,
    game: 'connect4',
    phase: 'playing',
    turn: 0,
    players: [{ id: 'tg:1' }, { id: 'tg:3', name: 'Carla' }]
  },
  { room: 'c', number: 1, game: 'checkers', phase: 'waiting', turn: 0, players: [{ id: 'tg:1' }] },
  {
    room: 'd',
    number: 3,
    game: 'chess',
    phase: 'playing',
    turn: 0,
    players: [{ id: 'tg:5' }, { id: 'tg:6' }]
  },
  { room: 'e', number: 5, game: 'golf', phase: 'playing', players: [{ id: 'tg:1' }] },
  {
    room: 'f',
    number: 6,
    game: 'uno',
    mode: 'ai',
    phase: 'playing',
    turn: 1,
    players: [{ id: 'tg:1' }, { id: 'bot:1', name: 'AI 1', bot: true }]
  },
  {
    room: 'g',
    number: 7,
    game: 'chess',
    phase: 'finished',
    players: [{ id: 'tg:1' }, { id: 'tg:2', name: 'Bruno' }]
  }
];
const myGames = document.getElementById('my-games');
assert.equal(
  renderMyGames(myGames, lobbyGames, me, room => openedRooms.push(room)),
  4
);
assert.equal(myGames.hidden, false);
const rowsText = [...myGames.querySelectorAll('.my-game')].map(r => r.textContent);
assert.match(rowsText[0], /Forza 4 · Tavolo 2contro Carla · Tocca a teGioca/);
assert.match(rowsText[1], /Checkmate! · Tavolo 4contro Bruno · Tocca a BrunoApri/);
assert.match(rowsText[2], /UNO · Tavolo 6contro AI · Tocca all’AIApri/);
assert.match(rowsText[3], /Dama italiana · Tavolo 1Aspetta altri giocatori/);
assert.equal(myGames.querySelector('.count-pill').textContent, '1 tocca a te');
myGames.querySelector('.my-game button').click();
assert.deepEqual(openedRooms, ['b']);
// Time left to move, in the list and in short form.
const { timeLeft } = await import('../public/my-games.js');
assert.equal(timeLeft(3 * 86400000 + 20 * 3600000 + 5000), '3 g 20 h');
assert.equal(timeLeft(5 * 3600000 + 10 * 60000), '5 h 10 min');
assert.equal(timeLeft(12 * 60000 + 30000), '12 min');
assert.equal(timeLeft(10000), '1 min');
assert.equal(timeLeft(0), 'scaduto');
renderMyGames(myGames, [{ ...lobbyGames[1], deadline: 1000 + 26 * 3600000 }], me, () => {}, 1000);
assert.match(myGames.querySelector('.my-game small').textContent, /Tocca a te · ⏳ 1 g 2 h$/);
assert.equal(
  renderMyGames(myGames, [], me, () => {}),
  0
);
assert.equal(myGames.hidden, true);

console.log(
  'PASS App modules: game info, pieces, preferences, debug log, themes, leaderboard, avatar, chat, Forza 4, UNO, turn alerts, my games.'
);
