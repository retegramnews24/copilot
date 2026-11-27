// Zona Operativa vista dall'app: il collegamento in diretta con il server (zona-server.js) resta qui, autenticato
// con la sessione, mai nella pagina del gioco; la pagina (public/zona/, nel riquadro #zona-frame) manda e riceve i
// messaggi con postMessage: zona:connect, zona:send, zona:disconnect; risposte zona:packet e zona:status.
export function createZonaLink({ frame, token }) {
  let socket = null;
  let wanted = false;
  let retry = 0;
  let room = '';
  const post = data => frame().contentWindow?.postMessage(data, location.origin);
  function drop() {
    clearTimeout(retry);
    if (!socket) return;
    socket.onclose = null;
    try {
      socket.close(1000);
    } catch {}
    socket = null;
  }
  function connect() {
    drop();
    if (!wanted || !token())
      return post({ type: 'zona:status', open: false, reason: 'Accesso scaduto: riapri l’app.' });
    const s = (socket = new WebSocket(location.origin.replace(/^http/, 'ws') + '/api/zona/' + room + 'ws', [
      'checkmate',
      token()
    ]));
    s.onopen = () => socket === s && post({ type: 'zona:status', open: true });
    s.onmessage = e =>
      socket === s && typeof e.data === 'string' && post({ type: 'zona:packet', data: e.data });
    s.onclose = e => {
      if (socket !== s) return;
      socket = null;
      const final = e.code === 4000 || e.code === 4001 || e.code === 4003;
      post({ type: 'zona:status', open: false, code: e.code, reason: e.reason || '' });
      if (wanted && !final) retry = setTimeout(connect, 2000);
    };
  }
  addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== frame()?.contentWindow) return;
    const d = e.data;
    if (d?.type === 'zona:connect') {
      wanted = true;
      room = d.room === 'poligono' ? 'poligono/' : ''; // il poligono condiviso o la partita sul deserto
      connect();
    } else if (d?.type === 'zona:disconnect') {
      wanted = false;
      drop();
    } else if (d?.type === 'zona:send' && typeof d.data === 'string' && d.data.length <= 3000) {
      if (socket?.readyState === 1 && socket.bufferedAmount < 32000) socket.send(d.data);
    }
  });
  return {
    close() {
      wanted = false;
      drop();
    }
  };
}
