# Binottoland

Mini App Telegram del circolo: una Lobby condivisa con account verificati, presenti, chat e tavoli numerati. Checkmate! è il primo gioco disponibile; Dama e Backgammon sono indicati come futuri giochi.

## Configurazione privata

Nel Worker Cloudflare di produzione aggiungere due secret, mai nel repository:

- `BOT_TOKEN`: token del bot Telegram.
- `ACCESS_PASSWORD`: password condivisa del circolo, scelta dal proprietario.

L'accesso richiede sia i dati Telegram firmati sia la password. In assenza di ACCESS_PASSWORD il servizio rifiuta l'accesso. Cinque tentativi errati per account bloccano nuovi tentativi per 15 minuti. Le sessioni durano 12 ore e una modifica della password invalida le sessioni precedenti. La password non è salvata dal client né nel database; le sessioni del browser restano in memoria.

Questo è un accesso con password condivisa: non è un controllo dell'appartenenza a un gruppo Telegram. I permessi di archiviazione e cancellazione restano ai partecipanti delle rispettive partite.

## Avvio e pubblicazione

La configurazione Wrangler mantiene il nome del Worker e i binding già esistenti. Il ramo main è destinato alla pubblicazione Cloudflare con `npx wrangler deploy`. L'URL HTTPS del Worker va configurato come Main Mini App del bot in BotFather.

Per registrare webhook e comandi del bot è disponibile la pagina `/telegram-setup.html`, protetta dal token del bot inserito dal proprietario. Il token va inserito solo nella pagina HTTPS del proprio Worker, mai in chat o nel codice.

## Interfaccia

- Lobby: tavoli, presenti e ultimi 100 messaggi della chat comune.
- Giochi: selezione del gioco per aprire un tavolo; attualmente è disponibile Checkmate!.
- Settings: palette indipendenti per interfaccia, scacchiera e pezzi. Il pulsante Debug apre stato, archivio, replay e registro diagnostico.
- Radio: controllo compatto con stazioni, preferiti e volume personali. L'audio resta nello stesso documento durante la navigazione; gli stream sono caricati direttamente dal dispositivo. La selezione radio viene caricata su richiesta da Radio Browser, con host alternativi, riprendendo il funzionamento del progetto DABradio.

## Stato e conservazione

Worker e Durable Objects serializzano le azioni e salvano prima di rispondere. Gli scacchi sono validati sul server con chess.js. WebSocket autenticati aggiornano partite, presenze e chat.

Le partite di prova non archiviate scadono dopo sette giorni. Quelle archiviate rimangono fino all'eliminazione da parte di un partecipante. Quando non rimane nessun tavolo, compresi quelli archiviati, la numerazione riparte da 1; gli identificatori interni restano univoci. Le vecchie credenziali del browser consentono di collegare il proprio precedente posto all'account Telegram verificato.

## Progetti distinti

Binottoland è il circolo. DABradio e binottoland_hub rimangono progetti separati; il secondo mantiene il ruolo di Hub pubblico con TV, radio e giochi single player.

## Verifica

Controlli locali eseguiti con API Durable Object e DOM simulati: identità firmata, autorizzazioni, partite, patta, archivio/replay, presenza/chat, accesso con password e navigazione/radio. La verifica degli stream e della resa audio nel client Telegram richiede dispositivi reali.
