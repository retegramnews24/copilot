// Small helpers shared by the Worker entry, the Room Durable Object and the route modules.
export const BOT_USERNAME = 'checkmategame_bot';
export const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
export const id = () => crypto.randomUUID();
export const bad = message => {
  throw new Error(message);
};
export const name = x => {
  if (typeof x !== 'string' || !x.trim()) bad('Inserisci un nome.');
  return x.trim().slice(0, 30);
};
// Singleton Durable Objects (all of class Room, addressed by name).
// Long-turn games: one queue of private bot messages ("tocca a te"), see turn-notices.js.
export const noticeHub = env => env.ROOMS.get(env.ROOMS.idFromName('turn-notices-v1'));
export const lobbyHub = env => env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));
