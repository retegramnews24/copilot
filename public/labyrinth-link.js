// Labyrinth seen from the app: shared expeditions (play or watch) and the developer solo run, in their iframe.
// Authenticated multiplayer transport stays in this container, never in the iframe.
// leaveTable(): closes any open board-game table before an expedition takes the screen.
const $ = id => document.getElementById(id);

export function createLabyrinthLink({
  tg,
  token,
  me,
  request,
  onError,
  trace,
  enterFullscreen,
  sendPresence,
  safeInsets,
  leaveTable
}) {
  let labyrinthRoom = null,
    labyrinthWatch = false,
    labyrinthSocket = null,
    labyrinthLastState = null,
    labyrinthRetry = 0,
    labyrinthBeat = 0,
    labyrinthOpening = false;
  const labyrinthOverlay = $('labyrinth-overlay'),
    labyrinthFrame = $('labyrinth-frame');
  function labPost(data) {
    if (!labyrinthOverlay.hidden) labyrinthFrame.contentWindow?.postMessage(data, location.origin);
  }
  function connectExpedition() {
    if (!labyrinthRoom || !token()) return;
    clearTimeout(labyrinthRetry);
    if (labyrinthSocket) {
      labyrinthSocket.onclose = null;
      labyrinthSocket.close();
    }
    const selected = labyrinthRoom,
      socket = new WebSocket(
        location.origin.replace(/^http/, 'ws') +
          '/api/labyrinth/' +
          selected +
          '/ws' +
          (labyrinthWatch ? '?watch=1' : ''),
        ['checkmate', token()]
      );
    labyrinthSocket = socket;
    socket.onopen = () => {
      if (selected !== labyrinthRoom) return;
      labPost({ type: 'labyrinth:connection', connected: true });
      clearInterval(labyrinthBeat);
      labyrinthBeat = setInterval(() => {
        if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'heartbeat' }));
      }, 10000);
      sendPresence();
    };
    socket.onmessage = e => {
      if (selected !== labyrinthRoom) return;
      try {
        const packet = JSON.parse(e.data);
        if (packet.type === 'state') {
          labyrinthLastState = packet.state;
          if (packet.state.deleted) {
            closeLabyrinth();
            onError('Spedizione eliminata.');
            return;
          }
        }
        labPost({ type: 'labyrinth:packet', packet });
      } catch {
        trace('LAB', 'Pacchetto non valido');
      }
    };
    socket.onclose = e => {
      if (selected !== labyrinthRoom) return;
      clearInterval(labyrinthBeat);
      labPost({ type: 'labyrinth:connection', connected: false });
      if (e.code === 4000 || e.code === 4001) {
        labPost({
          type: 'labyrinth:notice',
          message:
            e.code === 4000 ? 'Spedizione aperta in un’altra finestra.' : 'Riapri Binottoland per accedere.'
        });
        return;
      }
      labyrinthRetry = setTimeout(connectExpedition, 2500);
    };
  }
  async function openLabyrinth(selected, watch = false) {
    if (!me() || labyrinthOpening) return;
    labyrinthOpening = true;
    try {
      const result = await request(
        '/api/labyrinth/' + selected + (watch ? '/state' : '/join'),
        watch ? undefined : {}
      );
      leaveTable();
      labyrinthRoom = selected;
      labyrinthWatch = watch;
      labyrinthLastState = result.state;
      enterFullscreen();
      try {
        tg?.disableVerticalSwipes?.();
      } catch {}
      labyrinthOverlay.hidden = false;
      labyrinthFrame.src = '/labyrinth/index.html?multiplayer=1&v=dev3';
      tg?.BackButton?.show();
      connectExpedition();
      trace('LAB', 'Spedizione ' + result.state.number + (watch ? ' · spettatore' : ''));
      sendPresence();
    } catch (e) {
      onError(e.message);
    } finally {
      labyrinthOpening = false;
    }
  }
  $('play-labyrinth').onclick = async () => {
    if (!me() || labyrinthOpening) return;
    $('play-labyrinth').disabled = true;
    try {
      const result = await request('/api/create', { game: 'labyrinth' });
      await openLabyrinth(result.state.room, false);
    } catch (e) {
      onError(e.message);
    } finally {
      $('play-labyrinth').disabled = false;
    }
  };
  function closeLabyrinth() {
    if (labyrinthOverlay.hidden) return;
    clearTimeout(labyrinthRetry);
    clearInterval(labyrinthBeat);
    if (labyrinthSocket) {
      labyrinthSocket.onclose = null;
      labyrinthSocket.close();
      labyrinthSocket = null;
    }
    labyrinthRoom = null;
    labyrinthLastState = null;
    try {
      tg?.enableVerticalSwipes?.();
    } catch {}
    labyrinthOverlay.hidden = true;
    labyrinthFrame.src = 'about:blank';
    sendPresence();
    tg?.BackButton?.hide();
    $('play-labyrinth').focus();
    trace('LAB', 'Ritorno a Binottoland');
  }
  function sendLabyrinthIdentity() {
    const identity = me();
    if (!labyrinthOverlay.hidden) {
      labPost({ type: 'labyrinth:insets', insets: safeInsets(tg) });
      if (identity && !labyrinthRoom) labPost({ type: 'labyrinth:identity', player: identity.id });
    }
    if (!labyrinthOverlay.hidden && identity && labyrinthRoom) {
      labPost({ type: 'labyrinth:insets', insets: safeInsets(tg) });
      labPost({
        type: 'labyrinth:multiplayer',
        room: labyrinthRoom,
        player: identity.id,
        watch: labyrinthWatch,
        state: labyrinthLastState
      });
      labPost({ type: 'labyrinth:connection', connected: labyrinthSocket?.readyState === 1 });
    }
  }
  labyrinthFrame.addEventListener('load', sendLabyrinthIdentity);
  window.addEventListener('message', event => {
    if (
      event.origin !== location.origin ||
      event.source !== labyrinthFrame.contentWindow ||
      labyrinthOverlay.hidden
    )
      return;
    if (event.data?.type === 'labyrinth:ready') sendLabyrinthIdentity();
    else if (event.data?.type === 'labyrinth:net') {
      const packet = event.data.packet;
      if (packet && ['pose', 'action'].includes(packet.type) && JSON.stringify(packet).length <= 2048) {
        if (labyrinthSocket?.readyState === 1) labyrinthSocket.send(JSON.stringify(packet));
        else if (packet.type === 'action')
          labPost({
            type: 'labyrinth:packet',
            packet: { type: 'ack', request: packet.request, ok: false, error: 'Riconnessione in corso.' }
          });
      }
    } else if (event.data?.type === 'labyrinth:exit') closeLabyrinth();
    else if (
      event.data?.type === 'labyrinth:archive' &&
      labyrinthRoom &&
      !labyrinthWatch &&
      labyrinthLastState?.arenaResult &&
      !labyrinthLastState.archived
    ) {
      request('/api/labyrinth/' + labyrinthRoom + '/archive', {}).catch(error =>
        labPost({ type: 'labyrinth:notice', message: error.message })
      );
    } else if (event.data?.type === 'labyrinth:trace' && typeof event.data.message === 'string')
      trace('LAB', event.data.message.slice(0, 200));
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && labyrinthSocket?.readyState === 1)
      labyrinthSocket.send(JSON.stringify({ type: 'heartbeat' }));
  });
  // Developer mode only: the solo labyrinth without an expedition.
  $('solo-labyrinth').onclick = () => {
    enterFullscreen();
    labyrinthOverlay.hidden = false;
    labyrinthFrame.src = '/labyrinth/index.html?dev=1&v=dev3';
    tg?.BackButton?.show();
  };
  const insets = value => {
    if (!labyrinthOverlay.hidden)
      labyrinthFrame.contentWindow?.postMessage({ type: 'labyrinth:insets', insets: value }, location.origin);
  };
  return {
    open: openLabyrinth,
    close: closeLabyrinth,
    visible: () => !labyrinthOverlay.hidden,
    room: () => labyrinthRoom,
    insets
  };
}
