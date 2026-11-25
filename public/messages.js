// Messaggi d'errore usati in più posti (server e app): scritti una volta sola qui, così le frasi uguali restano
// uguali. Il server li prende da ./public/messages.js, l'app da ./messages.js. I messaggi di un solo gioco restano
// nel suo file. Ogni frase dice il motivo e, quando serve, cosa fare.
export const REOPEN = 'Chiudi e riapri Binottoland dal bot.';
const reopen = 'chiudi e riapri Binottoland dal bot.'; // a metà frase
export const MSG = {
  // accesso e sessione
  login: 'Accesso richiesto: ' + reopen,
  badAccess: 'Accesso Telegram non valido o scaduto. ' + REOPEN,
  expired: 'Sessione scaduta: ' + reopen,
  openFromTelegram: 'Apri Binottoland da Telegram per accedere.',
  // richieste che il server non capisce: di solito un'app vecchia rimasta aperta
  unreadable: 'Il server non ha capito la richiesta. ' + REOPEN,
  unknownAction: 'Azione sconosciuta per questa versione: ' + reopen,
  notFound: 'Indirizzo sconosciuto: ' + reopen,
  live: 'Serve un collegamento in diretta: ' + reopen,
  method: 'Richiesta del tipo sbagliato per questo indirizzo: ' + reopen,
  tooBig: 'Richiesta troppo grande.',
  // motivo di chiusura di un collegamento (corto: al massimo 123 byte)
  closeReopen: 'Riapri Binottoland',
  // partite
  notYourTurn: 'Non tocca a te.',
  notActive: 'Partita non attiva.',
  badMove: 'Mossa non valida.',
  noGame: 'Gioco non disponibile.',
  tableGone: 'Tavolo inesistente o scaduto.'
};
