// Forza 4: seven column buttons with six discs each. view is the live position or a replay frame.
// ctx: {phase, replaying, active: this player may move, move(action) sends a move}.
export function renderConnect4(board, hint, view, ctx) {
  board.setAttribute('aria-label', 'Forza 4 · sette colonne, sei righe');
  board.replaceChildren();
  hint.textContent =
    ctx.phase === 'waiting'
      ? 'In attesa del secondo giocatore'
      : ctx.replaying
        ? 'Rivedi la partita'
        : ctx.active
          ? 'Scegli una colonna'
          : ctx.phase === 'finished'
            ? view.reason || 'Partita conclusa'
            : 'Quattro pedine in fila per vincere';
  for (let col = 0; col < 7; col++) {
    const button = document.createElement('button');
    button.className = 'connect4-column';
    button.disabled = !ctx.active || !view.legalMoves.includes(col);
    button.setAttribute('aria-label', 'Colonna ' + (col + 1) + (view.board[col] !== null ? ' · piena' : ''));
    for (let row = 0; row < 6; row++) {
      const i = row * 7 + col,
        disc = document.createElement('span');
      disc.className =
        'connect4-disc' +
        (view.board[i] === 0 ? ' red' : view.board[i] === 1 ? ' yellow' : '') +
        (view.winning?.includes(i) ? ' winning' : '') +
        (view.lastMove?.row === row && view.lastMove.column === col ? ' latest' : '');
      disc.setAttribute('aria-hidden', 'true');
      button.append(disc);
    }
    button.onclick = () => ctx.move({ column: col });
    board.append(button);
  }
}
