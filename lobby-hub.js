// The Lobby (Durable Object "checkmate-lobby-v1"): list of open tables, people online and presence, chat,
// leaderboards, creating and joining tables. Lives inside the Room class like the other hubs.
import { telegramAccessTag } from './auth.js';
import { topFive } from './leaderboard.js';
import { activeTable, createSeries } from './match-series.js';
import { hasMove, replayNumberGame } from './public/arcade/number-connect-rules.js';
import { json, id, name } from './worker-shared.js';
import { tableSummary, isArcade, seatLimit, longLimitText, concluded } from './table-rules.js';
import { gameTitle } from './public/game-info.js';

const BILIARDO_NAMES = {
  otto: 'Palla 8',
  nove: 'Palla 9',
  snooker: 'Snooker',
  italiana: '5 birilli',
  carambola: 'Carambola',
  boccette: 'Boccette'
};

// Game notices stored by the server, so everyone finds them also later: a table opened to people, a win.
// Kept in their own list (not in the chat); the app shows them in the Lobby bell, each with a button.
export function tableNotice(user, game, number, room, summary = null) {
  let where = isArcade(game) ? ' · sala ' + number : ' · Tavolo ' + number;
  // F1 on paper!: how many drivers the race is waiting for, and how many laps
  if (game === 'f1' && summary?.capacity)
    where +=
      ' · cerca ' +
      (summary.capacity - 1) +
      (summary.capacity === 2 ? ' pilota' : ' piloti') +
      ' (' +
      summary.capacity +
      ' auto, ' +
      summary.laps +
      (summary.laps === 1 ? ' giro)' : ' giri)');
  // Biliardo: the specialty, the teams (from 3 players: teams chosen by the players, up to 8) and the players wanted
  if (game === 'biliardo' && summary?.variant) {
    const cap = summary.capacity || 2;
    where +=
      ' · ' +
      (BILIARDO_NAMES[summary.variant] || 'Biliardo') +
      (cap > 2 ? ' · a squadre, ' + cap + ' giocatori' : '') +
      ' · cerca ' +
      (cap - 1) +
      (cap === 2 ? ' giocatore' : ' giocatori');
  }
  return {
    id: id(),
    notice: 'table',
    userId: user.id,
    name: user.name,
    room,
    game,
    text: name(user.name) + ' ha aperto ' + gameTitle({ game }) + where,
    at: Date.now()
  };
}
export function winNotice(result) {
  const winners = (result.winners || []).map(w => w.name).filter(Boolean);
  if (result.mode !== 'people' || !winners.length || !result.game) return null;
  return {
    id: id(),
    notice: 'win',
    game: result.game,
    text:
      '🏆 ' + winners.join(' e ') + (winners.length > 1 ? ' vincono' : ' vince') + ' a ' + gameTitle(result),
    at: Date.now()
  };
}

