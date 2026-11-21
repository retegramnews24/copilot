import { BalillaHub } from './balilla-hub.js';
import { SimulatorLeague } from './simulator/server.js';
import { memberAccess, telegramAccessTag } from './auth.js';
import { Blackboard } from './blackboard-server.js';
import { Cinema } from './cinema-server.js';
import { TelegramCinema, cacheTelegramMedia } from './cinema-telegram.js';
import { YouTubeCatalog } from './cinema-youtube.js';
import { readCinemaMedia } from './cinema-media.js';
import { chooseAction, tutorial } from './table-ai.js';
import { resultsFor } from './leaderboard.js';
import { stagedGame, limits, activeTable, settleSeries } from './match-series.js';
import { initialConnect4, playConnect4 } from './connect4.js';
import { GolfRoom } from './golf-server.js';
import { F1Room } from './f1-server.js';
import { BiliardoRoom } from './biliardo-server.js';
import { MotoTrialRoom } from './moto-trial-server.js';
import { PongRoom } from './pong-server.js';
import { ExpeditionRoom } from './labyrinth-server.js';
import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';
import { initialCheckers, playCheckers } from './checkers.js';
import {
  TurnNotices,
  noticeRequest,
  reminderRequest,
  resultRequest,
  timeoutTable,
  turnTargets,
  turnKey,
  isLongTurn,
  LONG_IDLE,
  TURN_LIMIT
} from './turn-notices.js';
import { json, id, bad, name, noticeHub } from './worker-shared.js';
import * as tables from './table-rules.js';
import { concluded } from './table-rules.js';
import { LobbyHub } from './lobby-hub.js';
import { handleRequest } from './api.js';
import { BackupHub, exportStorage, importStorage, encode, decode } from './backup.js';

