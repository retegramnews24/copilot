// Lobby B: the Lobby is the group chat. Your games, open tables and rooms become scrolling chips at the top,
// mirrored from the original panels, which stay in the page (hidden) so their buttons and handlers do not change.
// New Cinema/Blackboard rooms and a new "tocca a te" show up as notices inside the chat (this browser only);
// new tables and wins are stored by the server in the chat itself, for everyone.
const $ = id => document.getElementById(id);
// [container id, item selector, kind]: "mine" first, so a table you sit at is shown once, as yours.
const SOURCES = [
  ['my-games', '.my-game', 'mine'],
  ['games', '.table-card', 'table'],
  ['cinema-rooms', ':scope > *', 'room'],
  ['blackboard-rooms', ':scope > *', 'room']
];
// Notices only for changes after the Lobby has settled, not for everything found at start-up.
const SETTLE_MS = 4000;

const text = node =>
  (node.querySelector('strong, h3, h4')?.textContent || node.firstElementChild?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
const action = node => [...node.querySelectorAll('button')].find(b => !b.disabled && !b.hidden);
const tableKey = label => label.match(/Tavolo (\d+)/)?.[0];

export function createLobbyChips({ notice }) {
  const lobby = $('lobby');
  if (!lobby) return;
  lobby.classList.add('lobby-b');
  const row = document.createElement('div');
  row.id = 'lobby-chips';
  row.className = 'lobby-chips';
  row.setAttribute('role', 'list');
  row.setAttribute('aria-label', 'Partite e sale');
  (document.querySelector('.people-top') || lobby.firstElementChild).after(row);

  const started = Date.now();
  let known = null,
    timer = 0;
  // Find the current button for a chip at click time: the panels are rebuilt often.
  const find = key => {
    for (const item of collect()) if (item.key === key) return item.button;
    return null;
  };
  function collect() {
    const items = [],
      tables = new Set();
    for (const [id, selector, kind] of SOURCES) {
      const box = $(id);
      if (!box) continue;
      for (const node of box.querySelectorAll(selector)) {
        const label = text(node),
          button = action(node);
        if (!label || !button) continue;
        const table = tableKey(label);
        if (table && kind !== 'room') {
          if (tables.has(table)) continue;
          tables.add(table);
        }
        const urgent = node.classList.contains('urgent');
        items.push({
          key: kind + ':' + (table || label),
          kind,
          label,
          button,
          urgent,
          verb: button.textContent
        });
      }
    }
    return items.sort((a, b) => b.urgent - a.urgent);
  }
  function build() {
    const items = collect();
    row.replaceChildren(
      ...items.map(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'lobby-chip' + (item.urgent ? ' urgent' : '') + ' ' + item.kind;
        chip.setAttribute('role', 'listitem');
        chip.textContent = (item.urgent ? '● ' : '') + item.label;
        chip.title = item.label + ' · ' + item.verb;
        chip.onclick = () => find(item.key)?.click();
        return chip;
      })
    );
    row.hidden = !items.length;
    // Chat notices for what is new since the last look.
    const keys = new Set(items.map(i => i.key + (i.urgent ? ':urgent' : '')));
    if (known && Date.now() - started > SETTLE_MS)
      for (const item of items) {
        const key = item.key + (item.urgent ? ':urgent' : '');
        if (known.has(key)) continue;
        const what = !item.urgent && item.kind === 'room'
            ? 'Nuova sala · ' + item.label
            : null; // new tables: stored by the server in the chat for everyone (lobby-hub.js)
        if (what)
          notice({
            text: what,
            label: item.verb,
            urgent: item.urgent,
            action: () => find(item.key)?.click()
          });
      }
    known = keys;
  }
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(build, 120);
  };
  const observer = new MutationObserver(schedule);
  for (const [id] of SOURCES) {
    const box = $(id);
    if (box) observer.observe(box, { childList: true, subtree: true, characterData: true, attributes: true });
  }
  schedule();
  return { refresh: schedule };
}
