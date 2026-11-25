// Biliardo visto dall'app: il gioco (sala giochi 3D, quattro specialità) nel suo iframe. Stesso schema di f1-link.js.
// Da solo (contro il computer, sullo stesso telefono) il gioco non chiede niente qui. Online la rete la fa l'app:
// apre la partita (il server mette l'avviso con la specialità), entra, tiene lo stato aggiornato e manda i colpi;
// l'iframe mostra e chiede. Anche Telegram resta qui: margini, Indietro, vibrazione, conferma di chiusura.
import { telegramHaptic } from './haptic.js?v=c280753040';
import { MSG } from './messages.js?v=a4f8bd3c10';
const $ = id => document.getElementById(id);

export function createBiliardoLink({ tg, me, request, onError, enterFullscreen, sendPresence, safeInsets, games, roomClosed }) {
  const overlay = $('biliardo-overlay'),
    frame = $('biliardo-frame');
  let room = null,
    snapshot = null,
    polling = false,
    pending = false,
    sync = 0,
    skew = 0;
  const clock = result => {
    if (typeof result?.now === 'number') skew = result.now - Date.now();
  };
  const post = (type, payload = {}) => {
    if (!overlay.hidden) frame.contentWindow?.postMessage({ type: 'bil:' + type, ...payload }, location.origin);
  };
  const identity = () => {
    const who = me();
    if (who) post('identity', { player: who.player, name: who.name });
  };
  function publish(ack = false) {
    if (snapshot) post('state', { state: snapshot, player: me()?.player, ack, skew });
  }
  function show(online) {
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    overlay.hidden = false;
    frame.src = '/biliardo/index.html?v=2' + (online ? '&online=1' : '');
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
      const result = await request('/api/biliardo/' + selected + '/state?after=' + snapshot.revision);
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
              ? MSG.expired
              : 'Collegamento perso, riprovo…'
        });
    } finally {
      polling = false;
    }
  }
  // Apre una partita dalla Lobby, dall'avviso o da "Riprendi": entra se c'è posto, altrimenti guarda.
  async function open(selected) {
    const who = me();
    if (!who || pending || (!overlay.hidden && room === selected)) return;
    pending = true;
    try {
      const path = '/api/biliardo/' + selected;
      // chi non è già dentro guarda la sala d'attesa e sceglie lui se entrare (tasto «Entra» nel gioco)
      const result = await request(path + '/state');
      if (!overlay.hidden) close();
      clock(result);
      room = selected;
      snapshot = result.state;
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
    room = snapshot = null;
    overlay.hidden = true;
    frame.src = 'about:blank';
    tg?.BackButton?.hide();
    try {
      tg?.disableClosingConfirmation?.();
      tg?.enableVerticalSwipes?.();
    } catch {}
    sendPresence();
    $('play-biliardo')?.focus();
  }
  function gone(selected) {
    close();
    roomClosed(selected);
    onError('Partita chiusa.');
  }
  $('play-biliardo').onclick = () => {
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
    if (data?.type === 'bil:ready') {
      post('insets', { insets: safeInsets(tg) });
      identity();
      publish();
    } else if (data?.type === 'bil:exit') close();
    else if (data?.type === 'bil:racing') {
      try {
        if (data.on) tg?.enableClosingConfirmation?.();
        else tg?.disableClosingConfirmation?.();
      } catch {}
    } else if (data?.type === 'bil:haptic') telegramHaptic(tg, data.kind, data.style);
    else if (data?.type === 'bil:create') {
      // apre la partita online con la specialità scelta (il server controlla di nuovo le opzioni)
      if (pending || !me()) return;
      // la rivincita: dopo una partita finita se ne apre una nuova (quella vecchia si lascia andare)
      if (room && snapshot?.phase !== 'finished') return;
      if (room) {
        clearInterval(sync);
        room = snapshot = null;
      }
      pending = true;
      try {
        const result = await request('/api/create', {
          game: 'biliardo',
          variant: data.variant,
          players: data.players, // 2, oppure 3 o 4 a squadre
          points: data.target, // la Lobby usa "target" per i tornei degli altri giochi
          reds: data.reds,
          cloth: data.cloth, // il colore del panno, uguale per tutti
          cush: data.cush // carambola: libera, a una o a tre sponde
        });
        clock(result);
        room = result.state.room;
        snapshot = result.state;
        publish(true);
        startSync();
        sendPresence();
      } catch (error) {
        post('error', { message: error.message });
      } finally {
        pending = false;
      }
    } else if (data?.type === 'bil:action' && ['start', 'play', 'close', 'leave', 'team', 'join', 'abandon'].includes(data.kind)) {
      const selected = room;
      if (!selected) return;
      try {
        const result = await request('/api/biliardo/' + selected + '/' + data.kind, data.payload || {});
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
