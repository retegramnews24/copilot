import assert from 'node:assert/strict';
import {
  turnTargets,
  turnKey,
  isQuiet,
  outsideQuiet,
  noticeText,
  noticeRequest,
  openLink,
  TurnNotices,
  SEND_DELAY
} from '../turn-notices.js';

const ROOM = '0f8fad5b-d9cb-469f-a165-70867728950e';
const chess = (extra = {}) => ({
  room: ROOM,
  number: 3,
  game: 'chess',
  mode: 'people',
  phase: 'playing',
  turn: 1,
  players: [
    { id: 'tg:111', name: 'Ada' },
    { id: 'tg:222', name: 'Bruno' }
  ],
  moves: [{ by: 'Ada', san: 'e4' }],
  ...extra
});

// Who must act.
assert.deepEqual(turnTargets(chess()), ['tg:222']);
assert.deepEqual(turnTargets(chess({ turn: 0 })), ['tg:111']);
assert.deepEqual(turnTargets(chess({ mode: 'ai' })), [], 'no messages against the AI');
assert.deepEqual(turnTargets(chess({ game: 'uno' })), [], 'UNO is not a long-turn game');
assert.deepEqual(turnTargets(chess({ phase: 'finished' })), []);
assert.deepEqual(turnTargets(chess({ archived: true })), []);
assert.deepEqual(
  turnTargets(
    chess({
      players: [
        { id: 'tg:111', name: 'Ada' },
        { id: 'bot:1', name: 'AI', bot: true }
      ]
    })
  ),
  []
);
assert.deepEqual(turnTargets(chess({ game: 'checkers' })), ['tg:222']);
assert.deepEqual(turnTargets(chess({ game: 'connect4' })), ['tg:222']);
const scarabeo = chess({
  game: 'scarabeo',
  turn: 0,
  players: [
    { id: 'tg:111', name: 'Ada' },
    { id: 'tg:222', name: 'Bruno' },
    { id: 'tg:333', name: 'Carla' }
  ],
  scarabeo: { pending: { by: 0, votes: { 1: true } } }
});
assert.deepEqual(turnTargets(scarabeo), ['tg:333'], 'only who still has to vote');
assert.notEqual(turnKey(scarabeo), turnKey({ ...scarabeo, scarabeo: {} }), 'a vote is a turn of its own');
assert.notEqual(turnKey(chess()), turnKey(chess({ moves: [{}, {}] })));

// Quiet hours 23-8, Rome time, both in winter (UTC+1) and summer (UTC+2).
const at = iso => Date.parse(iso);
assert.equal(isQuiet(at('2026-11-16T10:00:00Z')), false); // 11:00
assert.equal(isQuiet(at('2026-11-16T21:59:00Z')), false); // 22:59
assert.equal(isQuiet(at('2026-11-16T22:00:00Z')), true); // 23:00
assert.equal(isQuiet(at('2026-11-17T06:59:00Z')), true); // 07:59
assert.equal(isQuiet(at('2026-11-17T07:00:00Z')), false); // 08:00
const winter = outsideQuiet(at('2026-11-16T22:30:00Z'));
assert.ok(
  winter >= at('2026-11-17T07:00:00Z') && winter <= at('2026-11-17T07:05:00Z'),
  'winter: next day 8:00'
);
const summer = outsideQuiet(at('2026-07-01T05:30:00Z')); // 07:30 Rome
assert.ok(
  summer >= at('2026-07-01T06:00:00Z') && summer <= at('2026-07-01T06:05:00Z'),
  'summer: 8:00 the same day'
);
assert.equal(outsideQuiet(at('2026-11-16T10:00:00Z')), at('2026-11-16T10:00:00Z'), 'daytime: unchanged');

