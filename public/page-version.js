// Versione da mettere negli indirizzi delle pagine dei giochi (?v=1.0.66): cambia a ogni rilascio, così la WebView di
// Telegram non riusa la pagina vecchia rimasta in memoria. Prima alcune avevano un numero scritto a mano (?v=2) e
// Ruggine 89 nessuno: dopo un aggiornamento si poteva giocare ancora la versione di prima.
// La legge dal numero di versione della pagina (index.html, #app-version), che `npm run release` aggiorna.
export function pageVersion() {
  const text = globalThis.document?.getElementById?.('app-version')?.textContent || '';
  return text.match(/\d+\.\d+\.\d+/)?.[0] || 'dev';
}
// indirizzo della pagina con ?v=versione (e gli altri parametri dati)
export function pageUrl(path, params = {}) {
  const query = new URLSearchParams({ v: pageVersion(), ...params });
  return path + '?' + query.toString();
}
