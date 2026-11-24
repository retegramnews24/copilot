// Grandezza delle richieste (api.js): una richiesta troppo grande si ferma anche senza Content-Length, mandata a
// pezzi; quelle normali passano intatte fino al percorso.
import assert from 'node:assert/strict';
import { handleRequest, readLimited, BODY_LIMIT } from '../api.js';

// a pezzi, senza Content-Length: prima la si leggeva tutta in memoria
const chunked = size => {
  let sent = 0;
  return new ReadableStream({
    pull(c) {
      if (sent >= size) return c.close();
      const n = Math.min(65536, size - sent);
      sent += n;
      c.enqueue(new Uint8Array(n).fill(65));
    }
  });
};
const big = new Request('https://x.test/api/chat', {
  method: 'POST',
  body: chunked(BODY_LIMIT * 5),
  duplex: 'half'
});
assert.equal(big.headers.get('Content-Length'), null);
const res = await handleRequest(big, {});
assert.equal(res.status, 413, 'troppo grande anche senza Content-Length');

// dichiarata troppo grande: rifiutata subito, senza leggerla
const declared = new Request('https://x.test/api/chat', {
  method: 'POST',
  body: 'x',
  headers: { 'Content-Length': String(BODY_LIMIT + 1) }
});
assert.equal((await handleRequest(declared, {})).status, 413);

// normale: arriva intatta
const small = await readLimited(new Request('https://x.test/', { method: 'POST', body: '{"text":"ciao"}' }));
assert.equal(new TextDecoder().decode(small), '{"text":"ciao"}');
console.log(
  'PASS richieste: troppo grandi fermate anche a pezzi e senza Content-Length, quelle normali intatte.'
);
