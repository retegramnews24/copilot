// Arcade overlay seen from the app: Number Connect, Pong (solo or online), Giulio Simulator, Binotto Simulator and
// the Blackboard rooms share one iframe. Online Pong and the Blackboard keep their authenticated sockets here.
import { blackboardLink } from './blackboard/link.js?v=ed710cda29';
import { renderNumberLeaders } from './leaderboard.js?v=ce436079f5';
const $ = id => document.getElementById(id);

export function createArcadeLink({
  tg,
  token,
  me,
  request,
  onError,
  enterFullscreen,
  sendPresence,
  safeInsets,
  readAppearance,
  refreshSession,
  renderNow,
  selectPage
}) {
  let pongRoom = null,
    pongSocket = null,
    pongRetry = 0,
    pongEpoch = 0,
    pongOpening = false;
  let blackboardLobbyRooms = [],
    arcadeLaunch,
    simulatorBackReady = false,
    blackboardOpening = false;
  const arcadeOverlay = $('arcade-overlay'),
    arcadeFrame = $('arcade-frame');
  function sendArcadeInsets(insets = safeInsets(tg)) {
    if (!$('arcade-overlay').hidden)
      $('arcade-frame').contentWindow?.postMessage({ type: 'arcade:insets', insets }, location.origin);
  }
  const blackboard = blackboardLink(arcadeFrame, token, readAppearance, renderBlackboardRooms, () => {
    closeArcade();
    selectPage('game');
    $('tab-game').focus();
  });
  function renderBlackboardRooms(rooms, state) {
    const list = $('blackboard-rooms'),
      status = $('blackboard-lobby-status');
    const online = state === 'online',
      focused = document.activeElement?.dataset.blackboardRoom;
    blackboardLobbyRooms = online ? rooms : [];
    // Every open board is listed, empty or not, until it is deleted.
    status.hidden = online && rooms.length > 0;
    $('blackboard-lobby').hidden = online && !rooms.length;
    status.textContent = online
      ? 'Nessuna sala aperta.'
      : state === 'expired'
        ? 'Riapri Binottoland da Telegram.'
        : 'Collegamento alle lavagne…';
    list.replaceChildren(
      ...rooms.map(entry => {
        const button = document.createElement('button');
        const title = document.createElement('strong'),
          people = document.createElement('small');
        button.type = 'button';
        button.className = 'alt cinema-room-card';
        button.disabled = !online;
        button.dataset.blackboardRoom = entry.id;
        title.textContent = 'Sala ' + entry.number;
        people.textContent = entry.people.length
          ? entry.people.map(person => person.name).join(', ')
          : 'Nessuno in sala';
        button.append(title, people);
        button.onclick = () => openBlackboard(button, entry.id);
        return button;
      })
    );
    if (focused)
      Array.from(list.children)
        .find(el => el.dataset.blackboardRoom === focused)
        ?.focus();
    renderNow();
  }
  function openBlackboard(button, id) {
    if (!arcadeOverlay.hidden) return;
    blackboard.open(id);
    openArcade(button, 'blackboard', 'Blackboard spazio libero');
  }
  $('open-blackboard').onclick = async () => {
    if (blackboardOpening || !arcadeOverlay.hidden) return;
    const button = $('open-blackboard');
    blackboardOpening = true;
    button.disabled = true;
    try {
      const entry = await request('/api/blackboard/create', {});
      openBlackboard(button, entry.id);
    } catch (error) {
      onError(error.message);
    } finally {
      blackboardOpening = false;
      button.disabled = !me();
    }
  };
  function openArcade(button, game, title, online = false) {
    if (!arcadeOverlay.hidden) return;
    arcadeLaunch = button;
    simulatorBackReady = false;
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    arcadeOverlay.hidden = false;
    arcadeFrame.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin' + (game === 'binotto-simulator' ? ' allow-forms' : '')
    );
    arcadeFrame.title = title;
    arcadeFrame.src =
      game === 'blackboard'
        ? '/blackboard/index.html?v=6'
        : '/arcade/' + game + '.html' + (game === 'pong' ? (online ? '?v=3&online=1' : '?v=3') : '?v=2');
    tg?.BackButton?.show();
  }
  function closeArcade() {
    if (arcadeOverlay.hidden) return;
    blackboard.stop();
    stopPong();
    arcadeOverlay.hidden = true;
    arcadeFrame.src = 'about:blank';
    tg?.BackButton?.hide();
    try {
      tg?.enableVerticalSwipes?.();
    } catch {}
    const roomButton = arcadeLaunch?.dataset.blackboardRoom;
    if (roomButton)
      Array.from($('blackboard-rooms').children)
        .find(el => el.dataset.blackboardRoom === roomButton)
        ?.focus();
    else arcadeLaunch?.focus();
  }
  for (const [game, title] of [
    ['number-connect', 'Number Connect'],
    ['pong', 'Pong'],
    ['giulio-simulator', 'Giulio Simulator'],
    ['binotto-simulator', 'Binotto Simulator']
  ]) {
    const button = $('play-' + game);
    button.onclick = () => openArcade(button, game, title);
  }
  function pongPost(type, data = {}) {
    if (!arcadeOverlay.hidden && arcadeFrame.title === 'Pong') {
      arcadeFrame.contentWindow?.postMessage({ type: 'pong:' + type, ...data }, location.origin);
    }
  }
  function stopPong() {
    const wasOnline = !!pongRoom;
    pongEpoch++;
    pongOpening = false;
    pongRoom = null;
    clearTimeout(pongRetry);
    $('create-pong').disabled = !me();
    if (pongSocket) {
      pongSocket.onclose = null;
      pongSocket.close();
      pongSocket = null;
    }
    if (wasOnline) sendPresence();
  }
  function connectPong() {
    if (!pongRoom || pongSocket) return;
    const selected = pongRoom;
    const socket = (pongSocket = new WebSocket(
      location.origin.replace(/^http/, 'ws') + '/api/pong/' + selected + '/ws',
      ['checkmate', token()]
    ));
    socket.onmessage = event => {
      if (pongSocket !== socket) return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'state') pongPost('state', { state: packet.state, player: me().player });
      } catch {}
    };
    socket.onclose = async event => {
      if (pongSocket !== socket) return;
      pongSocket = null;
      if (event.code === 4000 || event.code === 4001) {
        stopPong();
        pongPost('status', {
          online: false,
          error: event.code === 4000 ? 'Pong aperto in un’altra finestra.' : 'Riapri Binottoland da Telegram.'
        });
        return;
      }
      pongPost('status', { online: true, connected: false });
      try {
        const { state } = await request('/api/pong/' + selected + '/state');
        if (state.players.length === 2 && !state.players.some(p => p.id === me().player))
          throw Object.assign(Error('La sala Pong è al completo.'), { status: 409 });
      } catch (e) {
        if (pongRoom !== selected) return;
        if (e.status === 404 || e.status === 409) {
          stopPong();
          pongPost('status', { online: false, error: e.message });
          return;
        }
      }
      if (pongRoom === selected) pongRetry = setTimeout(connectPong, 850);
    };
  }
  async function openPong(selected, mode = 'classic', inside = false) {
    if (pongOpening || pongRoom) return;
    const identity = me();
    if (!identity) {
      if (inside)
        pongPost('status', { online: false, error: 'Apri Binottoland da Telegram per giocare online.' });
      return;
    }
    if (!inside && !arcadeOverlay.hidden) return;
    pongOpening = true;
    const epoch = ++pongEpoch;
    $('create-pong').disabled = true;
    try {
      const { state } = selected
        ? await request('/api/pong/' + selected + '/state')
        : await request('/api/create', { game: 'pong', mode });
      if (epoch !== pongEpoch) return;
      if (state.players.length === 2 && !state.players.some(p => p.id === identity.player))
        throw Error('La sala Pong è al completo.');
      pongRoom = state.room;
      if (inside) {
        pongPost('status', { online: true, connected: false });
        connectPong();
      } else openArcade($('create-pong'), 'pong', 'Pong', true);
      sendPresence();
    } catch (e) {
      if (epoch !== pongEpoch) return;
      if (inside) pongPost('status', { online: false, error: e.message });
      else onError(e.message);
    } finally {
      if (epoch === pongEpoch) {
        pongOpening = false;
        $('create-pong').disabled = !me();
      }
    }
  }
  $('create-pong').onclick = () => openPong();
  arcadeFrame.addEventListener('load', () => {
    if (!arcadeOverlay.hidden) {
      arcadeFrame.focus();
      sendArcadeInsets();
    }
  });
  window.addEventListener('message', event => {
    if (
      arcadeOverlay.hidden ||
      event.origin !== location.origin ||
      event.source !== arcadeFrame.contentWindow
    )
      return;
    if (event.data?.type === 'simulator:ready' && arcadeFrame.title === 'Binotto Simulator') {
      const source = event.source;
      (async () => {
        try {
          await refreshSession();
          if (source === arcadeFrame.contentWindow && !arcadeOverlay.hidden)
            source.postMessage({ type: 'simulator:session', token: token() }, location.origin);
        } catch (e) {
          onError(e.message || 'Riapri Binottoland da Telegram.');
        }
      })();
    } else if (event.data?.type === 'arcade:ready') {
      simulatorBackReady = arcadeFrame.title === 'Binotto Simulator';
      sendArcadeInsets();
    } else if (event.data?.type === 'arcade:exit') closeArcade();
    else if (arcadeFrame.title === 'Blackboard spazio libero') blackboard.receive(event.data);
    else if (arcadeFrame.title === 'Number Connect') {
      const source = event.source,
        data = event.data;
      if (data?.type === 'number-connect:ready') {
        source.postMessage({ type: 'number-connect:identity', player: me()?.player }, location.origin);
      } else if (
        data?.type === 'number-connect:score' &&
        Number.isInteger(data.run?.seed) &&
        Array.isArray(data.run.moves) &&
        data.run.moves.length <= 20000
      ) {
        const seed = data.run.seed;
        const reply = ok => {
          if (
            !arcadeOverlay.hidden &&
            arcadeFrame.title === 'Number Connect' &&
            source === arcadeFrame.contentWindow
          ) {
            source.postMessage({ type: 'number-connect:result', seed, ok }, location.origin);
          }
        };
        request('/api/number-connect/score', data.run).then(
          result => {
            renderNumberLeaders(result.leaders);
            reply(true);
          },
          () => reply(false)
        );
      }
    } else if (arcadeFrame.title === 'Pong') {
      const data = event.data;
      if (data?.type === 'pong:ready') {
        pongPost('identity', { name: me()?.name });
        if (pongRoom) connectPong();
      } else if (data?.type === 'pong:join') openPong(null, data.mode, true);
      else if (data?.type === 'pong:leave') stopPong();
      else if (
        (data?.type === 'pong:input' || data?.type === 'pong:command') &&
        pongSocket?.readyState === 1 &&
        pongSocket.bufferedAmount < 4096
      ) {
        const packet =
          data.type === 'pong:input'
            ? { type: 'input', direction: data.direction, target: data.target }
            : { type: data.action, mode: data.mode };
        const raw = JSON.stringify(packet);
        if (raw.length <= 200) pongSocket.send(raw);
      }
    }
  });
  // Telegram Back: Binotto Simulator handles it itself once ready (its own sub-pages), otherwise the overlay closes.
  function back() {
    if (arcadeFrame.title === 'Binotto Simulator' && simulatorBackReady)
      arcadeFrame.contentWindow?.postMessage({ type: 'simulator:back' }, location.origin);
    else closeArcade();
  }
  // Lines for "Adesso": Blackboard rooms with people inside.
  const nowItems = () =>
    blackboardLobbyRooms
      .filter(entry => entry.people.length)
      .map(entry => ({
        rank: 3,
        text: 'Lavagna · Sala ' + entry.number + ' · ' + entry.people.map(p => p.name).join(', '),
        label: 'Entra',
        action: button => openBlackboard(button, entry.id)
      }));
  return {
    visible: () => !arcadeOverlay.hidden,
    back,
    openPong,
    pongRoom: () => pongRoom,
    pongOpening: () => pongOpening,
    blackboardOpening: () => blackboardOpening,
    connectBlackboard: () => blackboard.connect(),
    insets: sendArcadeInsets,
    nowItems
  };
}
