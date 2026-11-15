// Drawings of the table pieces: chess (SVG), checkers (SVG) and UNO cards. Pure functions, no state.
export const pieceNames = { p: 'pedone', r: 'torre', n: 'cavallo', b: 'alfiere', q: 'donna', k: 're' };
export function pieceSvg(piece) {
  const type = piece.toLowerCase(),
    white = piece !== type;
  const shapes = {
    p: '<circle cx="22.5" cy="12" r="6"/><path d="M18 18h9l-1 8 6 6H13l6-6z"/><path d="M12 33h21v5H12z"/>',
    r: '<path d="M10 7h6v5h4V7h5v5h4V7h6v12l-5 3 1 10H14l1-10-5-3z"/><path d="M11 33h23v5H11z"/>',
    n: '<path d="m13 30 4-7-6 1-3-5L20 7l9 3 5 9-1 13H13z"/><path d="m20 7-1-4 6 4m-9 13 8-3-4 8" fill="none"/><circle cx="22" cy="13" r="1.3" fill="currentColor" stroke="none"/><path d="M11 33h24v5H11z"/>',
    b: '<path d="M22.5 5c-4 4-9 9-9 13 0 4 4 7 9 7s9-3 9-7c0-4-5-9-9-13z"/><path d="m25 11-6 7" fill="none"/><path d="m18 25-4 7h17l-4-7zM11 33h23v5H11z"/>',
    q: '<path d="m10 12 5 18h15l5-18-8 8-4.5-12-4.5 12z"/><circle cx="10" cy="10" r="2.5"/><circle cx="22.5" cy="6" r="2.5"/><circle cx="35" cy="10" r="2.5"/><path d="M14 30h17v3H14zM11 34h23v4H11z"/>',
    k: '<path d="M20 4h5v5h5v4h-5v5h-5v-5h-5V9h5z"/><path d="M14 18c-8-3-9 7 0 10l2 4h13l2-4c9-3 8-13 0-10l-8.5 4z"/><path d="M12 33h21v5H12z"/>'
  };
  return (
    '<svg viewBox="0 0 45 45" aria-hidden="true"><g fill="var(--' +
    (white ? 'white' : 'black') +
    '-piece)" stroke="var(--' +
    (white ? 'white' : 'black') +
    '-outline)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" color="var(--' +
    (white ? 'white' : 'black') +
    '-outline)">' +
    shapes[type] +
    '</g></svg>'
  );
}
// FEN board part -> {square: piece}, e.g. {e1:'K'}.
export function position(fen) {
  const result = {};
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, index) => {
      let file = 0;
      for (const char of row) {
        if (/\d/.test(char)) file += Number(char);
        else {
          result['abcdefgh'[file] + (8 - index)] = char;
          file++;
        }
      }
    });
  return result;
}
export function checkerSvg(piece) {
  const side = piece === piece.toUpperCase() ? 'white' : 'black',
    crown = piece.toLowerCase() === 'k';
  return (
    '<svg viewBox="0 0 45 45" aria-hidden="true"><g fill="var(--' +
    side +
    '-piece)" stroke="var(--' +
    side +
    '-outline)" stroke-width="1.7"><ellipse cx="22.5" cy="25" rx="16" ry="15"/><circle cx="22.5" cy="21" r="16"/><circle cx="22.5" cy="21" r="11.8" fill="none" opacity=".65"/>' +
    (crown
      ? '<path d="m14 18 3 8h11l3-8-6 4-2.5-7-2.5 7z"/><path d="M17 29h11" fill="none"/>'
      : '<circle cx="22.5" cy="21" r="7" fill="none" opacity=".4"/>') +
    '</g></svg>'
  );
}
export const unoNames = { red: 'Rosso', yellow: 'Giallo', green: 'Verde', blue: 'Blu' },
  unoSymbols = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '✦', wild4: '+4' };
export function unoCard(card, button = false) {
  const el = document.createElement(button ? 'button' : 'div');
  el.className = 'uno-card ' + (card.color || 'wild');
  el.textContent = unoSymbols[card.value] || card.value;
  el.setAttribute(
    'aria-label',
    (unoNames[card.color] || 'Jolly') + ' · ' + (unoSymbols[card.value] || card.value)
  );
  return el;
}
