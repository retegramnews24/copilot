// Session log shown in Settings → Debug and attached to problem reports. Tokens and Telegram data are redacted.
export const events = [];
const $ = id => document.getElementById(id);
export const redact = message =>
  String(message)
    .replace(/\b\d{6,}:[A-Za-z0-9_-]{15,}\b/g, '[REDACTED]')
    .replace(/(tgWebAppData|initData|Authorization|token)[=:]\s*[^\s]+/gi, '$1=[REDACTED]')
    .replace(/session\.[A-Za-z0-9_-]+\.[a-f0-9]{64}/g, '[REDACTED]');
export function trace(level, message) {
  const safe = redact(message).slice(0, 400);
  events.push(new Date().toLocaleTimeString('it-IT') + ' [' + level + '] ' + safe);
  if (events.length > 160) events.splice(0, events.length - 160);
  const output = $('terminal');
  if (output) {
    const bottom = output.scrollHeight - output.scrollTop - output.clientHeight < 35;
    output.textContent = events.join('\n');
    if (bottom) output.scrollTop = output.scrollHeight;
  }
}
// Unexpected errors also go to the server logs (report): each different message once, at most 10 per session.
export function errorReporter(report) {
  const sent = new Set();
  return error => {
    const message = redact(error.message || 'Errore JavaScript').slice(0, 400);
    if (sent.has(message) || sent.size >= 10) return;
    sent.add(message);
    try {
      report({ ...error, message, source: redact(error.source || '').slice(0, 200) });
    } catch {}
  };
}
// Debug page buttons and global error capture. report(error) sends it to the server (optional).
export function initDebugLog({ report } = {}) {
  const send = report ? errorReporter(report) : () => {};
  $('clear-terminal').onclick = () => {
    events.length = 0;
    $('terminal').textContent = '';
    trace('INFO', 'Registro pulito');
  };
  $('copy-terminal').onclick = async () => {
    try {
      await navigator.clipboard.writeText(events.join('\n'));
      $('debug-result').textContent = 'Log copiato.';
    } catch {
      $('debug-result').textContent = 'Copia non disponibile: puoi selezionare il testo del registro.';
    }
  };
  window.addEventListener('error', event => {
    trace('ERROR', event.message || 'Errore JavaScript');
    send({ message: event.message, source: event.filename, line: event.lineno });
  });
  // errori dei giochi nei riquadri (public/frame-errors.js): stesso registro e stessi log
  window.addEventListener('message', event => {
    const d = event.data;
    if (event.origin !== location.origin || d?.type !== 'binottoland:frame-error') return;
    const page = String(d.page || '').slice(0, 80);
    trace('ERROR', page + ' · ' + d.message);
    send({ message: '[' + page + '] ' + d.message, source: d.source });
  });
  window.addEventListener('unhandledrejection', event => {
    trace('ERROR', event.reason?.message || 'Operazione non completata');
    // Rejected network calls are already shown to the player; report only real code errors.
    if (event.reason instanceof Error && !(event.reason.name === 'AbortError' || event.reason.status))
      send({ message: event.reason.message, source: String(event.reason.stack || '').split('\n')[1] || '' });
  });
}
