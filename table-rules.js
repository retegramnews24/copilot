// Board-game tables (chess, checkers, Forza 4, UNO, Scarabeo, Scopa, Battaglia navale, Briscola): pure rules on
// the stored table state. The Room Durable Object (worker.js) stores it, runs the AI and talks to the players.
import { Chess } from 'chess.js';
import { chessSnapshot, claimChessDraw } from './chess-rules.js';
import { initialNaval, playNaval, navalView } from './naval.js';
import { initialBriscola, playBriscola, briscolaView } from './briscola.js';
import { initialScarabeo, playScarabeo, scarabeoView } from './scarabeo.js';
import { initialScopa, playScopa, scopaView } from './scopa.js';
import { initialUno, playUno, unoView } from './uno.js';
import { initialConnect4, playConnect4 } from './connect4.js';
import { initialCheckers, playCheckers, checkersSnapshot, checkersKey } from './checkers.js';
import { tutorial } from './table-ai.js';
import { limits, createSeries, activeTable } from './match-series.js';
import { TURN_LIMIT, isLongTurn, LONG_LIMIT } from './turn-notices.js';
import { id, name } from './worker-shared.js';

// What a viewer may see of a table (own hand only); limit is the time to move, for the clock deadline.
export function publicTable(s, viewer = null, limit = TURN_LIMIT) {
  return {
    room: s.room,
    matchId: s.matchId || null,
    number: s.number || null,
    game: s.game || 'chess',
    archived: !!s.archived,
    phase: s.phase,
    players: s.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot })),
    mode: s.mode || 'people',
    tutorial:
      s.mode === 'tutorial' && s.phase === 'playing' && s.players[0].id === viewer
        ? tutorialView(s, limit)
        : null,
    turn: s.turn,
    revision: s.revision,
    moves: s.moves,
    series: s.series || null,
    limits: limits(s.game),
    drawOffer: s.drawOffer || null,
    chess: s.chess || null,
    checkers: s.checkers || null,
    connect4: s.connect4 || null,
    uno: s.uno
      ? unoView(
          s.uno,
          s.players.findIndex(p => p.id === viewer)
        )
      : null,
    scarabeo: s.scarabeo
      ? scarabeoView(
          s.scarabeo,
          s.players.findIndex(p => p.id === viewer)
        )
      : null,
    scopa: s.scopa
      ? scopaView(
          s.scopa,
          s.players.findIndex(p => p.id === viewer)
        )
      : null,
    naval: s.naval
      ? navalView(
          s.naval,
          s.players.findIndex(p => p.id === viewer)
        )
      : null,
    briscola: s.briscola
      ? briscolaView(
          s.briscola,
          s.players.findIndex(p => p.id === viewer)
        )
      : null,
    created: s.created,
    expires: s.expires,
    clock: s.clock
      ? { since: s.clock.since, reminded: !!s.clock.reminded, deadline: s.clock.since + 2 * limit }
      : null
  };
}
// A new table: creator seated; against the AI or in a tutorial the bots are seated and the game starts.
export function newTable(room, b, token) {
  const game = b.game ?? 'chess';
  const s = {
    room,
    number: b.number || null,
    phase: 'waiting',
    players: [{ id: b.playerId || id(), name: name(b.name), token }],
    turn: 0,
    revision: 0,
    moves: [],
    series: createSeries(b.target),
    game,
    mode: b.mode ?? 'people',
    chess: null,
    created: Date.now(),
    expires: Date.now() + 7 * 86400000
  };
  switch (game) {
    case 'naval':
      s.naval = initialNaval();
      break;
    case 'briscola':
    case 'briscola5':
      s.briscola = initialBriscola();
      break;
    case 'scarabeo':
      s.scarabeo = initialScarabeo();
      break;
    case 'scopa':
      s.scopa = initialScopa();
      break;
    case 'uno':
      s.uno = initialUno();
      break;
    case 'connect4':
      s.connect4 = initialConnect4();
      break;
    case 'checkers': {
      const checkers = initialCheckers();
      s.checkers = checkersSnapshot(checkers);
      s.positions = { [checkersKey(checkers)]: 1 };
      break;
    }
    case 'chess':
      s.chess = chessSnapshot(new Chess());
      break;
    default:
      throw Error('Gioco non disponibile.');
  }
  if (!['people', 'ai', 'tutorial'].includes(s.mode)) throw Error('Modalità di gioco non valida.');
  if (s.mode !== 'people') {
    if (b.target > 1) throw Error('Il singolo è disponibile in partita veloce o tutorial.');
    const { min, max } = limits(s.game),
      count = b.seats ?? min;
    if (!Number.isInteger(count) || count < min || count > max) throw Error('Numero posti non valido.');
    while (s.players.length < count)
      s.players.push({ id: 'bot:' + s.players.length, name: 'AI ' + s.players.length, bot: true });
    resetRound(s);
  }
  return s;
}
export function resetRound(s) {
  s.moves = [];
  s.drawOffer = null;
  s.lastDrawOffer = null;
  s.turn = 0;
  s.phase = 'playing';
  if (s.game === 'uno') {
    s.uno = initialUno(s.players.length);
    s.turn = s.uno.turn;
  } else if (s.game === 'scarabeo') {
    s.scarabeo = initialScarabeo(s.players.length);
    s.turn = s.scarabeo.turn;
  } else if (s.game === 'scopa') s.scopa = initialScopa(s.players.length);
  else if (s.game === 'naval') s.naval = initialNaval();
  else if (['briscola', 'briscola5'].includes(s.game)) {
    s.briscola = initialBriscola(
      s.players.length,
      undefined,
      s.briscola?.hands.length ? (s.briscola.dealer + 1) % s.players.length : null
    );
    s.turn = s.briscola.turn;
  } else if (s.game === 'connect4') s.connect4 = initialConnect4();
  else if (s.game === 'checkers') {
    s.checkers = checkersSnapshot(initialCheckers());
    s.positions = { [checkersKey(initialCheckers())]: 1 };
  } else s.chess = chessSnapshot(new Chess());
}
// The tutorial hint for the human player (seat 0).
export function tutorialView(s, limit = TURN_LIMIT) {
  const seat = 0,
    view = publicTable({ ...s, mode: 'ai' }, s.players[0].id, limit),
    g = view.naval || view.briscola || view[s.game] || view.chess;
  const can = s.scarabeo?.pending
    ? s.scarabeo.pending.by !== 0 && !Object.hasOwn(s.scarabeo.pending.votes, 0)
    : s.naval?.phase === 'placement'
      ? !s.naval.ready[0]
      : s.turn === 0;
  return can
    ? tutorial(s.game, g, seat, s.moves.length)
    : {
        title: 'Turno dell’AI',
        text: 'Osserva la risposta dell’avversario. Poi potrai scegliere liberamente o provare la mossa suggerita.',
        reason: g.lastEvent || '',
        action: null
      };
}
// The AI seat that must act now, or -1.
export function botSeat(s) {
  if (s.phase !== 'playing' || !['ai', 'tutorial'].includes(s.mode)) return -1;
  if (s.scarabeo?.pending)
    return s.players.findIndex(
      (p, i) => p.bot && i !== s.scarabeo.pending.by && !Object.hasOwn(s.scarabeo.pending.votes, i)
    );
  if (s.naval?.phase === 'placement') return s.players.findIndex((p, i) => p.bot && !s.naval.ready[i]);
  return s.players[s.turn]?.bot ? s.turn : -1;
}
// Applies a move of seat `who` to the state (throws on an illegal move).
export function applyMove(s, who, b) {
  if (s.naval || s.briscola) {
    const key = s.naval ? 'naval' : 'briscola',
      next = s.naval ? playNaval(s.naval, who, b) : playBriscola(s.briscola, who, b);
    s[key] = next;
    s.turn = next.turn;
    s.moves.push({
      description: next.lastEvent,
      by: s.players[who].name,
      at: Date.now(),
      number: s.moves.length + 1
    });
    if (next.result) s.phase = 'finished';
  } else if (s.scarabeo || s.scopa) {
    const key = s.scarabeo ? 'scarabeo' : 'scopa',
      next = s.scarabeo ? playScarabeo(s.scarabeo, who, b) : playScopa(s.scopa, who, b);
    s[key] = next;
    s.turn = next.turn;
    s.moves.push({
      description: next.lastEvent,
      by: s.players[who].name,
      at: Date.now(),
      number: s.moves.length + 1
    });
    if (next.result) s.phase = 'finished';
  } else if (s.uno) {
    const next = playUno(s.uno, who, b);
    s.uno = next;
    s.turn = next.turn;
    s.drawOffer = null;
    s.moves.push({
      description: next.lastEvent,
      by: s.players[who].name,
      at: Date.now(),
      number: s.moves.length + 1
    });
    if (next.result) s.phase = 'finished';
  } else if (s.connect4) {
    if (who !== s.turn) throw Error('Non è il tuo turno.');
    const next = playConnect4(s.connect4, b.column);
    s.connect4 = next;
    s.turn = next.turn;
    s.drawOffer = null;
    s.moves.push({
      column: b.column,
      row: next.lastMove.row,
      by: s.players[who].name,
      at: Date.now(),
      number: s.moves.length + 1
    });
    if (next.result) s.phase = 'finished';
  } else if (s.checkers) {
    if (who !== s.turn) throw Error('Non è il tuo turno.');
    const played = playCheckers(s.checkers, b.path),
      key = checkersKey(played.game);
    s.positions = s.positions || {};
    s.positions[key] = (s.positions[key] || 0) + 1;
    s.moves.push({ ...played.move, by: s.players[who].name, at: Date.now(), number: s.moves.length + 1 });
    s.drawOffer = null;
    s.turn = played.game.turn;
    s.checkers = checkersSnapshot(played.game, played.move, s.positions[key]);
    if (s.checkers.result) s.phase = 'finished';
  } else {
    if (!s.chess)
      throw Error('Questa è una stanza di prova precedente. Crea una nuova partita per giocare a scacchi.');
    if (who !== s.turn) throw Error('Non è il tuo turno.');
    const game = new Chess();
    for (const move of s.moves) game.move(move.san);
    if (b.kind === 'claim-draw') {
      const proposed = b.move;
      if (
        proposed !== undefined &&
        (!proposed || typeof proposed.from !== 'string' || typeof proposed.to !== 'string')
      )
        throw Error('Mossa proposta non valida.');
      s.chess = claimChessDraw(game, s.chess.lastMove, proposed);
      s.phase = 'finished';
      s.drawOffer = null;
      return;
    }
    if (typeof b.from !== 'string' || typeof b.to !== 'string') throw Error('Mossa non valida.');
    let moved;
    try {
      moved = game.move({ from: b.from, to: b.to, promotion: b.promotion || 'q' });
    } catch {
      throw Error('Mossa non consentita.');
    }
    s.moves.push({
      by: s.players[who].name,
      at: Date.now(),
      number: s.moves.length + 1,
      san: moved.san,
      from: moved.from,
      to: moved.to,
      ...(moved.promotion ? { promotion: moved.promotion } : {})
    });
    s.drawOffer = null;
    s.turn = game.turn() === 'w' ? 0 : 1;
    s.chess = chessSnapshot(game, { from: moved.from, to: moved.to });
    if (s.chess.result) s.phase = 'finished';
  }
}
// The record kept in the Lobby list.
export function tableSummary(s) {
  return {
    room: s.room,
    number: s.number,
    game: s.game || 'chess',
    archived: !!s.archived,
    phase: s.phase,
    players: s.players,
    turn: s.turn,
    revision: s.revision,
    series: s.series || null,
    mode: s.mode || 'people',
    created: s.created,
    expires: s.expires,
    deadline: s.clock?.deadline ?? null,
    ...(s.game === 'labyrinth'
      ? { online: s.online, arrived: s.arrived, entryLocked: s.entryLocked, arenaResult: s.arenaResult }
      : s.game === 'moto-trial'
        ? { online: s.online, capacity: s.capacity, courseName: s.courseName }
        : s.game === 'golf'
          ? {
              capacity: s.capacity,
              hole: s.hole,
              campaign: s.campaign,
              holes: s.holes,
              collisions: s.collisions === true
            }
          : s.game === 'f1'
            ? { capacity: s.capacity, laps: s.laps }
            : {})
  };
}
// Which tables count where (Lobby list, one-table rule, finished tables).
export const isArcade = game =>
  game === 'labyrinth' || game === 'moto-trial' || game === 'golf' || game === 'pong' || game === 'f1';
// One open table per person, except long-turn tables (Scacchi, Dama, Forza 4, Scarabeo between people):
// up to LONG_LIMIT of those at once, alongside the one other table. Returns 'long', 'other' or null.
export function seatLimit(tables, player, target) {
  const mine = tables.filter(
    g => !isArcade(g.game) && activeTable(g) && g.room !== target.room && g.players.some(p => p.id === player)
  );
  if (isLongTurn(target)) return mine.filter(isLongTurn).length >= LONG_LIMIT ? 'long' : null;
  // Other games: any number of different games, one open table per game.
  return mine.some(g => !isLongTurn(g) && g.game === target.game) ? 'other' : null;
}
export const longLimitText =
  'Hai già ' + LONG_LIMIT + ' partite a turni aperte: finiscine una prima di aprirne un’altra.';
export const concluded = table => table.phase === 'finished' && !activeTable(table) && !table.archived;
