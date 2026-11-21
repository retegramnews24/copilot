// Chessboard and Italian checkers board (same 8×8 grid). Owns the local selection: chosen square, the
// multi-jump capture path being built, a pending pawn promotion and a manual board flip.
// get() returns the live context: {state, mine (seat or -1), active (may move now), replayPly, frame (replay position or null)}.
// send(move) sends a move (the caller's move includes the revision); rerender() redraws the whole table.
import { pieceNames, pieceSvg, position, checkerSvg } from './pieces.js?v=fa35e21be7';
const $ = id => document.getElementById(id);

export function createChessBoard({ get, send, rerender }) {
  let capturePath = [],
    selectedSquare = null,
    boardFlipped = null,
    promotionMove = null;
  const isFlipped = mine => (boardFlipped === null ? mine === 1 : boardFlipped);

  function renderChess() {
    const { state, mine, active, replayPly, frame } = get();
    $('cancel-capture').hidden = true;
    const viewChess = frame ? { ...state.chess, ...frame, legalMoves: [] } : state.chess;
    const flipped = isFlipped(mine);
    const files = flipped ? 'hgfedcba' : 'abcdefgh',
      ranks = flipped ? '12345678' : '87654321';
    const pieces = position(viewChess.fen),
      targets = (viewChess.legalMoves || []).filter(m => m.from === selectedSquare);
    $('board').replaceChildren();
    for (let ri = 0; ri < 8; ri++)
      for (let fi = 0; fi < 8; fi++) {
        const square = files[fi] + ranks[ri],
          piece = pieces[square],
          button = document.createElement('button');
        const dark = ('abcdefgh'.indexOf(square[0]) + Number(square[1])) % 2 === 1;
        button.className =
          'square' +
          (dark ? ' dark' : '') +
          (piece ? ' occupied' : '') +
          (selectedSquare === square ? ' selected' : '') +
          (targets.some(m => m.to === square) ? ' target' : '') +
          ([viewChess.lastMove?.from, viewChess.lastMove?.to].includes(square) ? ' last' : '');
        button.setAttribute(
          'aria-label',
          square +
            (piece
              ? ' · ' +
                pieceNames[piece.toLowerCase()] +
                ' ' +
                (piece === piece.toUpperCase() ? 'bianco' : 'nero')
              : ' · vuota')
        );
        button.setAttribute('aria-disabled', String(!active));
        if (piece) button.innerHTML = pieceSvg(piece);
        if (fi === 0) {
          const rank = document.createElement('span');
          rank.className = 'coord rank';
          rank.textContent = ranks[ri];
          button.append(rank);
        }
        if (ri === 7) {
          const file = document.createElement('span');
          file.className = 'coord file';
          file.textContent = files[fi];
          button.append(file);
        }
        button.onclick = () => selectSquare(square, pieces);
        $('board').append(button);
      }
    $('board-hint').textContent =
      replayPly !== null
        ? 'Revisione · posizione ' + replayPly + ' / ' + state.moves.length
        : state.phase === 'waiting'
          ? 'In attesa del Nero'
          : state.phase === 'finished'
            ? 'Partita conclusa'
            : mine < 0
              ? 'Vista spettatore'
              : active
                ? 'Tocca un pezzo, poi la destinazione'
                : 'Attendi la mossa avversaria';
  }
  function selectSquare(square, pieces) {
    const { state, active } = get();
    if (!active || promotionMove) return;
    const candidates = (state.chess.legalMoves || []).filter(
      m => m.from === selectedSquare && m.to === square
    );
    if (candidates.length) {
      if (candidates.some(m => m.promotion)) {
        promotionMove = { from: selectedSquare, to: square, revision: state.revision };
        $('promotion').hidden = false;
        return;
      }
      send({ from: selectedSquare, to: square, revision: state.revision });
      return;
    }
    const piece = pieces[square],
      white = piece && piece === piece.toUpperCase();
    selectedSquare = piece && white === (state.turn === 0) && square !== selectedSquare ? square : null;
    rerender();
  }

  const matchingCaptures = state =>
    (state.checkers.legalMoves || []).filter(m => capturePath.every((s, i) => m.path[i] === s));
  function renderCheckers() {
    const { state, mine, active, replayPly, frame } = get();
    const view = frame ? { ...state.checkers, ...frame, legalMoves: [] } : state.checkers;
    const flipped = isFlipped(mine);
    const files = flipped ? 'hgfedcba' : 'abcdefgh',
      ranks = flipped ? '12345678' : '87654321',
      pieces = { ...view.board };
    const matches = capturePath.length ? matchingCaptures(state) : [],
      targets = matches.map(m => m.path[capturePath.length]).filter(Boolean);
    // While a multi-jump is being built, show the piece at its last stop and the jumped pieces removed.
    if (capturePath.length > 1) {
      const mover = pieces[capturePath[0]];
      delete pieces[capturePath[0]];
      for (let i = 1; i < capturePath.length; i++) {
        const a = capturePath[i - 1],
          b = capturePath[i];
        if (Math.abs(Number(a[1]) - Number(b[1])) === 2) {
          const x = ('abcdefgh'.indexOf(a[0]) + 'abcdefgh'.indexOf(b[0])) / 2;
          delete pieces['abcdefgh'[x] + (Number(a[1]) + Number(b[1])) / 2];
        }
      }
      pieces[capturePath.at(-1)] = mover;
    }
    $('board').replaceChildren();
    for (let ri = 0; ri < 8; ri++)
      for (let fi = 0; fi < 8; fi++) {
        const square = files[fi] + ranks[ri],
          piece = pieces[square],
          dark = ('abcdefgh'.indexOf(square[0]) + Number(square[1])) % 2 === 0;
        const button = document.createElement('button');
        button.className =
          'square' +
          (dark ? ' dark' : '') +
          (piece ? ' occupied' : '') +
          (selectedSquare === square ? ' selected' : '') +
          (targets.includes(square) ? ' target' : '') +
          (capturePath.includes(square) ? ' path-step' : '') +
          ([view.lastMove?.from, view.lastMove?.to].includes(square) ? ' last' : '');
        const number = (8 - Number(square[1])) * 4 + Math.floor('abcdefgh'.indexOf(square[0]) / 2) + 1;
        button.setAttribute(
          'aria-label',
          (dark ? 'Casella ' + number : square) +
            (piece
              ? ' · ' +
                (piece.toLowerCase() === 'k' ? 'dama' : 'pedina') +
                ' ' +
                (piece === piece.toUpperCase() ? 'bianca' : 'nera')
              : ' · vuota')
        );
        button.setAttribute('aria-disabled', String(!dark || !active));
        if (piece) button.innerHTML = checkerSvg(piece);
        button.onclick = () => selectChecker(square);
        $('board').append(button);
      }
    const capture = state.checkers.legalMoves?.some(m => m.captures.length);
    $('cancel-capture').hidden = !active || capturePath.length < 2;
    $('board-hint').textContent =
      replayPly !== null
        ? 'Revisione · ' + replayPly + ' / ' + state.moves.length
        : state.phase === 'waiting'
          ? 'Dama italiana · in attesa del Nero'
          : state.phase === 'finished'
            ? 'Dama italiana · partita conclusa'
            : mine < 0
              ? 'Dama italiana · vista spettatore'
              : !active
                ? 'Attendi la mossa avversaria'
                : capturePath.length > 1
                  ? 'Continua la presa: tocca il prossimo salto'
                  : capture
                    ? 'Presa obbligatoria · segui le caselle evidenziate'
                    : 'Tocca una pedina, poi la destinazione';
  }
  function selectChecker(square) {
    const { state, active } = get();
    if (!active) return;
    if (capturePath.length) {
      const next = matchingCaptures(state).filter(m => m.path[capturePath.length] === square);
      if (next.length) {
        capturePath.push(square);
        selectedSquare = square;
        const complete = next.find(m => m.path.length === capturePath.length);
        if (complete) {
          send({ path: [...capturePath], revision: state.revision });
          return;
        }
        rerender();
        return;
      }
      if (capturePath.length > 1) return;
    }
    const playable = state.checkers.legalMoves.some(m => m.path[0] === square);
    capturePath = playable && selectedSquare !== square ? [square] : [];
    selectedSquare = capturePath[0] || null;
    rerender();
  }

  $('cancel-capture').onclick = () => {
    capturePath = [];
    selectedSquare = null;
    rerender();
  };
  $('flip-board').onclick = () => {
    boardFlipped = !isFlipped(get().mine);
    rerender();
  };
  document.querySelectorAll('[data-promotion]').forEach(
    button =>
      (button.onclick = () => {
        if (promotionMove) send({ ...promotionMove, promotion: button.dataset.promotion });
      })
  );
  $('cancel-promotion').onclick = () => {
    promotionMove = null;
    $('promotion').hidden = true;
  };

  // clearPath: replay moved; clear: a move was sent or the position changed; reset: leaving the table.
  const clearPath = () => {
    capturePath = [];
    selectedSquare = null;
  };
  const clear = () => {
    clearPath();
    promotionMove = null;
    $('promotion').hidden = true;
  };
  const reset = () => {
    clear();
    boardFlipped = null;
  };
  return { renderChess, renderCheckers, clearPath, clear, reset };
}
