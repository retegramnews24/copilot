// Errori di un gioco aperto in un riquadro (Biliardo, F1, Golf, Moto Trial, Pong, Acquedotto…): si mandano alla pagina
// principale, che li scrive nel registro di Debug e li manda ai log del server come gli altri. Prima restavano dentro
// il riquadro e non li vedeva nessuno. Script normale (non modulo), così parte prima del gioco e prende anche i suoi
// errori di caricamento.
(() => {
  if (window.parent === window) return;
  const sent = new Set();
  const post = (message, source) => {
    const text = String(message || 'Errore JavaScript').slice(0, 300);
    if (sent.has(text) || sent.size >= 10) return;
    sent.add(text);
    try {
      window.parent.postMessage(
        { type: 'binottoland:frame-error', message: text, source: String(source || '').slice(0, 200), page: location.pathname },
        location.origin
      );
    } catch {}
  };
  addEventListener('error', e => post(e.message, (e.filename || '') + ':' + (e.lineno || 0)));
  addEventListener('unhandledrejection', e => {
    const r = e.reason;
    if (r instanceof Error && r.name !== 'AbortError') post(r.message, String(r.stack || '').split('\n')[1] || '');
  });
})();
