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

console.log('PASS App modules: game info, pieces, preferences, debug log redaction, themes, leaderboard.');