// Texts and the request the table sends.
assert.equal(
  noticeText({ game: 'chess', number: 3, opponent: 'Ada' }),
  'Tocca a te contro Ada.\n♟ Scacchi · Tavolo 3'
);
assert.match(
  noticeText({ game: 'connect4', opponent: 'Ada', seated: true }),
  /^Ada si è seduto al tuo tavolo/
);
assert.match(noticeText({ game: 'scarabeo', started: true }), /^La partita è iniziata/);
assert.match(noticeText({ game: 'scarabeo', opponent: 'Ada', vote: true }), /serve il tuo voto/);
assert.equal(openLink(ROOM), 'https://t.me/checkmategame_bot?startapp=t-' + ROOM);
assert.deepEqual(noticeRequest(chess()), {
  room: ROOM,
  key: turnKey(chess()),
  game: 'chess',
  number: 3,
  vote: false,
  seated: false,
  started: false,
  targets: [{ player: 'tg:222', opponent: 'Ada' }]
});
const seated = noticeRequest(chess({ turn: 0, moves: [] }));
assert.equal(seated.seated, true);
assert.equal(seated.targets[0].opponent, 'Bruno');
assert.equal(noticeRequest(chess({ mode: 'ai' })), null);

// The queue, with a fake storage, clock, Telegram, table and Lobby.
function harness() {
  const data = new Map();
  let alarm = null;
  const storage = {
    get: async k => structuredClone(data.get(k)),
    put: async (k, v) => void data.set(k, structuredClone(v)),
    delete: async k => data.delete(k),
    list: async ({ prefix }) => new Map([...data].filter(([k]) => k.startsWith(prefix)).sort()),
    setAlarm: async t => void (alarm = t),
    deleteAlarm: async () => void (alarm = null),
    getAlarm: async () => alarm
  };
  const h = {
    clock: at('2026-11-16T10:00:00Z'),
    sent: [],
    telegramStatus: 200,
    due: true,
    present: false,
    data,
    alarm: () => alarm
  };
  h.notices = new TurnNotices(
    { storage },
    {},
    {
      now: () => h.clock,
      telegram: async (method, payload) => {
        h.sent.push({ method, payload });
        return { ok: h.telegramStatus === 200, status: h.telegramStatus };
      },
      table: async () => ({ due: h.due }),
      presence: async () => h.present
    }
  );
  h.call = async (path, body, user) => {
    const response = await h.notices.fetch(
      new Request('https://internal' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: user ? { 'X-Checkmate-User': JSON.stringify(user) } : {},
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    );
    return response.json();
  };
  h.queue = s => h.call('/notices/queue', noticeRequest(s));
  h.run = async ms => {
    h.clock += ms;
    await h.notices.alarm();
  };
  return h;
}

{
  // Daytime: one message after the short delay, with the button to the table.
  const h = harness();
  await h.queue(chess());
  assert.equal(h.alarm(), h.clock + SEND_DELAY);
  await h.run(30000);
  assert.equal(h.sent.length, 0, 'not before the delay');
  await h.run(31000);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].payload.chat_id, 222);
  assert.equal(h.sent[0].payload.text, 'Tocca a te contro Ada.\n♟ Scacchi · Tavolo 3');
  assert.equal(h.sent[0].payload.reply_markup.inline_keyboard[0][0].url, openLink(ROOM));
  assert.deepEqual(await h.call('/notices/status', undefined, { id: '222' }), {
    enabled: true,
    started: true,
    bot: 'checkmategame_bot'
  });
  // Same turn queued again (e.g. a draw offer): no second message.
  await h.queue(chess());
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 1);
  // Next turn: a new message.
  await h.queue(chess({ moves: [{ by: 'Ada' }, { by: 'Bruno' }, { by: 'Ada' }] }));
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 2);
  assert.equal(h.alarm(), null, 'queue empty, no alarm left');
}
{
  // At the table, or turn already played: nothing is sent.
  const h = harness();
  h.present = true;
  await h.queue(chess());
  await h.run(SEND_DELAY + 1000);
  h.present = false;
  h.due = false;
  await h.queue(chess({ moves: [{}, {}, { by: 'Ada' }] }));
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 0);
}
{
  // A newer turn replaces the older message still waiting for the same player.
  const h = harness();
  await h.queue(chess());
  await h.queue(chess({ moves: [{}, {}, { by: 'Ada' }] }));
  assert.equal([...h.data.keys()].filter(k => k.startsWith('queue:')).length, 1);
}
{
  // Quiet hours: queued at 23:30, sent the next morning between 8:00 and 8:05.
  const h = harness();
  h.clock = at('2026-11-16T22:30:00Z');
  await h.queue(chess());
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 0);
  h.clock = at('2026-11-17T07:06:00Z');
  await h.notices.alarm();
  assert.equal(h.sent.length, 1);
}
{
  // Turned off in Settings: nothing is sent. Turned on again: messages resume.
  const h = harness();
  await h.call('/notices/start', { userId: '222' });
  assert.equal((await h.call('/notices/status', { enabled: false }, { id: '222' })).enabled, false);
  await h.queue(chess());
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 0);
  assert.equal((await h.call('/notices/status', { enabled: true }, { id: '222' })).enabled, true);
  await h.queue(chess({ moves: [{}, {}, { by: 'Ada' }] }));
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 1);
}
{
  // Never started the bot / blocked it: Telegram refuses (403), the user is marked and skipped afterwards.
  const h = harness();
  h.telegramStatus = 403;
  await h.queue(chess());
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(await h.call('/notices/status', undefined, { id: '222' }), {
    enabled: false,
    started: false,
    bot: 'checkmategame_bot'
  });
  // Turning them on from the app is not enough: the bot's chat must be started.
  assert.equal((await h.call('/notices/status', { enabled: true }, { id: '222' })).enabled, false);
  await h.queue(chess({ moves: [{}, {}, { by: 'Ada' }] }));
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 1, 'skipped while blocked');
  // Start in the bot's chat: on again.
  h.telegramStatus = 200;
  await h.call('/notices/start', { userId: '222' });
  await h.queue(chess({ moves: [{}, {}, {}, { by: 'Ada' }] }));
  await h.run(SEND_DELAY + 1000);
  assert.equal(h.sent.length, 2);
}
{
  // Bad input is refused; only Telegram players can be queued.
  const h = harness();
  assert.ok((await h.call('/notices/queue', { room: ROOM })).error);
  assert.ok((await h.call('/notices/start', { userId: 'abc' })).error);
  await h.call('/notices/queue', { room: ROOM, key: 'k', targets: [{ player: 'guest-1' }] });
  assert.equal(h.alarm(), null);
}

