// Collegamento della Lobby dal telefono: apertura, «ping» per capire se è vivo, riapertura e coda dei messaggi.
// Prima stava dentro app.js e non si poteva provare; qui il collegamento e l'orologio si possono sostituire con
// quelli finti (tests/lobby-link.test.mjs).
// - Si riapre solo se è chiuso o muto: prima si riapriva a ogni ritorno nell'app e il server ti toglieva sgabello,
//   posto al balilla e partita al flipper. «ping» → «pong» entro PROBE ms, altrimenti si riapre.
// - Caduto il collegamento si riprova dopo RETRY ms.
// - Alcuni messaggi (inizio e punteggio del flipper) se il collegamento è giù aspettano in coda e partono poco dopo
//   la riapertura, dopo la presenza che dice al server che sei nel club; prima andavano persi.
export const PROBE = 5000,
  RETRY = 4000,
  FLUSH = 800,
  QUEUE = 4;

export function createLobbyLink({
  open, // () => nuovo WebSocket
  enabled = () => true, // c'è una sessione?
  hooks = {}, // created(socket), opened(socket), message(data), closed(), dropped(), error(), trace(text), before()
  timers = globalThis,
  now = () => Date.now()
}) {
  let socket = null,
    heard = 0,
    probe = 0,
    retry = 0,
    waiting = [];
  function flush(current) {
    if (!waiting.length) return;
    timers.setTimeout(() => {
      if (socket === current && current.readyState === 1)
        for (const m of waiting.splice(0)) current.send(JSON.stringify(m));
    }, FLUSH);
  }
  function connect() {
    if (!enabled()) return;
    hooks.before?.();
    timers.clearTimeout(retry);
    timers.clearTimeout(probe);
    // il server dimentica sgabello e posto al balilla del collegamento vecchio: il telefono si rimette d'accordo
    if (socket) {
      socket.onclose = null;
      try {
        socket.close();
      } catch {}
      hooks.dropped?.();
    }
    const current = open();
    socket = current;
    hooks.created?.(current);
    current.onopen = () => {
      heard = now();
      hooks.opened?.(current);
      flush(current);
    };
    current.onmessage = e => {
      heard = now();
      if (e.data === 'pong') return;
      hooks.message?.(e.data);
    };
    current.onerror = () => hooks.error?.();
    current.onclose = () => {
      hooks.closed?.();
      retry = timers.setTimeout(connect, RETRY);
    };
  }
  // ritorno nell'app, ogni 25 secondi: è ancora vivo?
  function alive() {
    if (!enabled()) return;
    if (!socket || socket.readyState > 1) return connect();
    if (socket.readyState === 0) return;
    const current = socket,
      asked = now();
    timers.clearTimeout(probe);
    try {
      current.send('ping');
    } catch {}
    probe = timers.setTimeout(() => {
      if (socket === current && heard < asked) {
        hooks.trace?.('Sala muta: la riapro');
        connect();
      }
    }, PROBE);
  }
  // manda subito, oppure (con keep) tiene in coda finché il collegamento torna; same: quali messaggi sostituisce
  function send(message, keep = null) {
    if (socket?.readyState === 1) {
      socket.send(JSON.stringify(message));
      return true;
    }
    if (keep) waiting = [...waiting.filter(m => !keep(m)), message].slice(-QUEUE);
    return false;
  }
  return { connect, alive, send, socket: () => socket, waiting: () => waiting.length };
}
