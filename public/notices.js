// Lobby bell: personal game notices, outside the group chat.
// Two sources: notices stored by the server for everyone (a table opened by someone else, a win; lobby-hub.js) and
// notices made in this browser (your turn, a new Cinema or Blackboard room; lobby-chips.js).
// Read / unread and the ones removed with × are remembered on this device, so everyone has their own.
const $ = id => document.getElementById(id);
const READ_KEY = 'binottoland-notices-read',
  HIDDEN_KEY = 'binottoland-notices-hidden';
const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
function ago(at) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'ora';
  if (minutes < 60) return minutes + ' min fa';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + ' h fa';
  return Math.round(hours / 24) === 1 ? 'ieri' : Math.round(hours / 24) + ' giorni fa';
}

// me(): signed-in user; isOpen(room) / open(room): a stored table notice gets "Entra" while the table is open.
export function createNotices({ me, isOpen, open }) {
  let server = [],
    local = [],
    pinned = [],
    localId = 0,
    readAt = load(READ_KEY, 0),
    hidden = new Set(load(HIDDEN_KEY, []));

  const bell = document.createElement('button');
  bell.type = 'button';
  bell.id = 'notices-bell';
  bell.className = 'notices-bell';
  bell.innerHTML = '<span aria-hidden="true">🔔</span><b class="notices-count" hidden></b>';
  (document.querySelector('.profile-bar') || $('lobby'))?.append(bell);

  const sheet = document.createElement('div');
  sheet.id = 'notices-sheet';
  sheet.className = 'notices-sheet';
  sheet.hidden = true;
  sheet.innerHTML =
    '<section class="notices-panel" role="dialog" aria-modal="true" aria-labelledby="notices-title">' +
    '<div class="notices-head"><h3 id="notices-title">Avvisi</h3>' +
    '<button type="button" class="alt" id="notices-read-all">Segna tutti letti</button></div>' +
    '<div id="notices-list" class="notices-list"></div></section>';
  document.body.append(sheet);

  // Your own actions are not news for you: no notice for a table you opened.
  const list = () =>
    [...server.filter(n => n.userId !== me()?.id), ...local]
      .filter(n => !hidden.has(n.id))
      .sort((a, b) => b.at - a.at);

  function render() {
    const items = list(),
      unread = items.filter(n => n.at > readAt).length + pinned.filter(p => p.urgent).length,
      count = bell.querySelector('.notices-count');
    count.hidden = !unread;
    count.textContent = unread > 9 ? '9+' : String(unread);
    bell.setAttribute('aria-label', unread ? 'Avvisi: ' + unread + ' nuovi' : 'Avvisi');
    // la lista si aggiorna sempre (anche a campanella chiusa): così la bacheca della Lobby 3D è sempre in pari
    const box = $('notices-list');
    if (!box) return;
    if (!items.length && !pinned.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Nessun avviso. Qui arrivano i tavoli aperti, le vittorie e quando tocca a te.';
      box.replaceChildren(empty);
      return;
    }
    box.replaceChildren(
      ...[...pinned, ...items].map(notice => {
        const row = document.createElement('article');
        row.className = notice.pinned
          ? 'notice-item pinned' + (notice.urgent ? ' urgent' : '')
          : 'notice-item' + (notice.at > shownFrom ? ' unread' : '') + (notice.urgent ? ' urgent' : '');
        const copy = document.createElement('div');
        copy.className = 'notice-copy';
        const text = document.createElement('span');
        text.textContent = notice.text;
        const when = document.createElement('small');
        when.textContent = notice.pinned ? notice.detail || 'Partita aperta' : ago(notice.at);
        copy.append(text, when);
        row.append(copy);
        const label =
          notice.label || (notice.notice === 'table' && notice.room && isOpen(notice.room) ? 'Entra' : '');
        if (label) {
          const go = document.createElement('button');
          go.type = 'button';
          go.textContent = label;
          go.onclick = () => {
            if (!notice.pinned) {
              hidden.add(notice.id);
              store(HIDDEN_KEY, [...hidden].slice(-200));
            }
            close();
            if (notice.action) notice.action();
            else open(notice.room);
          };
          row.append(go);
        }
        // Open games stay in the bell until they close: no ×.
        if (notice.pinned) return row;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'notice-remove';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Cancella avviso');
        remove.onclick = () => {
          hidden.add(notice.id);
          store(HIDDEN_KEY, [...hidden].slice(-200));
          render();
        };
        row.append(remove);
        return row;
      })
    );
  }
  // While the panel is open the new ones stay highlighted; they count as read from the moment it opens.
  let shownFrom = readAt;
  function markRead() {
    readAt = Date.now();
    store(READ_KEY, readAt);
  }
  function close() {
    sheet.hidden = true;
    render();
  }
  bell.onclick = () => {
    shownFrom = readAt;
    sheet.hidden = false;
    markRead();
    render();
  };
  sheet.onclick = event => {
    if (event.target === sheet) close();
  };
  $('notices-read-all').onclick = () => {
    markRead();
    shownFrom = readAt;
    render();
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !sheet.hidden) close();
  });
  render();
  return {
    // Server notices from the Lobby payload.
    set: items => {
      server = Array.isArray(items) ? items : [];
      render();
    },
    // Your open games and single-player tables: { id, text, detail, label, action, urgent }, always on top.
    setPinned: items => {
      pinned = (items || []).map(item => ({ ...item, pinned: true }));
      render();
    },
    // { text, label, action, urgent }: a notice made in this browser.
    add: item => {
      local = [...local, { ...item, id: 'local-' + ++localId + '-' + Date.now(), at: Date.now() }].slice(-20);
      render();
    },
    render,
    // Gli avvisi come li mostra la campanella (partite aperte in cima): per la bacheca della Lobby 3D.
    items: () =>
      [...pinned, ...list()].map(n => ({ id: n.id, text: n.text, pinned: !!n.pinned, urgent: !!n.urgent })),
    // Bacheca aperta: gli avvisi contano come letti (il numero sulla campanella si azzera)
    seen: () => {
      markRead();
      render();
    }
  };
}