export class LobbyHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async lobbyList() {
    const entries = await this.ctx.storage.list({ prefix: 'game:' });
    return [...entries.values()]
      .filter(s => s.game !== 'cluedo' && (isArcade(s.game) || !activeTable(s) || s.expires > Date.now()))
      .sort((a, b) => a.number - b.number);
  }

  async lobbyPayload(allGames) {
    const tables = allGames ?? (await this.lobbyList());
    const games = tables.filter(g => g.archived || activeTable(g));
    const unique = new Map(),
      tag = await telegramAccessTag(this.env);
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!tag || !a || a.accessTag !== tag || a.kind !== 'lobby' || a.closed || Date.now() - a.seen > 65000)
        continue;
      const prior = unique.get(a.user.id);
      // più connessioni della stessa persona (es. una vecchia rimasta aperta in Telegram): conta quella con una
      // partita aperta, altrimenti la più recente (che porta la posizione aggiornata nella Lobby 3D)
      if (
        !prior ||
        (a.room && !prior.room) ||
        (!!a.room === !!prior.room && (a.seen || 0) >= (prior.seen || 0))
      )
        unique.set(a.user.id, a);
    }
    const users = [...unique.values()]
      .map(a => {
        const own = games.find(
          g => !isArcade(g.game) && activeTable(g) && g.players.some(p => p.id === a.user.player)
        );
        const watching = tables.find(g => g.room === a.room);
        return {
          ...a.user,
          clubPose: a.clubPose ?? null,
          status: own
            ? 'In partita ' + own.number
            : watching
              ? (watching.game === 'labyrinth'
                  ? 'Labyrinth '
                  : watching.game === 'moto-trial'
                    ? 'Moto Trial '
                    : watching.game === 'golf'
                      ? 'Golf '
                      : watching.game === 'pong'
                        ? 'Pong '
                        : watching.game === 'f1'
                          ? 'F1 on paper! '
                          : watching.game === 'biliardo'
                            ? 'Biliardo '
                            : 'Guarda ') + watching.number
              : 'In Lobby',
          game: own?.room || null,
          viewingRoom: watching?.room || null
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const records = [...(await this.ctx.storage.list({ prefix: 'result:' })).values()];
    return {
      games,
      clubRadio: (await this.ctx.storage.get('clubRadio')) ?? null,
      tableVolume: (await this.ctx.storage.get('tableVolume')) ?? 80,
      users,
      // Chat: messages only (notices stored there by 1.0.41 are dropped).
      messages: ((await this.ctx.storage.get('chat')) || []).filter(m => !m.notice),
      notices: (await this.ctx.storage.get('notices')) || [],
      leaderboard: topFive(records),
      aiLeaderboard: topFive(records, 'ai')
    };
  }
  // Game notices: a list of their own (last 30), outside the chat; each person reads them in the Lobby bell.
  async addNotice(notice) {
    const notices = (await this.ctx.storage.get('notices')) || [];
    notices.push(notice);
    await this.ctx.storage.put('notices', notices.slice(-30));
  }
  async lobbyBroadcast(force = true) {
    const payload = await this.lobbyPayload(),
      signature = JSON.stringify(payload.users);
    if (!force && signature === this.presenceSignature) return;
    this.presenceSignature = signature;
    const message = JSON.stringify(payload),
      tag = await telegramAccessTag(this.env);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        if (!tag || ws.deserializeAttachment()?.accessTag !== tag) {
          ws.close(4001, 'Riapri la Mini App');
          continue;
        }
        ws.send(message);
      } catch {}
    }
  }
  async tidyLegacyResults(games) {
    if (this.tidyingResults) return;
    this.tidyingResults = true;
    try {
      for (const game of games.slice(0, 12)) {
        const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(game.room));
        const result = await stub.fetch(new Request('https://internal/tidy-result', { method: 'POST' }));
        if (!result.ok) continue;
        const summary = await result.json();
        const lobby = this.env.ROOMS.get(this.ctx.id);
        const action = summary.deleted ? 'remove' : 'update';
        await lobby.fetch(
          new Request('https://internal/lobby/' + action, { method: 'POST', body: JSON.stringify(summary) })
        );
      }
    } finally {
      this.tidyingResults = false;
    }
  }
  async numberConnectLeaders() {
    return [...(await this.ctx.storage.list({ prefix: 'number-connect:' })).values()]
      .sort((a, b) => b.points - a.points || a.at - b.at || a.id.localeCompare(b.id))
      .slice(0, 5);
  }
  async lobby(req, path) {
    if (path === '/lobby/leaderboard') {
      const games = await this.lobbyList(),
        pending = [];
      for (const g of games)
        if (
          g.phase === 'finished' &&
          !isArcade(g.game) &&
          (await this.ctx.storage.get('migrated:' + g.room)) !== g.revision
        )
          pending.push(g);
      for (const g of pending.slice(0, 8)) {
        const res = await this.env.ROOMS.get(this.env.ROOMS.idFromName(g.room)).fetch(
          new Request('https://internal/results')
        );
        if (res.ok) {
          for (const row of await res.json()) await this.ctx.storage.put('result:' + row.key, row);
          await this.ctx.storage.put('migrated:' + g.room, g.revision);
        }
      }
      const records = [...(await this.ctx.storage.list({ prefix: 'result:' })).values()],
        u = new URL(req.url);
      if (u.searchParams.get('mode') === 'both')
        return json({
          leaderboard: topFive(records),
          aiLeaderboard: topFive(records, 'ai'),
          numberConnectLeaders: await this.numberConnectLeaders(),
          pending: pending.length > 8
        });
      return json({
        leaders: topFive(
          records,
          u.searchParams.get('mode') === 'ai' ? 'ai' : 'people',
          u.searchParams.get('game') || 'all'
        ),
        pending: pending.length > 8
      });
    }
    if (path === '/lobby/list') {
      const games = await this.lobbyList();
      const old = games.filter(game => concluded(game) && game.expires !== null);
      if (old.length) this.ctx.waitUntil(this.tidyLegacyResults(old));
      return json(await this.lobbyPayload(games));
    }
    if (path === '/lobby/ws') {
      if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
        return json({ error: 'WebSocket richiesto.' }, 426);
      if (this.ctx.getWebSockets().length >= 120) return json({ error: 'Troppe connessioni.' }, 429);
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user) return json({ error: 'Accesso richiesto.' }, 401);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({
        kind: 'lobby',
        user,
        room: null,
        seen: Date.now(),
        closed: false,
        memberId: JSON.parse(req.headers.get('X-Checkmate-User') || 'null')?.id,
        accessTag: req.headers.get('X-Access-Tag'),
        expires: Number(req.headers.get('X-Session-Expires'))
      });
      await this.lobbyBroadcast();
      return new Response(null, {
        status: 101,
        webSocket: pair[0],
        headers: { 'Sec-WebSocket-Protocol': 'checkmate' }
      });
    }
    // Asked by the notice queue: is this player looking at that table right now (Lobby connected, app visible)?
    if (path === '/lobby/presence') {
      const q = new URL(req.url).searchParams,
        player = q.get('player'),
        room = q.get('room');
      const present = this.ctx.getWebSockets().some(ws => {
        const a = ws.deserializeAttachment();
        return (
          a?.kind === 'lobby' &&
          !a.closed &&
          a.user?.player === player &&
          a.room === room &&
          Date.now() - a.seen < 65000
        );
      });
      return json({ present });
    }
    if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405);
    const body = await req.json();
    if (path === '/lobby/number-connect-score') {
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user?.player) return json({ error: 'Accesso richiesto.' }, 401);
      const game = replayNumberGame(body);
      if (!game || !Number.isSafeInteger(game.score) || game.score <= 0 || hasMove(game)) {
        return json({ error: 'Il punteggio richiede una partita completata.' }, 400);
      }
      const key = 'number-connect:' + user.player,
        previous = await this.ctx.storage.get(key);
      if (!previous || game.score > previous.points) {
        await this.ctx.storage.put(key, {
          id: user.player,
          name: user.name,
          points: game.score,
          level: game.level,
          at: Date.now()
        });
      }
      return json({ leaders: await this.numberConnectLeaders() });
    }
    if (path === '/lobby/result') {
      const old = await this.ctx.storage.get('result:' + body.key);
      if (!old) {
        await this.ctx.storage.put('result:' + body.key, body);
        const notice = winNotice(body);
        if (notice) {
          await this.addNotice(notice);
          await this.lobbyBroadcast();
        }
      }
      return json({ ok: true });
    }
    if (path === '/lobby/join') {
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user) return json({ error: 'Accesso richiesto.' }, 401);
      const tables = await this.lobbyList(),
        limit = seatLimit(tables, user.player, tables.find(g => g.room === body.room) || { room: body.room });
      if (limit)
        return json(
          {
            error:
              limit === 'long'
                ? longLimitText
                : 'Hai già un tavolo aperto di questo gioco: lo trovi nella campanella.'
          },
          409
        );
      const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(body.room));
      const response = await stub.fetch(
        new Request('https://internal/api/room/' + body.room + '/claim', {
          method: 'POST',
          headers: { 'X-Checkmate-User': JSON.stringify(user) },
          body: JSON.stringify({ name: user.name })
        })
      );
      if (response.ok) {
        const result = await response.clone().json();
        await this.ctx.storage.put('game:' + body.room, tableSummary(result.state));
        await this.lobbyBroadcast();
      }
      return response;
    }
    if (path === '/lobby/chat') {
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user || (await this.lobbyPayload()).users.every(u => u.id !== user.id))
        return json({ error: 'Collegati alla Lobby prima di scrivere.' }, 409);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 500) return json({ error: 'Scrivi da 1 a 500 caratteri.' }, 400);
      const last = (await this.ctx.storage.get('chatlimit:' + user.id)) || 0;
      if (Date.now() - last < 1500)
        return json({ error: 'Attendi un momento prima del prossimo messaggio.' }, 429);
      const messages = (await this.ctx.storage.get('chat')) || [],
        message = {
          id: id(),
          userId: user.id,
          name: user.name,
          photo: user.photo || '',
          text,
          at: Date.now()
        };
      messages.push(message);
      await this.ctx.storage.put('chat', messages.slice(-100));
      await this.ctx.storage.put('chatlimit:' + user.id, Date.now());
      await this.lobbyBroadcast();
      return json({ ok: true, message });
    }
    if (path === '/lobby/create') {
      const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
      if (!user) return json({ error: 'Accesso richiesto.' }, 401);
      const playerName = name(user.name);
      if (
        body.game !== undefined &&
        ![
          'chess',
          'checkers',
          'connect4',
          'uno',
          'scarabeo',
          'scopa',
          'naval',
          'briscola',
          'briscola5',
          'labyrinth',
          'moto-trial',
          'golf',
          'pong',
          'f1',
          'biliardo'
        ].includes(body.game)
      )
        return json({ error: 'Gioco non disponibile.' }, 400);
      const active = (await this.lobbyList()).filter(activeTable);
      if (!['moto-trial', 'golf', 'pong', 'f1', 'biliardo'].includes(body.game)) {
        const limit = seatLimit(active, user.player, {
          room: null,
          game: body.game || 'chess',
          mode: body.mode || 'people'
        });
        if (limit)
          return json(
            {
              error:
                limit === 'long'
                  ? longLimitText
                  : 'Hai già un tavolo aperto di questo gioco: lo trovi nella campanella.'
            },
            409
          );
      }
      createSeries(body.target);
      const occupied = new Set(active.map(g => g.number));
      let number = 1;
      while (occupied.has(number)) number++;
      if (isArcade(body.game)) {
        const room = id(),
          prefix =
            body.game === 'labyrinth'
              ? 'lab:'
              : body.game === 'golf'
                ? 'golf:'
                : body.game === 'pong'
                  ? 'pong:'
                  : body.game === 'f1'
                    ? 'f1:'
                    : body.game === 'biliardo'
                      ? 'biliardo:'
                      : 'moto:';
        const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(prefix + room));
        const response = await stub.fetch(
          new Request('https://internal/' + body.game + '/init', {
            method: 'POST',
            headers: { 'X-Checkmate-User': JSON.stringify(user) },
            body: JSON.stringify({
              room,
              number,
              mode: body.game === 'pong' ? body.mode : undefined,
              appearance: body.game === 'golf' ? body.appearance : undefined,
              campaign: body.game === 'golf' ? body.campaign : undefined,
              collisions: body.game === 'golf' ? body.collisions === true : undefined,
              // F1 on paper!: the drawn track, laps, time of day (the number of drivers is in the track)
              ...(body.game === 'f1' ? { track: body.track, laps: body.laps, time: body.time } : {}),
              // Biliardo: the specialty, the points to win (5 birilli, boccette) or the reds (snooker), and the
              // players (2, or 3 / 4 in two teams). "points", not "target": that is the tournament format of other games
              ...(body.game === 'biliardo'
                ? {
                    variant: body.variant,
                    target: body.points,
                    reds: body.reds,
                    players: body.players,
                    cloth: body.cloth,
                    cush: body.cush
                  }
                : {}),
              seed: body.game === 'moto-trial' ? 1 : crypto.getRandomValues(new Uint32Array(1))[0]
            })
          })
        );
        if (!response.ok) return response;
        const result = await response.json();
        await this.ctx.storage.put('game:' + room, result.summary);
        // Shared rooms open to others (not single-player Pong, not the retired Labyrinth) appear in the chat.
        if (body.game !== 'labyrinth' && !(body.game === 'pong' && body.mode === 'solo'))
          await this.addNotice(tableNotice(user, body.game, number, room, result.summary));
        await this.lobbyBroadcast();
        return json(result);
      }
      const room = id(),
        stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(room));
      const response = await stub.fetch(
        new Request('https://internal/init', {
          method: 'POST',
          headers: { 'X-Room': room, 'X-Checkmate-User': JSON.stringify(user) },
          body: JSON.stringify({
            name: playerName,
            number,
            playerId: user.player,
            game: body.game || 'chess',
            target: body.target,
            mode: body.mode,
            seats: body.seats
          })
        })
      );
      if (!response.ok) return response;
      const result = await response.json();
      await this.ctx.storage.put('game:' + room, tableSummary(result.state));
      await this.ctx.storage.setAlarm(Date.now() + 3600000);
      // Tables against the AI and tutorials are private: no notice for those.
      if (!['ai', 'tutorial'].includes(result.state?.mode))
        await this.addNotice(tableNotice(user, result.state?.game || body.game || 'chess', number, room));
      await this.lobbyBroadcast();
      return json(result);
    }
    if (path === '/lobby/remove') {
      await this.ctx.storage.delete('game:' + body.room);
      await this.lobbyBroadcast();
      return json({ ok: true });
    }
    if (path === '/lobby/update') {
      const old = await this.ctx.storage.get('game:' + body.room);
      if (old && body.revision > old.revision) {
        await this.ctx.storage.put('game:' + body.room, tableSummary({ ...body, number: old.number }));
        await this.lobbyBroadcast();
      }
      return json({ ok: true });
    }
    return json({ error: 'Percorso non trovato.' }, 404);
  }
  async alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {
      const entries = await this.ctx.storage.list({ prefix: 'game:' });
      for (const [key, value] of entries) {
        if (!isArcade(value.game) && activeTable(value) && value.expires <= Date.now())
          await this.ctx.storage.delete(key);
      }
      await this.lobbyBroadcast();
      const games = await this.lobbyList();
      const old = games.filter(game => concluded(game) && game.expires !== null);
      if (old.length) this.ctx.waitUntil(this.tidyLegacyResults(old));
      if (games.some(g => !g.archived))
        await this.ctx.storage.setAlarm(Date.now() + (old.length > 12 ? 30000 : 3600000));
    });
  }
}
