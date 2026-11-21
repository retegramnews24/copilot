import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  `<div id="board"></div><p id="board-hint"></p><button id="cancel-capture"></button><button id="flip-board"></button>
   <div id="promotion" hidden><button data-promotion="q"></button><button data-promotion="n"></button><button id="cancel-promotion"></button></div>`,
  { url: 'https://example.test/' }
);
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
const { createChessBoard } = await import('../public/chess-board.js');
const $ = id => document.getElementById(id);
const square = name =>
  [...$('board').children].find(
    b => b.getAttribute('aria-label').startsWith(name + ' ') || b.getAttribute('aria-label').startsWith(name)
  );

let ctx, sent;
const board = createChessBoard({
  get: () => ctx,
  send: move => sent.push(move),
  rerender: () => (ctx.state.checkers ? board.renderCheckers() : board.renderChess())
});

// Chess: tap a piece, then its destination; the move carries the revision.
sent = [];
ctx = {
  mine: 0,
  active: true,
  replayPly: null,
  frame: null,
  state: {
    phase: 'playing',
    turn: 0,
    revision: 7,
    moves: [],
    chess: {
      fen: '4k3/4P3/8/8/8/8/4P3/4K3 w - - 0 1',
      legalMoves: [
        { from: 'e2', to: 'e4' },
        { from: 'e7', to: 'e8', promotion: 'q' }
      ]
    }
  }
};
board.renderChess();
assert.equal($('board').children.length, 64);
assert.equal($('board').children[0].getAttribute('aria-label'), 'a8 · vuota', 'white sees rank 8 on top');
assert.equal($('board-hint').textContent, 'Tocca un pezzo, poi la destinazione');
square('e2').click();
assert.ok(square('e2').classList.contains('selected'));
assert.ok(square('e4').classList.contains('target'));
square('e4').click();
assert.deepEqual(sent, [{ from: 'e2', to: 'e4', revision: 7 }]);

// Promotion: the choice panel opens, nothing is sent until a piece is picked.
board.clear();
board.renderChess();
square('e7').click();
square('e8').click();
assert.equal($('promotion').hidden, false);
assert.equal(sent.length, 1);
document.querySelector('[data-promotion="n"]').click();
assert.deepEqual(sent[1], { from: 'e7', to: 'e8', revision: 7, promotion: 'n' });
board.clear();
assert.equal($('promotion').hidden, true);

// Not your turn: taps do nothing. Black sees the board turned; the flip button turns it back.
ctx.active = false;
board.renderChess();
square('e2').click();
assert.equal(square('e2').classList.contains('selected'), false);
assert.equal($('board-hint').textContent, 'Attendi la mossa avversaria');
ctx.mine = 1;
board.renderChess();
assert.equal($('board').children[0].getAttribute('aria-label'), 'h1 · vuota');
$('flip-board').click();
assert.equal($('board').children[0].getAttribute('aria-label'), 'a8 · vuota');
board.reset();
board.renderChess();
assert.equal(
  $('board').children[0].getAttribute('aria-label'),
  'h1 · vuota',
  'reset forgets the manual flip'
);

// Replay: the frame's position is shown, no moves offered.
ctx = {
  ...ctx,
  mine: 0,
  replayPly: 1,
  frame: { fen: '8/8/8/8/8/8/8/K7 w - - 0 1' },
  state: { ...ctx.state, moves: [{}, {}] }
};
board.renderChess();
assert.match(square('a1').getAttribute('aria-label'), /re bianco/);
assert.equal($('board-hint').textContent, 'Revisione · posizione 1 / 2');

// Checkers: a double jump is built square by square, the jumped piece disappears, then it is sent whole.
sent = [];
ctx = {
  mine: 0,
  active: true,
  replayPly: null,
  frame: null,
  state: {
    phase: 'playing',
    revision: 3,
    moves: [],
    checkers: {
      board: { a2: 'P', b3: 'p', d5: 'p' },
      legalMoves: [{ path: ['a2', 'c4', 'e6'], captures: ['b3', 'd5'] }]
    }
  }
};
board.renderCheckers();
assert.match($('board-hint').textContent, /Presa obbligatoria/);
// Playable (dark) squares are labelled by their number, 1-32.
const dark = name => {
  const n = (8 - Number(name[1])) * 4 + Math.floor('abcdefgh'.indexOf(name[0]) / 2) + 1;
  return [...$('board').children].find(b => b.getAttribute('aria-label').startsWith('Casella ' + n + ' '));
};
dark('a2').click();
assert.ok(dark('c4').classList.contains('target'));
dark('c4').click();
assert.equal(sent.length, 0, 'not complete yet');
assert.equal($('cancel-capture').hidden, false);
assert.match(dark('b3').getAttribute('aria-label'), /vuota/, 'jumped piece removed while building');
assert.match(dark('c4').getAttribute('aria-label'), /pedina bianca/);
assert.match($('board-hint').textContent, /Continua la presa/);
dark('e6').click();
assert.deepEqual(sent, [{ path: ['a2', 'c4', 'e6'], revision: 3 }]);

// Cancel a half-built capture.
board.clear();
board.renderCheckers();
dark('a2').click();
dark('c4').click();
$('cancel-capture').click();
assert.equal($('cancel-capture').hidden, true);
assert.match(dark('b3').getAttribute('aria-label'), /pedina nera/);

console.log(
  'PASS Chess board: select and move, promotion, turn guard, flip and reset, replay, checkers multi-jump and cancel.'
);
