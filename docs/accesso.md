# Accesso, sessioni e pubblicazione

[← Binottoland](../README.md)

Il codice di questi controlli è in `auth.js`.

## Configurazione privata

Configura il secret `BOT_TOKEN` del bot Telegram nel Worker Cloudflare di produzione. Il server verifica i dati firmati da Telegram e crea una sessione di 12 ore, conservata in memoria dal client. Sono ammessi solo i membri del gruppo Telegram configurato (default -1001803941686), verificati al login, al rinnovo e sulle API, con cache massima 60 secondi. Le nuove autenticazioni accettano initData di massimo 5 minuti; le sessioni valide si rinnovano tramite /api/session/refresh. I permessi di archiviazione e cancellazione restano ai partecipanti delle rispettive partite.

## Avvio e pubblicazione

La configurazione Wrangler mantiene il nome del Worker e i binding già esistenti. Il ramo main è destinato alla pubblicazione Cloudflare con `npx wrangler deploy`. L'URL HTTPS del Worker va configurato come Main Mini App del bot in BotFather.

La pagina pubblica di inserimento del token è stata rimossa. La route di configurazione è disattivata per default; solo una riattivazione esplicita con SETUP_ENABLED=true consente il setup autenticato. Il webhook verifica sempre il proprio secret token.

## Stato e conservazione

Worker e Durable Objects serializzano le azioni e salvano prima di rispondere. Gli scacchi sono validati sul server con chess.js; la dama italiana usa il motore indipendente checkers.js. WebSocket autenticati aggiornano partite, presenze e chat.

Le partite di prova non archiviate scadono dopo sette giorni. Quelle archiviate rimangono fino all'eliminazione da parte di un partecipante. Ogni nuovo tavolo riceve il numero libero più basso a partire da 1. I tavoli archiviati liberano il numero e gli identificatori interni restano univoci. Le vecchie credenziali del browser consentono di collegare il proprio precedente posto all'account Telegram verificato.
