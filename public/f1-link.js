// F1 on paper! seen from the app: the game (draw a track, race it in 3D) in its iframe.
// Alone (vs the AI, on the same phone) the game needs nothing from here. Online the app does the network:
// it creates the race with the drawn track (the server posts the bell notice with the drivers wanted),
// joins, keeps the race in sync by polling and sends the moves; the iframe only shows and asks.
// Telegram stays here too: safe-area insets, Back, haptics, closing confirmation while racing.
const $ = id => document.getElementById(id);

export function createF1Link({ tg, me, request, onError, enterFullscreen, sendPresence, safeInsets, games, roomClosed }) {
  const overlay = $('f1-overlay'),
    frame = $('f1-frame');
  let room = null,
    snapshot = null,
    track = null,
    polling = false,
    pending = false,
    sync = 0,
    skew = 0;
  // server clock minus this phone's clock (turn countdown in the game)
  const clock = result => {
    if (typeof result?.now === 'number') skew = result.now - Date.now();
  };
  const post = (type, payload = {}) => {
    if (!overlay.hidden) frame.contentWindow?.postMessage({ type: 'f1:' + type, ...payload }, location.origin);
  };
  const identity = () => {
    const who = me();
    if (who) post('identity', { player: who.player, name: who.name });
  };
  function publish(ack = false) {
    if (snapshot && track) post('state', { state: snapshot, track, player: me()?.player, ack, skew });
  }
  async function loadTrack(selected) {
    const result = await request('/api/f1/' + selected + '/track');
    track = result.track;
  }
  function show(online) {
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    overlay.hidden = false;
    frame.src = '/gara/index.html?v=2' + (online ? '&online=1' : '');
    tg?.BackButton?.show();
  }
  let failures = 0;
  function startSync() {
    clearInterval(sync);
    failures = 0;
    sync = setInterval(poll, 900);
  }
  async function poll() {
    const selected = room;
    if (!selected || !snapshot || document.hidden || polling) return;
    polling = true;
    try {
      const result = await request('/api/f1/' + selected + '/state?after=' + snapshot.revision);
      clock(result);
      if (failures >= 3) post('net', { lost: false, message: 'Collegamento ripreso.' });
      failures = 0;
      if (room === selected && result.state && result.state.revision >= snapshot.revision) {
        snapshot = result.state;
        publish();
      }
    } catch (error) {
      if (room !== selected) return;
      if (error.status === 404) gone(selected);
      // dopo tre richieste fallite di fila si dice cosa succede (prima il gioco restava fermo senza dire niente)
      else if (++failures >= 3)
        post('net', {
          lost: true,
          message:
            error.status === 401 || error.status === 403
              ? 'Sessione scaduta: chiudi e riapri Binottoland dal bot.'
              : 'Collegamento perso, riprovo…'
        });
    } finally {
      polling = false;
    }
  }
  // Open a race from the Lobby, the bell or "Riprendi": join while there are seats, otherwise watch.
  async function open(selected) {
    const who = me();
    if (!who || pending || (!overlay.hidden && room === selected)) return;
    pending = true;
    try {
      const path = '/api/f1/' + selected;
      // chi non è già dentro guarda la sala d'attesa e sceglie lui se entrare (tasto «Entra» nel gioco)
      const result = await request(path + '/state');
      if (!overlay.hidden) close();
      clock(result);
      room = selected;
      snapshot = result.state;
      await loadTrack(selected);
      show(true);
      startSync();
      sendPresence();
    } catch (error) {
      onError(error.message);
    } finally {
      pending = false;
    }
  }
  function close() {
    if (overlay.hidden) return;
    clearInterval(sync);
    room = snapshot = track = null;
    overlay.hidden = true;
    frame.src = 'about:blank';
    tg?.BackButton?.hide();
    try {
      tg?.disableClosingConfirmation?.();
      tg?.enableVerticalSwipes?.();
    } catch {}
    sendPresence();
    $('play-f1').focus();
  }
  function gone(selected) {
    close();
    roomClosed(selected);
    onError('Gara chiusa.');
  }
  $('play-f1').onclick = () => {
    if (overlay.hidden) show(false);
  };
  frame.addEventListener('load', () => {
    if (!overlay.hidden) {
      frame.focus();
      post('insets', { insets: safeInsets(tg) });
    }
  });
  window.addEventListener('message', async event => {
    if (overlay.hidden || event.origin !== location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.type === 'f1:ready') {
      post('insets', { insets: safeInsets(tg) });
      identity();
      publish();
    } else if (data?.type === 'f1:exit') close();
    else if (data?.type === 'f1:racing') {
      try {
        if (data.on) tg?.enableClosingConfirmation?.();
        else tg?.disableClosingConfirmation?.();
      } catch {}
    } else if (data?.type === 'f1:haptic') {
      const hf = tg?.HapticFeedback;
      try {
        if (data.kind === 'selection') hf?.selectionChanged();
        else if (data.kind === 'impact' && ['light', 'medium', 'heavy'].includes(data.style))
          hf?.impactOccurred(data.style);
        else if (data.kind === 'notification' && ['error', 'success', 'warning'].includes(data.style))
          hf?.notificationOccurred(data.style);
      } catch {}
    } else if (data?.type === 'f1:create') {
      // the creator has drawn the track: open the race online (the server checks the track again)
      if (pending || room || !me()) return;
      pending = true;
      try {
        const result = await request('/api/create', {
          game: 'f1',
          track: data.track,
          laps: data.laps,
          time: data.time
        });
        clock(result);
        room = result.state.room;
        snapshot = result.state;
        await loadTrack(room);
        publish(true);
        startSync();
        sendPresence();
      } catch (error) {
        post('error', { message: error.message });
      } finally {
        pending = false;
      }
    } else if (data?.type === 'f1:action' && ['start', 'play', 'close', 'leave', 'join', 'abandon'].includes(data.kind)) {
      const selected = room;
      if (!selected) return;
      try {
        const result = await request('/api/f1/' + selected + '/' + data.kind, data.payload || {});
        if (room !== selected) return;
        clock(result);
        if (data.kind === 'close' || data.kind === 'leave') {
          close();
          roomClosed(selected);
          return;
        }
        // abbandono: la partita continua col pilota automatico, chi esce torna a Binottoland
        if (data.kind === 'abandon') {
          close();
          return;
        }
        if (result.state.revision >= snapshot.revision) snapshot = result.state;
        publish(true);
      } catch (error) {
        if (room !== selected) return;
        if (error.status === 404) gone(selected);
        else post('error', { message: error.message });
      }
    }
  });
  return {
    open,
    close,
    back: () => post('back'),
    visible: () => !overlay.hidden,
    room: () => room,
    pending: () => pending,
    insets: insets => post('insets', { insets })
  };
}
