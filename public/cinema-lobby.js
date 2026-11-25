// Cinema seen from the app: the room list in the Lobby, the authenticated WebSocket (it stays here, never in the
// iframe), the Cinema iframe and its messages, and the reduced mode behind picture in picture.
const $ = id => document.getElementById(id);

export function createCinemaLobby({
  tg,
  token,
  readAppearance,
  safeInsets,
  enterFullscreen,
  leaveRoom,
  selectPage,
  projectionChanged,
  renderNow
}) {
  let cinemaSocket = null,
    cinemaRetry = 0,
    cinemaDelay = 700,
    cinemaReady = false;
  let cinemaRooms = { rooms: [], active: null },
    cinemaFavorites = null,
    cinemaEntry = null,
    cinemaRoom = null,
    cinemaLobbyMessage = '';
  let cinemaLookup = null;
  // With picture in picture open, "← Lobby" only reduces the Cinema: the room stays connected out of sight,
  // the video keeps playing in its small window and "Adesso" offers the way back.
  let cinemaMinimized = false,
    cinemaPip = false;
  const cinemaOpen = () => !$('cinema-overlay').hidden || cinemaMinimized;

  function cinemaPost(type, payload = {}) {
    if (cinemaReady)
      $('cinema-frame').contentWindow?.postMessage({ type: 'cinema:' + type, ...payload }, location.origin);
  }
  function renderCinemaLobby() {
    const connected = cinemaSocket?.readyState === 1,
      list = $('cinema-rooms');
    $('open-cinema').disabled = !connected;
    const status = $('cinema-lobby-status');
    status.textContent =
      cinemaLobbyMessage || (connected ? 'Nessuna sala aperta.' : 'Collegamento al cinema…');
    // Every open room is listed, empty or not, until it is closed.
    const occupied = cinemaRooms.rooms;
    status.hidden = connected && occupied.length > 0 && !cinemaLobbyMessage;
    $('cinema-lobby').hidden = connected && !occupied.length && !cinemaLobbyMessage;
    const focused = document.activeElement?.dataset.cinemaRoom;
    list.replaceChildren(
      ...occupied.map(entry => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'alt cinema-room-card';
        button.disabled = !connected;
        button.dataset.cinemaRoom = entry.id;
        const title = document.createElement('strong'),
          channel = document.createElement('span'),
          people = document.createElement('small');
        title.textContent = 'Sala ' + entry.number;
        channel.textContent = entry.channel ?? 'In attesa di un canale';
        people.textContent = entry.viewers.length
          ? entry.viewers.length +
            (entry.viewers.length === 1 ? ' spettatore · ' : ' spettatori · ') +
            entry.viewers.map(p => p.name).join(', ')
          : 'Nessuno in sala';
        button.append(title, channel, people);
        button.onclick = () => openCinema(entry.id);
        return button;
      })
    );
    if (focused)
      Array.from(list.children)
        .find(el => el.dataset.cinemaRoom === focused)
        ?.focus();
    renderNow();
  }
  function cinemaSend(action) {
    const raw = JSON.stringify(action);
    if (
      raw &&
      raw.length <= (action?.type === 'screen-signal' ? 24576 : 4096) &&
      cinemaSocket?.readyState === 1 &&
      cinemaSocket.bufferedAmount < 64000
    ) {
      cinemaSocket.send(raw);
      return true;
    }
    cinemaPost('packet', { packet: { type: 'error', message: 'Comando non inviato. Riprova tra poco.' } });
    return false;
  }
  function enterCinema() {
    if (!cinemaReady || cinemaSocket?.readyState !== 1) return;
    if (cinemaEntry) {
      cinemaSend({ type: 'appearance', appearance: readAppearance() });
      if (cinemaSend(cinemaEntry)) cinemaEntry = null;
    } else if (cinemaRoom && !cinemaRooms.active) cinemaSend({ type: 'enter', room: cinemaRoom });
  }
  function retryCinema() {
    cinemaRetry = setTimeout(connectCinema, cinemaDelay);
    cinemaDelay = Math.min(10000, cinemaDelay * 2);
  }
  function connectCinema() {
    if (cinemaSocket || !token()) return;
    clearTimeout(cinemaRetry);
    let socket;
    try {
      socket = new WebSocket(location.origin.replace(/^http/, 'ws') + '/api/cinema/ws', [
        'checkmate',
        token()
      ]);
    } catch {
      retryCinema();
      return;
    }
    cinemaSocket = socket;
    socket.onopen = () => {
      if (cinemaSocket !== socket) return;
      cinemaDelay = 700;
      renderCinemaLobby();
      cinemaPost('connection', { connected: true });
      cinemaSend({ type: 'appearance', appearance: readAppearance() });
      enterCinema();
    };
    socket.onmessage = event => {
      if (cinemaSocket !== socket) return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'rooms') {
          const ended = cinemaMinimized && !cinemaPip && cinemaRooms.active?.screen && !packet.active?.screen;
          cinemaRooms = packet;
          if (ended || (clubRoom && !packet.rooms.some(entry => entry.id === clubRoom && entry.screenId))) {
            closeCinema();
            projectionChanged?.();
            return;
          }
          projectionChanged?.();
          if (packet.active && !cinemaOpen()) {
            cinemaSend({ type: 'leave' });
            return;
          }
          if (packet.active) cinemaRoom = packet.active.id;
          renderCinemaLobby();
        }
        if (packet.type === 'favorites') cinemaFavorites = packet;
        if (packet.type === 'room-closed' && packet.id === cinemaRoom) {
          closeCinema('La sala è stata chiusa.', false);
          return;
        }
        if (packet.type === 'error' && cinemaOpen() && !cinemaRooms.active) {
          closeCinema(packet.message);
          return;
        }
        cinemaPost('packet', { packet });
      } catch {}
    };
    socket.onclose = event => {
      if (cinemaSocket !== socket) return;
      cinemaSocket = null;
      cinemaRooms = { ...cinemaRooms, active: null };
      const expired = event.code === 4001 || event.code === 4003;
      if (expired) {
        cinemaRooms = { rooms: [], active: null };
        projectionChanged?.();
      }
      if (expired) cinemaLobbyMessage = 'Chiudi e riapri Binottoland dal bot.';
      renderCinemaLobby();
      cinemaPost('connection', { connected: false, message: expired ? cinemaLobbyMessage : undefined });
      if (!expired) retryCinema();
    };
  }
  let clubRoom = null;
  const sharePlayer = () => $('cinema-frame').contentWindow?.clubShare;
  function leaveCinema() {
    if (!cinemaMinimized && (cinemaPip || cinemaRooms.active?.screen || sharePlayer()?.capturing())) {
      minimizeCinema();
    } else closeCinema();
  }
  function clubStream(entry) {
    if (!entry && clubRoom) {
      closeCinema();
      return null;
    }
    if (!entry) return null;
    if (clubRoom && clubRoom !== entry.id) closeCinema();
    if (!cinemaOpen() && cinemaSocket?.readyState === 1) {
      clubRoom = cinemaRoom = entry.id;
      cinemaMinimized = true;
      cinemaEntry = { type: 'enter', room: entry.id };
      $('cinema-frame').src = '/cinema/index.html?v=14';
    }
    return cinemaMinimized && cinemaRoom === entry.id ? sharePlayer()?.stream(entry.screenId) : null;
  }
  function minimizeCinema() {
    if ($('cinema-overlay').hidden) return;
    cinemaMinimized = true;
    sharePlayer()?.background(!cinemaPip);
    $('cinema-overlay').hidden = true;
    tg?.BackButton?.hide();
    try {
      tg?.enableVerticalSwipes?.();
    } catch {}
    leaveRoom();
    selectPage('game');
    renderCinemaLobby();
  }
  function restoreCinema() {
    if (!cinemaMinimized) return;
    cinemaMinimized = false;
    clubRoom = null;
    sharePlayer()?.background(false);
    $('cinema-overlay').hidden = false;
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    tg?.BackButton?.show();
    renderNow();
  }
  function closeCinema(message = '', leave = true) {
    if (!cinemaOpen()) return;
    // Closed while reduced (picture in picture shut, room closed): the rest of the app is left as it is.
    const reduced = cinemaMinimized;
    clubRoom = null;
    cinemaMinimized = false;
    cinemaPip = false;
    if (leave) cinemaSend({ type: 'leave' });
    cinemaLookup?.abort();
    cinemaLookup = null;
    cinemaRoom = null;
    cinemaEntry = null;
    cinemaReady = false;
    cinemaRooms = { ...cinemaRooms, active: null };
    $('cinema-overlay').hidden = true;
    $('cinema-frame').src = 'about:blank';
    if (reduced) {
      cinemaLobbyMessage = message;
      renderCinemaLobby();
      return;
    }
    tg?.BackButton?.hide();
    try {
      tg?.enableVerticalSwipes?.();
    } catch {}
    leaveRoom();
    selectPage('game');
    cinemaLobbyMessage = message;
    renderCinemaLobby();
    ($('cinema-rooms').querySelector('button:not(:disabled)') || $('tab-game')).focus();
  }
  function openCinema(id) {
    if (cinemaMinimized) {
      if (!id || id === cinemaRoom) {
        restoreCinema();
        return;
      }
      closeCinema();
    }
    if (!$('cinema-overlay').hidden || cinemaSocket?.readyState !== 1) return;
    cinemaLobbyMessage = '';
    cinemaEntry = id ? { type: 'enter', room: id } : { type: 'create' };
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    $('cinema-overlay').hidden = false;
    $('cinema-frame').src = '/cinema/index.html?v=14';
    tg?.BackButton?.show();
  }
  $('open-cinema').onclick = () => openCinema();
  async function lookupCinemaYouTube(id, params) {
    if (!Number.isSafeInteger(id) || !params || typeof params !== 'object') return;
    cinemaLookup?.abort();
    const controller = new AbortController();
    cinemaLookup = controller;
    const timeout = setTimeout(() => controller.abort(), 32000);
    const query = new URLSearchParams();
    for (const key of ['mode', 'q', 'type', 'id', 'handle'])
      if (typeof params[key] === 'string') query.set(key, params[key].slice(0, 200));
    let result, error;
    try {
      const response = await fetch('/api/cinema/youtube?' + query, {
        headers: { Authorization: 'Bearer ' + token() },
        signal: controller.signal
      });
      result = await response.json().catch(() => null);
      if (response.status === 401) error = 'La sessione è scaduta. Chiudi e riapri Binottoland dal bot.';
      else if (!response.ok)
        error = result?.error || 'Ricerca YouTube non disponibile (HTTP ' + response.status + ').';
      else if (!Array.isArray(result?.items))
        error = 'Il server ha restituito una risposta YouTube incompleta.';
    } catch {
      error = controller.signal.aborted
        ? 'YouTube non ha risposto in tempo. Riprova.'
        : 'Collegamento al servizio YouTube interrotto. Riprova.';
    } finally {
      clearTimeout(timeout);
    }
    if (cinemaLookup === controller) {
      cinemaLookup = null;
      cinemaPost('youtube-result', { id, result, error });
    }
  }
  async function armCinemaGroup(source, stop) {
    const room = cinemaRoom;
    if (!room) {
      cinemaPost('group-armed', { error: 'Entra prima in una sala Cinema.' });
      return;
    }
    let result, error;
    try {
      const query = new URLSearchParams({ room });
      const response = await fetch('/api/cinema/group/arm?' + query, {
        method: stop ? 'DELETE' : 'POST',
        headers: { Authorization: 'Bearer ' + token() },
        signal: AbortSignal.timeout(15000)
      });
      result = response.status === 204 ? null : await response.json();
      if (!response.ok && !(stop && response.status === 404))
        error = result?.error || 'Collegamento Telegram non riuscito.';
    } catch {
      error = 'Telegram non raggiungibile. Riprova.';
    }
    if (room === cinemaRoom && source === $('cinema-frame').contentWindow)
      cinemaPost('group-armed', { result, error, stopped: stop && !error });
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== $('cinema-frame').contentWindow || !cinemaOpen())
      return;
    const data = event.data;
    if (data?.type === 'cinema:ready') {
      cinemaReady = true;
      sharePlayer()?.background(cinemaMinimized && !cinemaPip);
      cinemaPost('insets', { insets: safeInsets(tg) });
      cinemaPost('connection', { connected: cinemaSocket?.readyState === 1 });
      if (cinemaFavorites) cinemaPost('packet', { packet: cinemaFavorites });
      enterCinema();
      return;
    }
    if (data?.type === 'cinema:exit') {
      leaveCinema();
      return;
    }
    if (data?.type === 'cinema:pip') {
      cinemaPip = data.active === true;
      // Small window shut while reduced: the X (video paused) leaves the room, "back to tab" returns to it.
      if (!cinemaPip && cinemaMinimized) {
        if (data.paused) closeCinema();
        else restoreCinema();
      }
      return;
    }
    if (data?.type === 'cinema:action') cinemaSend(data.action);
    if (data?.type === 'cinema:youtube-search') lookupCinemaYouTube(data.id, data.params);
    if (data?.type === 'cinema:group-arm') armCinemaGroup(event.source, data.stop === true);
  });
  // Lines for "Adesso": the reduced room first (way back), then the other rooms with people inside.
  function nowItems() {
    const items = [];
    const watching = cinemaMinimized && cinemaRooms.rooms.find(entry => entry.id === cinemaRoom);
    if (cinemaMinimized)
      items.push({
        rank: -1,
        text:
          'Cinema · stai guardando' +
          (watching
            ? ' la Sala ' + watching.number + (watching.channel ? ' · ' + watching.channel : '')
            : ''),
        label: 'Torna',
        action: restoreCinema
      });
    for (const entry of cinemaRooms.rooms)
      if (entry.viewers.length && !(cinemaMinimized && entry.id === cinemaRoom))
        items.push({
          rank: 3,
          text:
            'Cinema · Sala ' +
            entry.number +
            (entry.channel ? ' · ' + entry.channel : '') +
            ' · ' +
            entry.viewers.length +
            (entry.viewers.length === 1 ? ' spettatore' : ' spettatori'),
          label: 'Entra',
          action: () => openCinema(entry.id)
        });
    return items;
  }
  return {
    clubStream,
    projection: () =>
      cinemaRooms.rooms.find(r => r.id === cinemaRoom && r.screenId) ||
      cinemaRooms.rooms.find(r => r.screenId) ||
      cinemaRooms.rooms.find(r => r.projection) ||
      cinemaRooms.rooms.find(r => r.channel) ||
      cinemaRooms.rooms[0] ||
      null,
    connect: connectCinema,
    post: cinemaPost,
    open: openCinema,
    leave: leaveCinema,
    nowItems,
    visible: () => !$('cinema-overlay').hidden
  };
}
