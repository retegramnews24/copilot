// Golf seen from the app: the setup dialog (course set, collisions), solo games and online rooms in their iframe.
// Online rooms are kept in sync by polling; actions from the iframe go to the server from here.
// games(): the lobby list; roomClosed(id): the app drops a closed room from the Lobby.
import { CAMPAIGNS, DEFAULT_CAMPAIGN } from './golf/courses.js?v=d38be2cad9';
import { golfColors } from './appearance.js?v=784dba932c';
import { read, save } from './prefs.js?v=bd123656a4';
const $ = id => document.getElementById(id);

export function createGolfLink({
  tg,
  me,
  request,
  onError,
  enterFullscreen,
  sendPresence,
  safeInsets,
  games,
  roomClosed
}) {
  let golfRoom = null,
    golfSnapshot = null,
    golfPending = false,
    golfPolling = false,
    golfSync = 0;
  function golfPost(type, payload = {}) {
    if (!$('golf-overlay').hidden)
      $('golf-frame').contentWindow?.postMessage({ type: 'golf:' + type, ...payload }, location.origin);
  }
  function publishGolf(ack = false) {
    if (golfSnapshot) golfPost('state', { ...golfSnapshot, player: me().player, ack });
  }
  const golfCampaign = $('golf-campaign');
  golfCampaign.replaceChildren(
    ...CAMPAIGNS.map(set => new Option(set.difficulty + ' · ' + set.name, set.id))
  );
  const lastGolfCampaign = read('binotto-golf-campaign', DEFAULT_CAMPAIGN);
  golfCampaign.value = CAMPAIGNS.some(set => set.id === lastGolfCampaign)
    ? lastGolfCampaign
    : DEFAULT_CAMPAIGN;
  golfCampaign.onchange = () => {
    try {
      save('binotto-golf-campaign', golfCampaign.value);
    } catch (error) {
      onError(error.message);
    }
  };

  function showGolf(online) {
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    $('golf-overlay').hidden = false;
    $('golf-frame').src =
      '/golf/index.html?v=12' +
      (online ? '&online=1' : '&campaign=' + encodeURIComponent(golfCampaign.value));
    tg?.BackButton?.show();
  }
  async function syncGolf() {
    const selected = golfRoom;
    if (!selected || document.hidden || golfPolling) return;
    golfPolling = true;
    try {
      const result = await request('/api/golf/' + selected + '/state?after=' + golfSnapshot.state.revision);
      if (golfRoom === selected && result.state && result.state.revision >= golfSnapshot.state.revision) {
        golfSnapshot = result;
        publishGolf();
      }
    } catch (error) {
      if (golfRoom === selected && error.status === 404) returnFromClosedGolf(selected);
    } finally {
      golfPolling = false;
    }
  }
  async function openGolf(selected) {
    const identity = me();
    if (!identity || golfPending || !$('golf-overlay').hidden) return;
    golfPending = true;
    $('create-golf').disabled = true;
    try {
      const appearance = golfColors();
      if (!selected) {
        golfSnapshot = await request('/api/create', {
          game: 'golf',
          appearance,
          campaign: golfCampaign.value,
          collisions: $('golf-collisions').checked
        });
      } else {
        const path = '/api/golf/' + selected,
          game = games().find(g => g.room === selected);
        const watching =
          game &&
          !game.players.some(p => p.id === identity.player) &&
          (game.phase !== 'waiting' || game.players.length >= game.capacity);
        try {
          golfSnapshot = watching
            ? await request(path + '/state')
            : await request(path + '/join', { appearance });
        } catch (error) {
          if (error.status !== 409 || watching) throw error;
          const result = await request(path + '/state'),
            match = result.state;
          if (match.phase === 'waiting' && match.players.length < 8) throw error;
          golfSnapshot = result;
        }
      }
      golfRoom = golfSnapshot.state.room;
      $('golf-setup').hidden = true;
      showGolf(true);
      sendPresence();
      golfSync = setInterval(syncGolf, 850);
    } catch (error) {
      if (!selected && !$('golf-setup').hidden) $('golf-setup-error').textContent = error.message;
      else onError(error.message);
    } finally {
      golfPending = false;
      $('create-golf').disabled = !me();
    }
  }
  function closeGolf() {
    if ($('golf-overlay').hidden) return;
    clearInterval(golfSync);
    const online = !!golfRoom;
    golfRoom = null;
    golfSnapshot = null;
    $('golf-overlay').hidden = true;
    $('golf-frame').src = 'about:blank';
    tg?.BackButton?.hide();
    try {
      tg?.enableVerticalSwipes?.();
    } catch {}
    sendPresence();
    $(online ? 'create-golf' : 'play-golf').focus();
  }
  function returnFromClosedGolf(selected) {
    closeGolf();
    roomClosed(selected);
  }
  const golfSetup = $('golf-setup'),
    golfConfirm = $('golf-setup-confirm'),
    golfCancel = $('golf-setup-cancel');
  let golfSetupOnline = false;
  function setupGolf(online) {
    if (golfPending || !$('golf-overlay').hidden || (online && !me())) return;
    golfSetupOnline = online;
    $('golf-collision-choice').hidden = !online;
    $('golf-collisions').checked = false;
    $('golf-setup-error').textContent = '';
    golfConfirm.textContent = online ? 'Crea sala' : 'Gioca';
    golfSetup.hidden = false;
    golfCampaign.focus();
  }
  $('play-golf').onclick = () => setupGolf(false);
  $('create-golf').onclick = () => setupGolf(true);
  golfCancel.onclick = () => {
    if (golfPending) return;
    golfSetup.hidden = true;
    $(golfSetupOnline ? 'create-golf' : 'play-golf').focus();
  };
  golfConfirm.onclick = async () => {
    if (golfSetup.hidden || golfPending) return;
    $('golf-setup-error').textContent = '';
    if (!golfSetupOnline) {
      golfSetup.hidden = true;
      showGolf(false);
      return;
    }
    golfConfirm.disabled = golfCancel.disabled = true;
    try {
      await openGolf();
    } finally {
      golfConfirm.disabled = golfCancel.disabled = false;
    }
  };
  // The setup dialog keeps keyboard focus inside it; Escape cancels.
  window.addEventListener('keydown', event => {
    if (golfSetup.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      golfCancel.click();
    }
    if (event.key !== 'Tab') return;
    const items = [
      golfCampaign,
      ...(golfSetupOnline ? [$('golf-collisions')] : []),
      golfConfirm,
      golfCancel
    ].filter(item => !item.disabled);
    const edge = event.shiftKey ? items[0] : items.at(-1);
    if (document.activeElement === edge) {
      event.preventDefault();
      (event.shiftKey ? items.at(-1) : items[0]).focus();
    }
  });
  window.addEventListener('message', async event => {
    if (
      event.origin !== location.origin ||
      event.source !== $('golf-frame').contentWindow ||
      $('golf-overlay').hidden
    )
      return;
    const data = event.data;
    if (data?.type === 'golf:ready') {
      golfPost('insets', { insets: safeInsets(tg) });
      golfPost('appearance', { colors: golfColors() });
      publishGolf();
      return;
    }
    if (data?.type === 'golf:exit') {
      closeGolf();
      return;
    }
    const selected = golfRoom;
    if (!selected || data?.type !== 'golf:action' || !['start', 'shot', 'close'].includes(data.kind)) return;
    const payload = data.kind === 'close' ? {} : data.payload;
    try {
      const result = await request('/api/golf/' + selected + '/' + data.kind, payload);
      if (golfRoom === selected) {
        if (data.kind === 'close') {
          returnFromClosedGolf(selected);
          return;
        }
        if (result.state.revision >= golfSnapshot.state.revision) golfSnapshot = result;
        publishGolf(true);
      }
    } catch (error) {
      if (golfRoom === selected) {
        if (error.status === 404) returnFromClosedGolf(selected);
        else golfPost('error', { message: error.message });
      }
    }
  });
  return {
    open: openGolf,
    close: closeGolf,
    visible: () => !$('golf-overlay').hidden,
    room: () => golfRoom,
    pending: () => golfPending,
    insets: insets => golfPost('insets', { insets })
  };
}
