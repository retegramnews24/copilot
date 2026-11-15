// Leaderboards on the Giochi page: wins against the AI, wins between people, Number Connect points.
import { gameTitle } from './game-info.js?v=2f8dbeba94';
const $ = id => document.getElementById(id);

function paintLeaders(kind, rows) {
  const list = $('leaderboard-' + kind),
    top = rows.slice(0, 5),
    signature = JSON.stringify(top);
  if (list.dataset.ranking === signature) return;
  const expanded = new Set([...list.querySelectorAll('details[open]')].map(entry => entry.dataset.player));
  list.dataset.ranking = signature;
  list.replaceChildren();
  for (const [index, row] of top.entries()) {
    const item = document.createElement('li'),
      entry = document.createElement('details'),
      summary = document.createElement('summary');
    const title = document.createElement('strong'),
      count = document.createElement('span'),
      detail = document.createElement('p');
    entry.dataset.player = row.id;
    entry.open = expanded.has(row.id);
    title.textContent = index + 1 + '. ' + row.name;
    count.textContent = String(row.wins);
    count.setAttribute('aria-label', row.wins + ' ' + (row.wins === 1 ? 'vittoria' : 'vittorie'));
    detail.className = 'hint';
    detail.textContent = Object.entries(row.games)
      .sort((a, b) => b[1] - a[1])
      .map(([game, n]) => gameTitle({ game }) + ' ' + n)
      .join(' · ');
    summary.append(title, count);
    entry.append(summary, detail);
    item.append(entry);
    list.append(item);
  }
  $('leaderboard-' + kind + '-empty').hidden = rows.length > 0;
}
export function renderNumberLeaders(rows) {
  const list = $('leaderboard-number'),
    levels = { easy: 'Facile', medium: 'Media', hard: 'Difficile' };
  list.replaceChildren(
    ...rows.map((row, index) => {
      const item = document.createElement('li'),
        name = document.createElement('strong'),
        points = document.createElement('span');
      name.textContent = index + 1 + '. ' + row.name;
      points.textContent = Number(row.points).toLocaleString('it-IT') + ' punti · ' + levels[row.level];
      item.append(name, points);
      return item;
    })
  );
  $('leaderboard-number-empty').hidden = rows.length > 0;
}
export function renderLeaders(data) {
  paintLeaders('solo', data.aiLeaderboard || []);
  paintLeaders('multi', data.leaderboard || []);
  if (Array.isArray(data.numberConnectLeaders)) renderNumberLeaders(data.numberConnectLeaders);
}
// Loads the leaderboard, asking again while the server is still counting (pending). One load at a time.
export function createLeaderboardLoader({ request, onError, ready }) {
  let busy = false;
  return async function loadLeaders() {
    if (!ready() || busy) return;
    busy = true;
    try {
      let data;
      do {
        data = await request('/api/leaderboard?mode=both');
        renderLeaders(data);
      } while (data.pending);
    } catch (e) {
      onError(e.message);
    } finally {
      busy = false;
    }
  };
}