// Time to move: what each game does when time runs out.
{
  const { timeoutTable, reminderRequest, resultRequest, penaltyFor } = await import('../turn-notices.js');
  const { initialScarabeo, playScarabeo } = await import('../scarabeo.js');
  for (const [game, key] of [
    ['chess', 'chess'],
    ['checkers', 'checkers'],
    ['connect4', 'connect4']
  ]) {
    const s = chess({
      game,
      chess: null,
      [key]: { legalMoves: [{}], result: null, reason: '' },
      drawOffer: { by: 'tg:111' }
    });
    assert.equal(penaltyFor(s), 'lose');
    const told = timeoutTable(s, 1000);
    assert.equal(s.phase, 'finished');
    assert.equal(s[key].result, '1-0', game + ': Bruno was on turn (seat 1), Ada wins');
    assert.equal(s[key].reason, 'Tempo scaduto · Ada vince a tavolino');
    assert.deepEqual(s[key].legalMoves, []);
    assert.equal(s.drawOffer, null);
    assert.deepEqual(told, [
      { player: 'tg:222', outcome: 'lost', opponent: 'Ada' },
      { player: 'tg:111', outcome: 'won', opponent: 'Bruno' }
    ]);
  }
  // Scarabeo, two players: lost; three players: skipped turn, the game goes on.
  const scarabeoTable = n => {
    const players = ['Ada', 'Bruno', 'Carla']
      .slice(0, n)
      .map((name, i) => ({ id: 'tg:' + (i + 1) * 111, name }));
    const g = initialScarabeo(n);
    return {
      room: ROOM,
      number: 1,
      game: 'scarabeo',
      mode: 'people',
      phase: 'playing',
      players,
      turn: g.turn,
      moves: [],
      scarabeo: g
    };
  };
  const two = scarabeoTable(2),
    onTurn = two.players[two.turn];
  assert.equal(penaltyFor(two), 'lose');
  const toldTwo = timeoutTable(two, 1000);
  assert.equal(two.phase, 'finished');
  assert.deepEqual(two.scarabeo.winners, [1 - two.turn]);
  assert.equal(toldTwo[0].player, onTurn.id);
  assert.equal(toldTwo[0].outcome, 'lost');
  const three = scarabeoTable(3),
    before = three.turn;
  assert.equal(penaltyFor(three), 'skip');
  assert.deepEqual(timeoutTable(three, 1000), [
    { player: three.players[before].id, outcome: 'skipped', opponent: '' }
  ]);
  assert.equal(three.phase, 'playing');
  assert.equal(three.turn, (before + 1) % 3);
  assert.match(three.moves.at(-1).description, /salta il turno/);
  // A word waiting for votes: missing votes count as accepted.
  const voting = scarabeoTable(3);
  const proposer = voting.turn,
    letters = voting.scarabeo.racks[proposer].filter(t => t.letter !== '?').map(t => t.letter);
  // Two letters from the rack over the centre (index 144 = row 8, column 8 on the 17×17 board).
  voting.scarabeo = playScarabeo(voting.scarabeo, proposer, {
    kind: 'place',
    word: letters[0] + letters[1],
    row: 8,
    col: 7,
    direction: 'horizontal'
  });
  assert.ok(voting.scarabeo.pending, 'the word waits for votes');
  assert.equal(penaltyFor(voting), 'accept');
  assert.equal(turnTargets(voting).length, 2);
  const toldVotes = timeoutTable(voting, 1000);
  assert.equal(voting.scarabeo.pending, null, 'missing votes counted as accepted');
  assert.ok(voting.scarabeo.scores[proposer] > 0, 'the word scored');
  assert.ok(
    toldVotes.length >= 1 &&
      toldVotes.every(t => t.outcome === 'accepted' && t.opponent === voting.players[proposer].name)
  );
  // Reminder and result requests for the queue.
  const r = reminderRequest(chess());
  assert.equal(r.kind, 'reminder');
  assert.equal(r.checkKey, turnKey(chess()));
  assert.equal(r.key, turnKey(chess()) + ':reminder');
  assert.equal(r.penalty, 'lose');
  assert.equal(reminderRequest(chess({ phase: 'finished' })), null);
  assert.equal(resultRequest(chess(), 'k', []), null);
  assert.equal(
    resultRequest(chess(), 'k', [{ player: 'tg:1', outcome: 'won', opponent: 'X' }]).kind,
    'result'
  );
  assert.equal(timeoutTable(chess({ phase: 'finished' })), null);
}
// Texts for reminder and results.
assert.match(
  noticeText({ game: 'chess', kind: 'reminder', opponent: 'Ada', penalty: 'lose' }),
  /^⏳ Promemoria: tocca a te contro Ada da 2 giorni\. Se non muovi entro 2 giorni la partita è persa a tavolino\./
);
assert.match(noticeText({ game: 'scarabeo', kind: 'reminder', penalty: 'skip' }), /salti il turno/);
assert.match(
  noticeText({ game: 'scarabeo', kind: 'reminder', vote: true, opponent: 'Ada', penalty: 'accept' }),
  /serve ancora il tuo voto su una parola di Ada.*viene accettata/
);
assert.match(
  noticeText({ game: 'chess', outcome: 'lost', opponent: 'Ada' }),
  /^⌛ Tempo scaduto: hai perso a tavolino contro Ada/
);
assert.match(
  noticeText({ game: 'chess', outcome: 'won', opponent: 'Bruno' }),
  /^🏆 Bruno non ha mosso in tempo/
);
// Queue: results are sent even though the turn moved on, and a later turn message does not replace them.
{
  const h = harness();
  h.due = false;
  await h.call('/notices/queue', {
    room: ROOM,
    key: 'x:timeout',
    kind: 'result',
    game: 'chess',
    number: 3,
    targets: [{ player: 'tg:222', outcome: 'lost', opponent: 'Ada' }]
  });
  await h.queue(chess({ moves: [{}, {}, { by: 'Ada' }] }));
  assert.equal([...h.data.keys()].filter(k => k.startsWith('queue:')).length, 2);
  await h.run(SEND_DELAY + 1000);
  assert.deepEqual(
    h.sent.map(m => m.payload.text.split('\n')[0]),
    ['⌛ Tempo scaduto: hai perso a tavolino contro Ada.']
  );
}

console.log('PASS Turn notices (time to move: loss, Scarabeo skip and votes, reminder and result messages):');
console.log(
  'PASS Turn notices: who must act (chess, checkers, Forza 4, Scarabeo votes), quiet hours winter/summer, one message per turn, presence, replaced turns, Settings switch, blocked bot and /start.'
);
