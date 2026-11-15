// Session log shown in Settings → Debug and attached to problem reports. Tokens and Telegram data are redacted.
export const events = [];
const $ = id => document.getElementById(id);
export function trace(level, message) {
  const safe = String(message)
    .replace(/\b\d{6,}:[A-Za-z0-9_-]{15,}\b/g, '[REDACTED]')
    .replace(/(tgWebAppData|initData|Authorization|token)[=:]\s*[^\s]+/gi, '$1=[REDACTED]')
    .slice(0, 400);
  events.push(new Date().toLocaleTimeString('it-IT') + ' [' + level + '] ' + safe);
  if (events.length > 160) events.splice(0, events.length - 160);
  const output = $('terminal');
  if (output) {
    const bottom = output.scrollHeight - output.scrollTop - output.clientHeight < 35;
    output.textContent = events.join('\n');
    if (bottom) output.scrollTop = output.scrollHeight;
  }
}
// Debug page buttons and global error capture.
export function initDebugLog() {
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
  window.addEventListener('error', event => trace('ERROR', event.message || 'Errore JavaScript'));
  window.addEventListener('unhandledrejection', event =>
    trace('ERROR', event.reason?.message || 'Operazione non completata')
  );
}
