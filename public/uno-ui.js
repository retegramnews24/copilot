// UNO table: top card, active colour, the player's hand, the buttons that apply now, scores and recent moves.
// ctx: {mine: seat index or -1, active: it is this player's turn, busy, move(action) sends a move}.
import { unoCard, unoNames } from './pieces.js?v=fa35e21be7';
const $ = id => document.getElementById(id);

export function renderUno(state, ctx) {
  const u = state.uno,
    { mine, active, busy } = ctx,
    waiting = state.phase === 'waiting';
  $('uno-message').textContent = waiting
    ? state.players.length +
      '/10 giocatori · ' +
      (mine === 0 ? 'Avvia quando siete pronti.' : 'Attendi che il creatore avvii.')
    : u.lastEvent;
  $('uno-top').replaceChildren(unoCard(u.top));
  $('uno-active-color').textContent = u.color ? 'Colore · ' + unoNames[u.color] : 'Scegli il colore iniziale';
  $('uno-active-color').dataset.color = u.color || '';
  $('uno-draw').hidden = waiting || mine < 0 || state.phase === 'finished';
  $('uno-draw').disabled = !active || !u.canDraw;
  $('uno-pass').hidden = !active || !u.canPass;
  $('uno-color-row').hidden = mine < 0 || waiting || state.phase === 'finished';
  $('uno-opening-color').hidden = !active || !u.chooseColor;
  $('uno-accept-four').hidden = $('uno-challenge-four').hidden = !active || !u.decidePenalty;
  $('uno-declare').hidden = busy || state.phase !== 'playing' || !u.canDeclare;
  $('uno-catch').hidden = busy || state.phase !== 'playing' || !u.canCatch;
  $('uno-call-option').hidden = !active || u.hand.length !== 2 || !u.legalMoves.length;
  $('uno-score').textContent = waiting
    ? ''
    : 'Manche ' +
      (u.round || 1) +
      ' · traguardo 500 · ' +
      (u.scores || []).map((points, i) => state.players[i].name + ' ' + points).join(' · ');
  const revealed = $('uno-revealed');
  revealed.hidden = !u.shownHand?.length;
  revealed.replaceChildren(...(u.shownHand || []).map(c => unoCard(c)));
  const hand = $('uno-hand');
  hand.replaceChildren();
  if (mine < 0 || waiting) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = mine < 0 ? 'Le mani dei giocatori sono private.' : 'Sette carte a testa all’avvio.';
    hand.append(p);
  } else
    for (const c of u.hand) {
      const b = unoCard(c, true);
      b.disabled = !active || !u.legalMoves.includes(c.id);
      b.onclick = () => {
        const uno = u.hand.length === 2 && $('uno-call-with-card').checked;
        $('uno-call-with-card').checked = false;
        ctx.move({ kind: 'play', card: c.id, color: $('uno-color').value, uno });
      };
      hand.append(b);
    }
  const history = $('uno-history');
  history.replaceChildren();
  for (const m of state.moves.slice(-12).reverse()) {
    const p = document.createElement('p');
    p.textContent = m.by + ' · ' + m.description;
    history.append(p);
  }
}
