// App, chessboard and piece themes chosen in Settings, remembered in localStorage.
import { read, save } from './prefs.js?v=bd123656a4';
const $$ = selector => document.querySelectorAll(selector);
const TONES = ['classic', 'forest', 'walnut', 'blue', 'plum', 'graphite'];
export function applyTheme(theme) {
  if (!['dark', 'light', 'slate', 'ocean', 'rose', 'sand'].includes(theme)) theme = 'dark';
  document.documentElement.dataset.theme = theme;
  $$('[data-theme-choice]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme))
  );
  document.querySelector('meta[name="theme-color"]').content = {
    dark: '#15231f',
    light: '#f2eee4',
    slate: '#18233c',
    ocean: '#102c35',
    rose: '#301d2a',
    sand: '#efe0bd'
  }[theme];
}
export function applyBoardTheme(theme) {
  if (!TONES.includes(theme)) theme = 'classic';
  document.documentElement.dataset.board = theme;
  $$('[data-board-choice]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.boardChoice === theme))
  );
}
export function applyPieceTheme(theme) {
  if (!TONES.includes(theme)) theme = 'classic';
  document.documentElement.dataset.pieces = theme;
  $$('[data-piece-choice]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.pieceChoice === theme))
  );
}
// Applies the saved themes and wires the choice buttons. onError shows a storage failure to the user.
export function initThemes({ onError, trace }) {
  applyTheme(read('checkmate-theme', 'dark'));
  $$('[data-theme-choice]').forEach(
    button =>
      (button.onclick = () => {
        applyTheme(button.dataset.themeChoice);
        try {
          save('checkmate-theme', button.dataset.themeChoice);
        } catch (e) {
          onError(e.message);
        }
      })
  );
  applyBoardTheme(read('checkmate-board', 'classic'));
  $$('[data-board-choice]').forEach(
    button =>
      (button.onclick = () => {
        applyBoardTheme(button.dataset.boardChoice);
        try {
          save('checkmate-board', button.dataset.boardChoice);
          trace('UI', 'Scacchiera ' + button.dataset.boardChoice);
        } catch (e) {
          onError(e.message);
        }
      })
  );
  applyPieceTheme(read('checkmate-pieces', 'classic'));
  $$('[data-piece-choice]').forEach(
    button =>
      (button.onclick = () => {
        applyPieceTheme(button.dataset.pieceChoice);
        try {
          save('checkmate-pieces', button.dataset.pieceChoice);
        } catch (e) {
          onError(e.message);
        }
      })
  );
}