export default {
  fetch: handleRequest,
  // Weekly cron (wrangler.jsonc → triggers): backup of all game data (backup.js).
  scheduled(_event, env, ctx) {
    ctx.waitUntil(
      env.ROOMS.get(env.ROOMS.idFromName('backup-v1')).fetch('https://internal/backups/run', {
        method: 'POST'
      })
    );
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.balilla = new BalillaHub(ctx);
    this.ctx = ctx;
    this.env = env;
    this.lab = new ExpeditionRoom(ctx, env, () => telegramAccessTag(env));
    this.moto = new MotoTrialRoom(ctx, env);
    this.pong = new PongRoom(ctx, env);
    this.golf = new GolfRoom(ctx, env);
    this.f1 = new F1Room(ctx, env);
    this.biliardo = new BiliardoRoom(ctx, env);
    this.cinema = new Cinema(ctx);
  }
  public(s, viewer = null) {
    return tables.publicTable(s, viewer, this.turnLimit());
  }
  newTable(room, b, token) {
    return tables.newTable(room, b, token);
  }
  resetRound(s) {
    tables.resetRound(s);
  }
  tutorialView(s) {
    return tables.tutorialView(s, this.turnLimit());
  }
  botSeat(s) {
    return tables.botSeat(s);
  }
  async record(s) {
    for (const result of resultsFor(s))
      await this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch(
        new Request('https://internal/lobby/result', { method: 'POST', body: JSON.stringify(result) })
      );
  }
  async saveState(s) {
    if (concluded(s)) {
      s.expires = null;
      delete s.finishedAt;
    }
    await this.ctx.storage.put('state', s);
    await this.record(s);
    if (s.archived || concluded(s)) await this.ctx.storage.deleteAlarm();
    else {
      const nextBot = this.botSeat(s) >= 0 ? Date.now() + 650 : Infinity;
      await this.ctx.storage.setAlarm(Math.min(nextBot, s.expires, this.clockDue(s)));
    }
  }
  hasResultViewer(s, { socket, player } = {}) {
    const seats = new Set(s.players.filter(p => !p.bot).map(p => p.id));
    return this.ctx.getWebSockets().some(ws => {
      const viewer = ws.deserializeAttachment()?.player;
      return ws !== socket && ws.readyState === 1 && viewer !== player && seats.has(viewer);
    });
  }
  async removeTable(s, reason) {
    const result = { room: s.room, number: s.number, deleted: true, reason };
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(JSON.stringify(result));
        ws.close(1000, 'Partita eliminata');
      } catch {}
    }
    return result;
  }
  notifyTableRemoved(room) {
    const lobby = this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1'));
    this.ctx.waitUntil(
      lobby.fetch(
        new Request('https://internal/lobby/remove', { method: 'POST', body: JSON.stringify({ room }) })
      )
    );
  }
  // Long-turn tables stay open 7 days after the last action, instead of a week after creation.
  keepAlive(s) {
    if (!isLongTurn(s) || !activeTable(s)) {
      delete s.clock;
      return;
    }
    s.expires = Date.now() + LONG_IDLE;
    // Turn clock: restarts whenever someone else has to act (new move, new vote); a draw offer does not reset it.
    if (s.phase !== 'playing' || !turnTargets(s).length) {
      delete s.clock;
      return;
    }
    const key = turnKey(s);
    if (s.clock?.key !== key) s.clock = { key, since: Date.now(), reminded: false };
  }
  // Time to move (TURN_LIMIT; the test-only TURN_LIMIT_MS shortens it): reminder after one limit, lost turn after two.
  turnLimit() {
    return /^\d+$/.test(this.env.TURN_LIMIT_MS || '') ? Number(this.env.TURN_LIMIT_MS) : TURN_LIMIT;
  }
  clockDue(s) {
    return s.clock ? s.clock.since + this.turnLimit() * (s.clock.reminded ? 2 : 1) : Infinity;
  }
  // Called by the alarm: sends the reminder, or applies the timeout. Returns false when the table has no clock.
  async runClock(s) {
    const c = s.clock;
    if (!c || !isLongTurn(s) || s.phase !== 'playing') return false;
    const now = Date.now(),
      limit = this.turnLimit();
    if (now >= c.since + 2 * limit) {
      const key = turnKey(s),
        told = timeoutTable(s, now);
      settleSeries(s);
      s.revision++;
      this.keepAlive(s);
      await this.saveState(s);
      await this.broadcast(s);
      await this.syncLobby(s);
      this.sendNotice(resultRequest(s, key, told));
      this.queueNotice(s);
      return true;
    }
    if (!c.reminded && now >= c.since + limit) {
      c.reminded = true;
      this.sendNotice(reminderRequest(s));
    }
    await this.saveState(s);
    return true;
  }
  sendNotice(request) {
    if (request && this.env.TURN_NOTIFY !== 'false')
      this.ctx.waitUntil(
        noticeHub(this.env)
          .fetch(
            new Request('https://internal/notices/queue', { method: 'POST', body: JSON.stringify(request) })
          )
          .catch(() => {})
      );
  }
  // Long-turn games: tell the notice queue who must act now (it decides later whether a message is needed).
  queueNotice(s) {
    this.sendNotice(noticeRequest(s));
  }
  async syncLobby(s) {
    await this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch(
      new Request('https://internal/lobby/update', {
        method: 'POST',
        body: JSON.stringify(this.summary(this.public(s)))
      })
    );
  }
  applyMove(s, who, b) {
    tables.applyMove(s, who, b);
  }
  async broadcast(s) {
    const tag = await telegramAccessTag(this.env);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const a = ws.deserializeAttachment();
        if (!tag || a?.accessTag !== tag) {
          ws.close(4001, 'Riapri la Mini App');
          continue;
        }
        ws.send(JSON.stringify(this.public(s, a.player)));
      } catch {}
    }
  }
  async guardSockets() {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;
    const tag = await telegramAccessTag(this.env);
    await Promise.all(
      sockets.map(async ws => {
        const a = ws.deserializeAttachment();
        if (a?.authDenied) return;
        const memberId =
          a?.memberId ||
          a?.user?.id ||
          (a?.player?.startsWith('tg:') ? a.player.slice(3) : null) ||
          (typeof a?.id === 'string' ? a.id.replace(/^tg:/, '') : null);
        let reason = null;
        if (!tag || a?.accessTag !== tag || !Number.isFinite(a?.expires) || a.expires <= Date.now())
          reason = 'Sessione scaduta: riapri la Mini App';
        else if (!memberId || (await memberAccess({ id: memberId }, this.env)) !== true)
          reason = 'Accesso al gruppo richiesto';
        if (reason) {
          try {
            ws.serializeAttachment({ ...a, authDenied: true });
            ws.close(4003, reason);
          } catch {}
        }
      })
    );
  }
  async fetch(req) {
    await this.guardSockets();
    const viewer = JSON.parse(req.headers.get('X-Checkmate-User') || 'null')?.player || null;
    const path = new URL(req.url).pathname;
    if (path.startsWith('/simulator/'))
      return (this.simulator ??= new SimulatorLeague(this.ctx, this.env)).fetch(req);
    if (path.startsWith('/notices/'))
      return (this.notices ??= new TurnNotices(this.ctx, this.env)).fetch(req);
    // Backup (backup.js): every object exports/imports its whole storage; 'backup-v1' keeps the snapshots.
    if (path === '/backup/export')
      return new Response(encode(await exportStorage(this.ctx.storage)), {
        headers: { 'Content-Type': 'application/json' }
      });
    if (path === '/backup/import' && req.method === 'POST') {
      const data = decode(await req.text());
      await this.ctx.blockConcurrencyWhile(() => importStorage(this.ctx.storage, data));
      // Restart this object so nothing cached in memory survives the restore.
      setTimeout(() => {
        try {
          this.ctx.abort('Ripristino dal backup');
        } catch {}
      }, 50);
      return json({ ok: true });
    }
    if (path.startsWith('/backups/')) return (this.backups ??= new BackupHub(this.ctx, this.env)).fetch(req);
    if (path === '/cinema/group-directory')
      return (this.telegramCinema ??= new TelegramCinema(this.ctx, this.env.BOT_TOKEN)).fetch(req);
    if (path === '/cinema/group-file')
      return req.method === 'POST'
        ? this.ctx.blockConcurrencyWhile(() => cacheTelegramMedia(req, this.ctx, this.env.BOT_TOKEN))
        : readCinemaMedia(req, this.ctx.storage);
    if (
      path === '/cinema/ws' ||
      ['arm', 'disarm', 'enqueue', 'asset', 'asset-ready'].some(action => path === '/cinema/group-' + action)
    )
      return this.cinema.fetch(req);
    if (path === '/cinema/youtube')
      return (this.youtube ??= new YouTubeCatalog(this.env.YOUTUBE_API_KEY)).fetch(req, viewer);
    if (path === '/blackboard/ws' || path === '/blackboard/create') return this.blackboard.fetch(req);
    if (path.startsWith('/pong/')) return this.pong.fetch(req);
    if (new URL(req.url).pathname.startsWith('/golf/')) return this.golf.fetch(req);
    if (new URL(req.url).pathname.startsWith('/f1/')) return this.f1.fetch(req);
    if (new URL(req.url).pathname.startsWith('/biliardo/')) return this.biliardo.fetch(req);
    if (new URL(req.url).pathname.startsWith('/moto-trial/')) return this.moto.fetch(req);
    if (new URL(req.url).pathname.startsWith('/labyrinth/')) return this.lab.fetch(req);
    if (
      Number(req.headers.get('Content-Length') || 0) >
      (path === '/lobby/number-connect-score' || path === '/lobby/create' ? 420000 : 4096)
    )
      return json({ error: 'Richiesta troppo grande.' }, 413);
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const path = new URL(req.url).pathname;
        if (path.startsWith('/lobby/')) return this.lobbyHub.lobby(req, path);
        let s = await this.ctx.storage.get('state');
        if (path === '/results') return json(s ? resultsFor(s) : []);
        // Asked by the notice queue just before sending: is it still this player's turn, same turn as queued?
        if (path === '/turn-check') {
          const q = new URL(req.url).searchParams;
          return json({
            due:
              !!s &&
              !(activeTable(s) && s.expires < Date.now()) &&
              turnKey(s) === q.get('key') &&
              turnTargets(s).includes(q.get('player'))
          });
        }
        if (s?.game === 'cluedo')
          return json({ error: 'Cluedo è stato rimosso. Crea un nuovo tavolo di Scopa.' }, 410);
        if (path === '/init') {
          if (s) return json({ error: 'Stanza già esistente.' }, 409);
          const raw = await req.text();
          if (raw.length > 4096) bad('Richiesta troppo grande.');
          const b = JSON.parse(raw);
          const token = id();
          s = this.newTable(req.headers.get('X-Room'), b, token);
          await this.saveState(s);
          return json({ token, player: s.players[0].id, state: this.public(s, viewer) });
        }
        if (!s) {
          if (path.endsWith('/dismiss') && req.method === 'POST') return json({ left: true });
          return json({ error: 'Stanza inesistente o scaduta.' }, 404);
        }
        if (activeTable(s) && s.expires < Date.now())
          return json({ error: 'Stanza inesistente o scaduta.' }, 404);
        if (path === '/tidy-result' && req.method === 'POST') {
          if (concluded(s) && s.expires !== null) {
            if (!this.hasResultViewer(s)) {
              await this.record(s);
              return json(await this.removeTable(s, 'dismissed'));
            }
            s.revision++;
            await this.saveState(s);
          }
          return json(this.summary(this.public(s)));
        }
        if (path.endsWith('/ws')) {
          if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
            return json({ error: 'WebSocket richiesto.' }, 426);
          if (this.ctx.getWebSockets().length >= 60)
            return json({ error: 'Stanza piena (60 connessioni).' }, 429);
          const pair = new WebSocketPair();
          this.ctx.acceptWebSocket(pair[1]);
          pair[1].serializeAttachment({
            memberId: JSON.parse(req.headers.get('X-Checkmate-User') || 'null')?.id,
            accessTag: req.headers.get('X-Access-Tag'),
            expires: Number(req.headers.get('X-Session-Expires')),
            player: viewer
          });
          pair[1].send(JSON.stringify(this.public(s, viewer)));
          return new Response(null, {
            status: 101,
            webSocket: pair[0],
            headers: { 'Sec-WebSocket-Protocol': 'checkmate' }
          });
        }
        if (path.endsWith('/replay') && req.method === 'GET') {
          if (stagedGame(s.game)) return json({ room: s.room, revision: s.revision, frames: [] });
          if (s.connect4) {
            let game = initialConnect4();
            const frames = [game];
            for (const entry of s.moves) {
              game = playConnect4(game, entry.column);
              frames.push(game);
            }
            return json({ room: s.room, revision: s.revision, frames });
          }
          if (s.checkers) {
            let game = initialCheckers();
            const frames = [{ board: game.board, lastMove: null }];
            for (const entry of s.moves) {
              const played = playCheckers(game, entry.path);
              game = played.game;
              frames.push({ board: game.board, lastMove: played.move });
            }
            return json({ room: s.room, revision: s.revision, frames });
          }
          if (!s.chess) return json({ frames: [] });
          const game = new Chess(),
            frames = [{ fen: game.fen(), lastMove: null }];
          for (const entry of s.moves) {
            const m = game.move(entry.san);
            frames.push({ fen: game.fen(), lastMove: { from: m.from, to: m.to } });
          }
          return json({ room: s.room, revision: s.revision, frames });
        }
        if (path.endsWith('/state') && req.method === 'GET') {
          if (concluded(s) && s.expires !== null) {
            s.revision++;
            await this.saveState(s);
            await this.broadcast(s);
          } else {
            await this.record(s);
            if (this.botSeat(s) >= 0 && (await this.ctx.storage.getAlarm()) === null)
              await this.ctx.storage.setAlarm(Math.min(Date.now() + 650, s.expires));
          }
          const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null'),
            legacy = req.headers.get('X-Player-Token');
          const old = s.players.find(p => !p.id.startsWith('tg:') && legacy && p.token === legacy);
          if (user && old && !s.players.some(p => p.id === user.player)) {
            old.id = user.player;
            old.name = name(user.name);
            s.revision++;
            await this.saveState(s);
            await this.broadcast(s);
          }
          return json(this.public(s, viewer));
        }
        if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405);
        const raw = await req.text();
        if (raw.length > 4096) bad('Richiesta troppo grande.');
        const b = JSON.parse(raw || '{}');
        if (path.endsWith('/claim')) {
          if (
            s.mode === 'ai' ||
            s.mode === 'tutorial' ||
            s.phase !== 'waiting' ||
            (stagedGame(s.game) && s.players.length >= limits(s.game).max)
          )
            return json(
              {
                error: stagedGame(s.game)
                  ? 'Tavolo pieno o partita già avviata. Puoi assistere.'
                  : 'Il secondo posto è già occupato. Puoi assistere.'
              },
              409
            );
          const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
          if (s.players.some(p => p.id === user?.player))
            return json({ error: 'Sei già un giocatore di questa partita.' }, 409);
          const token = id(),
            p = { id: user?.player || id(), name: name(user?.name || b.name), token };
          s.players.push(p);
          s.phase = stagedGame(s.game) ? 'waiting' : 'playing';
          s.revision++;
          this.keepAlive(s);
          await this.saveState(s);
          await this.broadcast(s);
          this.queueNotice(s);
          return json({ token, player: p.id, state: this.public(s, viewer) });
        }
        const user = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
        const legacy = req.headers.get('X-Player-Token');
        const who = s.players.findIndex(
          p => p.id === user?.player || (!p.id.startsWith('tg:') && legacy && p.token === legacy)
        );
        if (who < 0) return json({ error: 'Solo i giocatori possono agire.' }, 403);
        if (path.endsWith('/dismiss')) {
          if (!concluded(s) || (s.matchId || null) !== (b.matchId || null)) return json({ left: true });
          if (this.hasResultViewer(s, { player: s.players[who].id })) return json({ left: true });
          return json(await this.removeTable(s, 'dismissed'));
        }
        if (path.endsWith('/rematch')) {
          if (s.phase !== 'finished' || activeTable(s) || b.revision !== s.revision)
            return json({ error: 'La partita è cambiata o deve ancora concludersi.' }, 409);
          const token = id();
          const next = this.newTable(
            s.room,
            {
              number: s.number,
              game: s.game || 'chess',
              mode: s.mode,
              target: s.series?.target,
              seats: s.players.length,
              playerId: user.player,
              name: user.name
            },
            token
          );
          next.matchId = id();
          next.revision = s.revision + 1;
          await this.record(s);
          await this.saveState(next);
          await this.broadcast(next);
          return json({ state: this.public(next, viewer), token, player: user.player });
        }
        if (path.endsWith('/archive') || path.endsWith('/delete')) {
          if (b.revision !== s.revision)
            return json({ error: 'La partita è cambiata. Aggiorna e riprova.' }, 409);
          if (path.endsWith('/delete')) return json(await this.removeTable(s, 'manual'));
          if (s.series) {
            s.series.done = true;
            s.series.cancelled = true;
          }
          s.archived = true;
          s.phase = 'finished';
          s.expires = null;
          s.revision++;
          if (s.chess) s.chess = { ...s.chess, legalMoves: [], reason: s.chess.reason || 'Archiviata' };
          if (s.checkers)
            s.checkers = { ...s.checkers, legalMoves: [], reason: s.checkers.reason || 'Archiviata' };
          if (s.connect4)
            s.connect4 = { ...s.connect4, legalMoves: [], reason: s.connect4.reason || 'Archiviata' };
          await this.ctx.storage.deleteAlarm();
          await this.saveState(s);
          await this.broadcast(s);
          return json(this.public(s, viewer));
        }
        if (path.endsWith('/next-round')) {
          if (
            who !== 0 ||
            s.archived ||
            s.phase !== 'finished' ||
            !s.series ||
            s.series.done ||
            !s.series.recorded ||
            b.revision !== s.revision
          )
            return json({ error: 'La prossima manche può essere avviata dal creatore.' }, 409);
          s.series.round++;
          s.series.recorded = false;
          this.resetRound(s);
          s.revision++;
          this.keepAlive(s);
          await this.saveState(s);
          await this.broadcast(s);
          this.queueNotice(s);
          return json(this.public(s, viewer));
        }
        if (stagedGame(s.game) && path.endsWith('/start')) {
          if (who !== 0) return json({ error: 'Solo chi ha creato il tavolo può avviare la partita.' }, 403);
          if (s.phase !== 'waiting') return json({ error: 'Il tavolo non è più in attesa.' }, 409);
          if (b.revision !== s.revision)
            return json(
              {
                error:
                  'I giocatori al tavolo sono cambiati. Controlla l’elenco e premi di nuovo Avvia partita.'
              },
              409
            );
          if (s.players.length < limits(s.game).min)
            return json({ error: 'Servono almeno ' + limits(s.game).min + ' giocatori per iniziare.' }, 409);
          this.resetRound(s);
          if (s.series) s.series.wins = Array(s.players.length).fill(0);
          s.revision++;
          this.keepAlive(s);
          await this.saveState(s);
          await this.broadcast(s);
          this.queueNotice(s);
          return json(this.public(s, viewer));
        }
        if (s.phase !== 'playing' && !(s.phase === 'waiting' && path.endsWith('/finish')))
          return json({ error: 'Partita non attiva.' }, 409);
        if (b.revision !== s.revision)
          return json({ error: 'La partita è cambiata. Riprova dopo l’aggiornamento.' }, 409);
        if (
          path.endsWith('/move') &&
          !(s.uno && ['uno', 'catch-uno'].includes(b.kind)) &&
          !s.scarabeo &&
          !(s.naval?.phase === 'placement') &&
          who !== s.turn
        )
          return json({ error: 'Non è il tuo turno.' }, 403);
        if (path.endsWith('/offer-draw')) {
          if ((!s.chess && !s.checkers) || s.phase !== 'playing')
            return json({ error: 'Patta disponibile solo durante una partita.' }, 409);
          if (s.chess && s.moves.length < 2)
            return json({ error: 'Entrambi devono aver giocato almeno una mossa.' }, 409);
          if (s.drawOffer) return json({ error: 'C’è già una proposta in attesa.' }, 409);
          if (s.lastDrawOffer?.by === who && s.lastDrawOffer?.ply === s.moves.length)
            return json({ error: 'Attendi una nuova mossa prima di proporre ancora la patta.' }, 409);
          s.drawOffer = { by: s.players[who].id, name: s.players[who].name };
          s.lastDrawOffer = { by: who, ply: s.moves.length };
        } else if (path.endsWith('/accept-draw') || path.endsWith('/reject-draw')) {
          if (!s.drawOffer || s.drawOffer.by === s.players[who].id)
            return json({ error: 'Non puoi rispondere a questa proposta.' }, 403);
          if (path.endsWith('/accept-draw')) {
            s.phase = 'finished';
            const key = s.connect4 ? 'connect4' : s.checkers ? 'checkers' : 'chess';
            s[key] = { ...s[key], legalMoves: [], reason: 'Patta concordata', result: '1/2-1/2' };
          }
          s.drawOffer = null;
        } else if (path.endsWith('/move')) {
          this.applyMove(s, who, b);
        } else if (path.endsWith('/pass')) {
          if (s.chess || s.checkers || s.connect4 || s.uno || s.scarabeo || s.scopa || s.naval || s.briscola)
            return json({ error: 'Devi effettuare una mossa.' }, 409);
          if (who !== s.turn) return json({ error: 'Non è il tuo turno.' }, 403);
          s.moves.push({ by: s.players[who].name, at: Date.now(), number: s.moves.length + 1 });
          s.turn = 1 - s.turn;
          if (s.moves.length >= 500) s.phase = 'finished';
        } else if (path.endsWith('/finish')) {
          if (s.series) {
            s.series.done = true;
            s.series.cancelled = true;
          }
          s.phase = 'finished';
          if (s.chess) s.chess = { ...s.chess, legalMoves: [], reason: 'Partita chiusa', result: null };
          if (s.checkers)
            s.checkers = { ...s.checkers, legalMoves: [], reason: 'Partita chiusa', result: null };
          if (s.connect4)
            s.connect4 = { ...s.connect4, legalMoves: [], reason: 'Partita chiusa', result: null };
          if (s.uno) s.uno = { ...s.uno, result: 'closed', reason: 'Partita chiusa' };
        } else bad('Azione non valida.');
        settleSeries(s);
        s.revision++;
        this.keepAlive(s);
        await this.saveState(s);
        await this.broadcast(s);
        this.queueNotice(s);
        return json(this.public(s, viewer));
      } catch (e) {
        return json({ error: e instanceof SyntaxError ? 'Richiesta non valida.' : e.message }, 400);
      }
    });
  }

  summary(s) {
    return tables.tableSummary(s);
  }
  get lobbyHub() {
    return (this._lobbyHub ??= new LobbyHub(this.ctx, this.env));
  }
  get blackboard() {
    return (this._blackboard ??= new Blackboard(this.ctx));
  }

  async webSocketMessage(ws, message) {
    await this.guardSockets();
    if (ws.deserializeAttachment()?.authDenied) return;
    const a = ws.deserializeAttachment();
    const memberId =
      a?.memberId ||
      a?.user?.id ||
      (a?.player?.startsWith('tg:') ? a.player.slice(3) : null) ||
      (typeof a?.id === 'string' ? a.id.replace(/^tg:/, '') : null);
    if (!memberId || (await memberAccess({ id: memberId }, this.env)) !== true) {
      ws.close(4003, 'Accesso al gruppo richiesto');
      return;
    }
    if (!this.env.BOT_TOKEN || a?.accessTag !== (await telegramAccessTag(this.env))) {
      ws.close(4001, 'Riapri la Mini App');
      return;
    }
    if (a?.kind === 'blackboard') return this.blackboard.message(ws, message);
    if (a?.kind === 'cinema') return this.cinema.message(ws, message);
    if (a?.kind === 'lab') return this.lab.message(ws, message);
    if (a?.kind === 'moto-trial') return this.moto.message(ws, message);
    if (a?.kind === 'pong') return this.pong.message(ws, message);
    if (a?.kind !== 'lobby') {
      ws.close(1008, 'Sola lettura.');
      return;
    }
    try {
      if (typeof message !== 'string' || message.length > 512) return;
      const b = JSON.parse(message);
      if (b.type === 'balilla' && a.inClub && !a.closed) return this.balilla.message(ws, memberId, b);
      // Radio del bancone e volume dei tavoli valgono per tutto il club: al massimo un cambio ogni 4 secondi a testa,
      // così nessuno li tiene "occupati" cambiandoli di continuo.
      if ((b.type === 'table-volume' || b.type === 'club-radio') && a.inClub && !a.closed) {
        if (b.type === 'table-volume' && (!Number.isInteger(b.percent) || b.percent < 0 || b.percent > 100))
          return;
        if (
          b.type === 'club-radio' &&
          b.station !== null &&
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(b.station)
        )
          return;
        const now = Date.now();
        // troppo presto: solo a chi ha chiesto si rimanda lo stato vero, così il suo comando torna com'era
        if (now - (a.clubChangeAt || 0) < 4000)
          return ws.send(JSON.stringify(await this.lobbyHub.lobbyPayload()));
        a.clubChangeAt = now;
        ws.serializeAttachment(a);
        if (b.type === 'table-volume') await this.ctx.storage.put('tableVolume', b.percent);
        else await this.ctx.storage.put('clubRadio', b.station);
        await this.lobbyHub.lobbyBroadcast();
        return;
      }
      if (b.type !== 'presence') return;
      a.inClub = b.inClub === true && !b.away;
      if (!a.inClub) this.balilla.leave(ws);
      a.room = typeof b.room === 'string' && /^[a-f0-9-]{36}$/.test(b.room) ? b.room : null;
      a.seen = Date.now();
      a.closed = !!b.away;
      const pose = b.pose;
      a.clubPose =
        !a.closed && pose && typeof pose.station === 'string' && /^[a-z0-9-]{1,48}$/.test(pose.station)
          ? {
              station: pose.station,
              slot: Number.isInteger(pose.slot) && pose.slot >= 0 && pose.slot < 4 ? pose.slot : 0,
              mode: pose.mode === 4 ? 4 : 2,
              pair: pose.pair === 0 ? 0 : 1,
              shirt: /^#[0-9a-f]{6}$/i.test(pose.shirt) ? pose.shirt : '#35618a',
              shorts: /^#[0-9a-f]{6}$/i.test(pose.shorts) ? pose.shorts : '#303745'
            }
          : null;
      ws.serializeAttachment(a);
      await this.lobbyHub.lobbyBroadcast(false);
    } catch {}
  }
  async webSocketClose(ws, code) {
    await this.guardSockets();
    const attachment = ws.deserializeAttachment();
    if (attachment?.kind === 'blackboard') return this.blackboard.close(ws);
    if (attachment?.kind === 'cinema') return this.cinema.close(ws);
    if (attachment?.kind === 'lab') {
      await this.lab.close(ws);
    } else if (attachment?.kind === 'moto-trial') {
      await this.moto.close(ws);
    } else if (attachment?.kind === 'pong') {
      await this.pong.close(ws);
    } else if (attachment?.kind === 'lobby') {
      this.balilla.leave(ws);
      attachment.closed = true;
      ws.serializeAttachment(attachment);
      await this.lobbyHub.lobbyBroadcast();
    } else if (attachment?.player && (code === 1000 || code === 1001)) {
      await this.ctx.blockConcurrencyWhile(async () => {
        const s = await this.ctx.storage.get('state');
        if (
          s &&
          concluded(s) &&
          s.players.some(p => p.id === attachment.player) &&
          !this.hasResultViewer(s, { socket: ws })
        ) {
          await this.removeTable(s, 'dismissed');
          this.notifyTableRemoved(s.room);
        }
      });
    }
    try {
      ws.close(code === 1006 ? 1000 : code);
    } catch {}
  }
  webSocketError(ws) {
    this.balilla.leave(ws);
    const kind = ws.deserializeAttachment()?.kind;
    if (kind === 'blackboard') return this.blackboard.close(ws);
    if (kind === 'cinema') return this.cinema.close(ws);
    if (kind === 'lab') return this.lab.close(ws);
    if (kind === 'moto-trial') return this.moto.close(ws);
    if (kind === 'pong') return this.pong.close(ws);
    ws.close(1011, 'Riconnettersi.');
  }
  async alarm() {
    await this.guardSockets();
    if (this.ctx.id.toString() === this.env.ROOMS.idFromName('binotto-simulator-league-v1').toString())
      return (this.simulator ??= new SimulatorLeague(this.ctx, this.env)).alarm();
    if (this.ctx.id.toString() === this.env.ROOMS.idFromName('cinema-streamer-v1').toString())
      return this.cinema.alarm();
    if (this.ctx.id.toString() === this.env.ROOMS.idFromName('turn-notices-v1').toString())
      return (this.notices ??= new TurnNotices(this.ctx, this.env)).alarm();
    if (await this.ctx.storage.get('cinema-upload')) return this.ctx.storage.deleteAll();
    if (await this.ctx.storage.get('expedition')) return this.lab.alarm();
    if (await this.ctx.storage.get('golf')) return this.golf.alarm();
    if (await this.ctx.storage.get('f1')) return this.f1.alarm();
    if (await this.ctx.storage.get('biliardo')) return this.biliardo.alarm();
    if (await this.ctx.storage.get('moto-trial')) return this.moto.alarm();
    if (await this.ctx.storage.get('pong')) return this.pong.alarm();
    if (this.ctx.id.toString() === this.env.ROOMS.idFromName('checkmate-lobby-v1').toString())
      return this.lobbyHub.alarm();
    return this.ctx.blockConcurrencyWhile(async () => {
      const current = await this.ctx.storage.get('state');
      if (!current || current.archived) return;
      if (concluded(current)) {
        if (!this.hasResultViewer(current)) {
          await this.removeTable(current, 'dismissed');
          this.notifyTableRemoved(current.room);
        } else await this.saveState(current);
        return;
      }
      if (current.expires <= Date.now()) {
        await this.removeTable(current, 'expired');
        this.notifyTableRemoved(current.room);
        return;
      }
      // Long-turn tables: reminder or timeout when the time to move runs out.
      if (await this.runClock(current)) return;
      const who = this.botSeat(current);
      if (who < 0) {
        await this.ctx.storage.setAlarm(current.expires);
        return;
      }
      const v = this.public(current, current.players[who].id);
      const view = v.naval || v.briscola || v[current.game] || v.chess;
      const strong = current.mode === 'ai';
      // Cards already captured were publicly played. The strategy receives no private opposing cards.
      const captured = current.scopa?.captured || current.briscola?.captured;
      let botView = view;
      if (strong && captured) botView = { ...view, seenCards: captured.flat() };
      else if (strong && current.chess) botView = { ...view, moves: current.moves };
      else if (strong && current.checkers) botView = { ...view, positions: current.positions };

      const action = chooseAction(current.game, botView, who, strong);
      if (!action) throw Error('AI: nessuna azione disponibile');
      this.applyMove(current, who, action);
      settleSeries(current);
      current.revision++;
      await this.saveState(current);
      if (concluded(current) && !this.hasResultViewer(current)) {
        await this.removeTable(current, 'dismissed');
        this.notifyTableRemoved(current.room);
        return;
      }
      await this.broadcast(current);
      await this.syncLobby(current);
    });
  }
}
