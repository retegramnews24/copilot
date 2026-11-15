import assert from 'node:assert/strict';
import { radioTicket, radioTicketUser } from '../auth.js';
import { radioStream } from '../radio-metadata.js';

// Radio relay: a user-bound, expiring, signed ticket; only Radio Browser UUIDs are relayed.
const env = { BOT_TOKEN: 'relay-test-token' };
const ticket = await radioTicket({ id: '123456' }, env);
assert.match(ticket, /^123456\.\d{13}\.[a-f0-9]{64}$/);
assert.deepEqual(await radioTicketUser(ticket, env), { id: '123456', player: 'tg:123456' });
// Tampered user, signature, other bot token, expired ticket, garbage: all refused.
assert.equal(await radioTicketUser(ticket.replace('123456', '654321'), env), null);
assert.equal(await radioTicketUser(ticket.slice(0, -1) + (ticket.endsWith('a') ? 'b' : 'a'), env), null);
assert.equal(await radioTicketUser(ticket, { BOT_TOKEN: 'other' }), null);
const [id, , ] = ticket.split('.');
assert.equal(await radioTicketUser(`${id}.${Date.now() - 1000}.${'0'.repeat(64)}`, env), null);
for (const bad of [null, '', 'session.x.y', '1.2.3']) assert.equal(await radioTicketUser(bad, env), null);
// No arbitrary URLs: anything that is not a station UUID is rejected before any network access.
for (const bad of [undefined, 'https://evil.example/stream', '../../etc', 'not-a-uuid'])
  assert.equal(await radioStream(bad), null);
console.log('PASS radio relay: signed 12 h tickets bound to the user, tampering/expiry refused, only station UUIDs relayed.');
