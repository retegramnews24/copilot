// Lobby "Le tue partite": every open board-game table where you sit, the ones waiting for your move first.
import { gameTitle, ongoing } from './game-info.js?v=637e9e8793';

const ARCADE = ['golf', 'pong', 'moto-trial', 'f1', 'biliardo'];
// Time left to move, short: "3 g 20 h", "5 h 10 min", "12 min".
export function timeLeft(ms) {
  if (!(ms > 0)) return 'scaduto';
  const d = Math.floor(ms / 86400000),
    h = Math.floor((ms % 86400000) / 3600000),
    m = Math.floor((ms % 3600000) / 60000);
  return d ? d + ' g ' + h + ' h' : h ? h + ' h ' + m + ' min' : Math.max(1, m) + ' min';
}
// me(room): your player id at that table; open(room): opens it.
export function myTables(games, me) {
  return games.filter(
    g => !ARCADE.includes(g.game) && ongoing(g) && g.players.some(p => p.id === me(g.room))
  );
}
function status(g, mine) {
  if (g.phase === 'waiting') return { text: 'Aspetta altri giocatori', rank: 2 };
  if (g.phase !== 'playing') return { text: 'Tra le manche', rank: 3 };
  const turn = g.players[g.turn];
  if (turn?.id === mine) return { text: 'Tocca a te', rank: 0, urgent: true };
  return { text: turn?.bot ? 'Tocca all’AI' : 'Tocca a ' + (turn?.name || '…'), rank: 1 };
}
export function renderMyGames(section, games, me, open, now = Date.now()) {
  const list = section.querySelector('.my-games-list'),
    count = section.querySelector('.count-pill');
  const rows = myTables(games, me)
    .map(g => ({ g, s: status(g, me(g.room)) }))
    .sort((a, b) => a.s.rank - b.s.rank || a.g.number - b.g.number);
  section.hidden = !rows.length;
  const waiting = rows.filter(r => r.s.urgent).length;
  count.textContent = waiting
    ? waiting + ' tocca a te'
    : rows.length + (rows.length === 1 ? ' aperta' : ' aperte');
  count.classList.toggle('urgent', waiting > 0);
  list.replaceChildren(
    ...rows.map(({ g, s }) => {
      const row = document.createElement('div');
      row.className = 'my-game' + (s.urgent ? ' urgent' : '');
      const copy = document.createElement('div');
      copy.className = 'my-game-copy';
      const title = document.createElement('strong');
      title.textContent = gameTitle(g) + ' · Tavolo ' + g.number;
      const others = g.players.filter(p => p.id !== me(g.room));
      const detail = document.createElement('small');
      detail.textContent =
        (others.length ? 'contro ' + others.map(p => (p.bot ? 'AI' : p.name)).join(', ') + ' · ' : '') +
        s.text +
        (g.phase === 'playing' && g.deadline ? ' · ⏳ ' + timeLeft(g.deadline - now) : '');
      copy.append(title, detail);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = s.urgent ? '' : 'alt';
      button.textContent = s.urgent ? 'Gioca' : 'Apri';
      button.onclick = () => open(g.room);
      row.append(copy, button);
      return row;
    })
  );
  return rows.length;
}
