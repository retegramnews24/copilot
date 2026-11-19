// Staging (test environment): a blank page. No backend, no games: only the static files in public/.
// Room stays as an empty Durable Object class because the staging Worker already has it bound.
import { DurableObject } from 'cloudflare:workers';

export class Room extends DurableObject {
  async fetch() {
    return new Response('Non attivo nella prova.', { status: 404 });
  }
}

export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};