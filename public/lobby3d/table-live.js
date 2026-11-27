// Partite vere sui tavoli della sala tavoli (per ora Forza 4).
// Quale partita: la tua, se ne stai giocando una; se no quella con l'ultima mossa (expires riparte a ogni azione).
// Le partite degli altri contro l'AI o in tutorial non si mostrano. Nessuna partita: il tavolo torna all'inizio.
// Il collegamento è "solo per guardare" (?look=1): il server manda la vista da spettatore e il collegamento non
// conta come giocatore presente (una partita finita non resta in vita per lui). Si apre solo vicino alla sala.
export const LIVE_GAMES = ['connect4'];
const RETRY_MS = 5000;

export function pickTable(games, player, game) {
  const live = (games || []).filter(g => g.game === game && g.phase === 'playing');
  const latest = list => list.slice().sort((a, b) => (b.expires || 0) - (a.expires || 0))[0] || null;
  return (
    latest(live.filter(g => player && (g.players || []).some(p => p?.id === player))) ||
    latest(live.filter(g => (g.mode || 'people') === 'people'))
  );
}

// games(): tavoli della Lobby; player(): il tuo id di giocatore; token(): sessione; onState(game, stato | null)
export function createTableLive({
  games,
  player,
  token,
  onState,
  open = url => new WebSocket(url, ['checkmate', token()])
}) {
  const links = new Map(); // game -> { room, socket }
  const closedAt = new Map(); // game -> quando si è chiuso da solo (si riprova dopo RETRY_MS)
  const shown = new Map(); // game -> stanza mostrata sul tavolo (null: posizione iniziale)
  function show(game, s) {
    if (!s && shown.get(game) === null) return;
    shown.set(game, s ? s.room : null);
    onState(game, s);
  }
  function drop(game) {
    const link = links.get(game);
    if (!link) return;
    links.delete(game);
    link.socket.onclose = link.socket.onmessage = null;
    try {
      link.socket.close(1000, 'Lontano dal tavolo');
    } catch {}
  }
  function connect(game, room) {
    const socket = open(location.origin.replace(/^http/, 'ws') + '/api/room/' + room + '/ws?look=1');
    const link = { room, socket };
    links.set(game, link);
    socket.onmessage = event => {
      if (links.get(game) !== link) return;
      let s;
      try {
        s = JSON.parse(event.data);
      } catch {
        return;
      }
      if (s?.deleted) {
        drop(game);
        show(game, null);
      } else if (s?.room === room) show(game, s);
    };
    socket.onclose = () => {
      if (links.get(game) !== link) return;
      links.delete(game);
      closedAt.set(game, Date.now());
    };
  }
  // near: sei nella sala tavoli o davanti alla porta. Chiamata ogni secondo dalla Lobby 3D.
  function watch(near) {
    for (const game of LIVE_GAMES) {
      if (!near) {
        drop(game);
        continue;
      }
      const room = pickTable(games(), player(), game)?.room || null;
      const link = links.get(game);
      if (link?.room === room) continue;
      if (link) drop(game);
      if (!room) {
        show(game, null);
        continue;
      }
      if (Date.now() - (closedAt.get(game) || 0) < RETRY_MS) continue;
      connect(game, room);
    }
  }
  return { watch, close: () => LIVE_GAMES.forEach(drop) };
}
