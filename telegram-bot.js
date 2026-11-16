// Telegram bot: webhook setup (/api/telegram/setup) and incoming messages (/api/telegram/webhook):
// /start and /gioca, media sent to the Cinema, and turning on the "tocca a te" messages.
import { secureEqual, requireMember } from './auth.js';
import { cinemaSubmission } from './cinema-telegram.js';
import { receiveCinemaSubmission } from './cinema-routes.js';
import { json, BOT_USERNAME, noticeHub } from './worker-shared.js';
async function webhookSecret(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function telegramCall(token, method, payload) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);
  return {
    ok: response.ok && result?.ok === true,
    description: result?.description || 'Telegram non ha confermato la richiesta.'
  };
}
export async function setupTelegram(req, env, u) {
  if (env.SETUP_ENABLED !== 'true') return json({ error: 'Configurazione disattivata.' }, 404);
  if (!env.BOT_TOKEN) return json({ error: 'Secret BOT_TOKEN non configurato.' }, 503);
  if (Number(req.headers.get('Content-Length') || 0) > 4096)
    return json({ error: 'Richiesta troppo grande.' }, 413);
  try {
    const body = await req.json();
    if (typeof body.token !== 'string' || !secureEqual(body.token, env.BOT_TOKEN))
      return json({ error: 'Token non valido.' }, 403);
    const secret = await webhookSecret(env.BOT_TOKEN);
    const hook = await telegramCall(env.BOT_TOKEN, 'setWebhook', {
      url: u.origin + '/api/telegram/webhook',
      secret_token: secret,
      allowed_updates: ['message']
    });
    if (!hook.ok) return json({ error: 'Telegram non ha attivato il webhook: ' + hook.description }, 502);
    const commands = await telegramCall(env.BOT_TOKEN, 'setMyCommands', {
      commands: [
        { command: 'start', description: 'Avvia Binottoland' },
        { command: 'gioca', description: 'Apri una sfida Binottoland' }
      ]
    });
    if (!commands.ok)
      return json({
        ok: true,
        webhook: true,
        warning: 'Webhook attivo; comando non registrato: ' + commands.description
      });
    return json({ ok: true, webhook: true, command: true });
  } catch {
    return json({ error: 'Richiesta di configurazione non valida.' }, 400);
  }
}
export async function telegramWebhook(req, env) {
  if (!env.BOT_TOKEN) return json({ error: 'BOT_TOKEN non configurato.' }, 503);
  const supplied = req.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!secureEqual(supplied, await webhookSecret(env.BOT_TOKEN)))
    return json({ error: 'Richiesta Telegram non autorizzata.' }, 403);
  if (Number(req.headers.get('Content-Length') || 0) > 32768) return json({ ok: true });
  try {
    const update = await req.json();
    const message = update?.message;
    const submission = cinemaSubmission(message);
    if (submission) {
      const denied = await requireMember({ id: String(submission.user) }, env);
      if (denied) return json({ ok: true });
      return receiveCinemaSubmission(env, new URL(req.url).origin, submission);
    }
    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    if (!message || message.from?.is_bot || !text) return json({ ok: true });
    const match = text.match(/^\/(?:gioca|start)(?:@([A-Za-z0-9_]+))?(?:\s|$)/i);
    if (!match || (match[1] && match[1].toLowerCase() !== BOT_USERNAME)) return json({ ok: true });
    // In the bot's private chat, /start also turns on the "tocca a te" messages (members of the group only).
    let alerts = false;
    if (
      message.chat?.type === 'private' &&
      Number.isSafeInteger(message.from?.id) &&
      !(await requireMember({ id: String(message.from.id) }, env))
    ) {
      await noticeHub(env).fetch(
        new Request('https://internal/notices/start', {
          method: 'POST',
          body: JSON.stringify({ userId: String(message.from.id) })
        })
      );
      alerts = true;
    }
    const sent = await telegramCall(env.BOT_TOKEN, 'sendMessage', {
      chat_id: message.chat.id,
      text:
        'Benvenuto nel circolo Binottoland. Lobby, amici e tavoli da gioco.' +
        (alerts
          ? '\n\n🔔 Avvisi attivi: ti scrivo qui quando tocca a te in una partita a Scacchi, Dama, Forza 4 o Scarabeo (mai tra le 23 e le 8). Puoi spegnerli nelle Impostazioni di Binottoland.'
          : ''),
      reply_markup: {
        inline_keyboard: [[{ text: 'Apri Binottoland', url: 'https://t.me/' + BOT_USERNAME + '?startapp' }]]
      }
    });
    if (!sent.ok) return json({ error: 'Invio del pulsante non riuscito.' }, 502);
    return json({ ok: true });
  } catch {
    return json({ ok: true });
  }
}
