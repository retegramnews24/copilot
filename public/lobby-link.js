// Collegamento della Lobby dal telefono: apertura, «ping» per capire se è vivo, riapertura e coda dei messaggi.
// Prima stava dentro app.js e non si poteva provare; qui il collegamento e l'orologio si possono sostituire con
// quelli finti (tests/lobby-link.test.mjs).
// - Si riapre solo se è chiuso o muto: prima si riapriva a ogni ritorno nell'app e il server ti toglieva sgabello,
//   posto al balilla e partita al flipper. «ping» → «pong» entro PROBE ms, altrimenti si riapre.
// - Un collegamento che resta «in apertura» più di OPEN_MAX ms si chiude e si riapre (rete mobile appesa).
// - Caduto il collegamento si riprova dopo RETRY ms.
// - Ogni BEAT ms, con l'app in vista, si manda la presenza e si controlla che il collegamento sia vivo.
// - Alcuni messaggi (inizio e punteggio del flipper) restano in coda finché il server non risponde
//   {type:'ack', ref}: partono subito se il collegamento è aperto e di nuovo poco dopo ogni riapertura, dopo la
//   presenza che dice al server che sei nel club. Così non si perdono neanche su un collegamento aperto ma muto
//   (analisi 9.6). Dopo KEEP_MAX ms un messaggio mai confermato si lascia andare.
export const PROBE = 5000,
  RETRY = 4000,
  FLUSH = 800,
  QUEUE = 4,
  OPEN_MAX = 10000,
  BEAT = 25000,
  KEEP_MAX = 5 * 60000;

export function createLobbyLink({
  open, // () => nuovo WebSocket
  enabled = () => true, // c'è una sessione?
  visible = () => true, // l'app è in vista?
  hooks = {}, // created(socket), opened(socket), message(data), closed(), dropped(), error(), trace(text), before(), beat()
  timers = globalThis,
  now = () => Date.now()
}) {
  let socket = null,
    heard = 0,
    probe = 0,
    retry = 0,
    opening = 0,
    beat = 0,
    ref = now(), // numeri dei messaggi tenuti: partono dall'ora, così non si ripetono tra un'apertura dell'app e l'altra
    waiting = []; // { message, at }
  const fresh = () => (waiting = waiting.filter(w => now() - w.at < KEEP_MAX));
  function flush(current) {
    if (!waiting.length) return;
    timers.setTimeout(() => {
      if (socket === current && current.readyState === 1)
        for (const w of fresh()) current.send(JSON.stringify(w.message));
    }, FLUSH);
  }
  function connect() {
    if (!enabled()) return;
    hooks.before?.();
    timers.clearTimeout(retry);
    timers.clearTimeout(probe);
    timers.clearTimeout(opening);
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
    opening = timers.setTimeout(() => {
      if (socket === current && current.readyState === 0) {
        hooks.trace?.('Sala ancora in apertura: la riapro');
        connect();
      }
    }, OPEN_MAX);
    current.onopen = () => {
      timers.clearTimeout(opening);
      heard = now();
      hooks.opened?.(current);
      flush(current);
    };
    current.onmessage = e => {
      heard = now();
      if (e.data === 'pong') return;
      if (typeof e.data === 'string' && e.data.startsWith('{"type":"ack"')) {
        try {
          const done = JSON.parse(e.data).ref;
          waiting = waiting.filter(w => w.message.ref !== done);
        } catch {}
        return;
      }
      hooks.message?.(e.data);
    };
    current.onerror = () => hooks.error?.();
    current.onclose = () => {
      timers.clearTimeout(opening);
      hooks.closed?.();
      retry = timers.setTimeout(connect, RETRY);
    };
  }
  // ritorno nell'app, ogni BEAT ms: è ancora vivo?
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
  // il giro: ogni BEAT ms, con l'app in vista, presenza e controllo
  function startBeat() {
    timers.clearTimeout(beat);
    beat = timers.setTimeout(function tick() {
      if (visible()) {
        hooks.beat?.();
        alive();
      }
      beat = timers.setTimeout(tick, BEAT);
    }, BEAT);
  }
  // manda subito; con keep resta in coda finché il server conferma (same: quali messaggi della coda sostituisce)
  function send(message, keep = null) {
    if (keep) {
      message = { ...message, ref: ++ref };
      waiting = [...fresh().filter(w => !keep(w.message)), { message, at: now() }].slice(-QUEUE);
    }
    if (socket?.readyState === 1) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  return { connect, alive, send, startBeat, socket: () => socket, waiting: () => waiting.length };
}
