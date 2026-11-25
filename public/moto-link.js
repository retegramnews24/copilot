// Moto Trial seen from the app: solo or online races in their iframe. The race WebSocket (authenticated) stays
// here, never in the iframe; the iframe receives state, poses and safe-area insets by postMessage.
const $ = id => document.getElementById(id);

export function createMotoLink({
  tg,
  token,
  me,
  request,
  onError,
  enterFullscreen,
  sendPresence,
  safeInsets
}) {
  let motoRace = null,
    motoSocket = null,
    motoOpening = false,
    motoRetry = 0,
    motoBeat = 0;
  const motoOverlay = $('moto-trial-overlay'),
    motoFrame = $('moto-trial-frame'),
    motoLaunch = $('play-moto-trial');
  function sendMotoInsets(insets = safeInsets(tg)) {
    if (!$('moto-trial-overlay').hidden)
      $('moto-trial-frame').contentWindow?.postMessage(
        { type: 'moto-trial:insets', insets },
        location.origin
      );
  }
  function motoPost(type, payload = {}) {
    if (!motoOverlay.hidden)
      motoFrame.contentWindow?.postMessage({ type: 'moto-trial:' + type, ...payload }, location.origin);
  }
  function sendMotoState() {
    sendMotoInsets();
    if (motoRace)
      motoPost('state', { state: motoRace, player: me().player, connected: motoSocket?.readyState === 1 });
  }
  function closeMotoTrial() {
    if (motoOverlay.hidden) return;
    clearTimeout(motoRetry);
    clearInterval(motoBeat);
    if (motoSocket) {
      motoSocket.onclose = null;
      motoSocket.close();
      motoSocket = null;
    }
    const wasRace = !!motoRace;
    motoRace = null;
    motoOverlay.hidden = true;
    motoFrame.src = 'about:blank';
    tg?.BackButton?.hide();
    try {
      tg?.enableVerticalSwipes?.();
    } catch {}
    if (wasRace) {
      sendPresence();
      $('create-moto-trial').focus();
    } else motoLaunch.focus();
  }
  function showMotoTrial(multiplayer = false) {
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    motoOverlay.hidden = false;
    motoFrame.src = '/moto-trial/index.html' + (multiplayer ? '?multiplayer=1&v=9' : '?v=9');
    tg?.BackButton?.show();
  }
  function connectMotoRace() {
    if (!motoRace || !token()) return;
    const selected = motoRace.room;
    const socket = (motoSocket = new WebSocket(
      location.origin.replace(/^http/, 'ws') + '/api/moto-trial/' + selected + '/ws',
      ['checkmate', token()]
    ));
    socket.onopen = () => {
      if (socket !== motoSocket) return;
      sendMotoState();
      motoBeat = setInterval(() => {
        if (socket.readyState === 1) socket.send('{"type":"heartbeat"}');
      }, 15000);
    };
    socket.onmessage = event => {
      if (socket !== motoSocket) return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'state') {
          motoRace = packet.state;
          sendMotoState();
        } else if (packet.type === 'pose') {
          const member = motoRace.players.find(p => p.id === packet.id);
          if (member) member.pose = packet.pose;
          motoPost('pose', { id: packet.id, pose: packet.pose });
        }
      } catch {}
    };
    socket.onclose = async event => {
      if (socket !== motoSocket) return;
      clearInterval(motoBeat);
      motoPost('connection', { connected: false });
      if (event.code === 4000 || event.code === 4001) {
        closeMotoTrial();
        onError(
          event.code === 4000 ? 'Corsa aperta in un’altra finestra.' : 'Chiudi e riapri Binottoland dal bot.'
        );
        return;
      }
      try {
        const { state } = await request('/api/moto-trial/' + selected + '/state');
        if (socket !== motoSocket) return;
        if (state.players.length >= 8 && !state.players.some(p => p.id === me().player)) {
          closeMotoTrial();
          onError('Corsa al completo.');
          return;
        }
      } catch (e) {
        if (socket !== motoSocket) return;
        if (e.status === 404) {
          closeMotoTrial();
          onError(e.message);
          return;
        }
      }
      motoRetry = setTimeout(connectMotoRace, 2400);
    };
  }
  async function openMotoRace(selected) {
    const identity = me();
    if (!identity || motoOpening || !motoOverlay.hidden) return;
    motoOpening = true;
    $('create-moto-trial').disabled = true;
    try {
      const { state } = selected
        ? await request('/api/moto-trial/' + selected + '/state')
        : await request('/api/create', { game: 'moto-trial' });
      if (state.players.length >= 8 && !state.players.some(p => p.id === identity.player))
        throw Error('Corsa al completo.');
      motoRace = state;
      showMotoTrial(true);
      connectMotoRace();
      sendPresence();
    } catch (e) {
      onError(e.message);
    } finally {
      motoOpening = false;
      $('create-moto-trial').disabled = !me();
    }
  }
  motoLaunch.onclick = () => {
    if (motoOverlay.hidden && !motoOpening) showMotoTrial();
  };
  $('create-moto-trial').onclick = () => openMotoRace();
  motoFrame.addEventListener('load', () => {
    if (!motoOverlay.hidden) {
      motoFrame.focus();
      sendMotoState();
    }
  });
  window.addEventListener('message', event => {
    if (motoOverlay.hidden || event.origin !== location.origin || event.source !== motoFrame.contentWindow)
      return;
    const data = event.data;
    if (data?.type === 'moto-trial:ready') sendMotoState();
    else if (data?.type === 'moto-trial:exit') closeMotoTrial();
    else if (
      data?.type === 'moto-trial:pose' &&
      motoSocket?.readyState === 1 &&
      motoSocket.bufferedAmount < 16000
    ) {
      const packet = JSON.stringify(data.packet);
      if (packet?.length <= 420) motoSocket.send(packet);
    }
  });
  return {
    open: openMotoRace,
    close: closeMotoTrial,
    visible: () => !motoOverlay.hidden,
    room: () => motoRace?.room,
    opening: () => motoOpening,
    insets: sendMotoInsets
  };
}
