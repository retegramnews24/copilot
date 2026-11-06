# Binottoland

Mini App Telegram del circolo: una Lobby condivisa con account verificati, presenti, chat e tavoli numerati. Checkmate! (scacchi) e Dama italiana sono disponibili nella stessa Lobby. Backgammon è previsto come prossimo gioco.

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
- Giochi: selezione del gioco per aprire un tavolo; sono disponibili Checkmate! e Dama italiana.
- Settings: palette indipendenti per interfaccia, scacchiera e pezzi. Il pulsante Debug apre stato, archivio, replay e registro diagnostico.
- Radio: controllo compatto con stazioni, preferiti e volume personali. L'audio resta nello stesso documento durante la navigazione; gli stream sono caricati direttamente dal dispositivo. La selezione radio viene caricata su richiesta da Radio Browser, con host alternativi, riprendendo il funzionamento del progetto DABradio.

## Stato e conservazione

Worker e Durable Objects serializzano le azioni e salvano prima di rispondere. Gli scacchi sono validati sul server con chess.js; la dama italiana usa il motore indipendente checkers.js. WebSocket autenticati aggiornano partite, presenze e chat.

Le partite di prova non archiviate scadono dopo sette giorni. Quelle archiviate rimangono fino all'eliminazione da parte di un partecipante. Quando non rimane nessun tavolo, compresi quelli archiviati, la numerazione riparte da 1; gli identificatori interni restano univoci. Le vecchie credenziali del browser consentono di collegare il proprio precedente posto all'account Telegram verificato.

## Progetti distinti

Binottoland è il circolo. DABradio e binottoland_hub rimangono progetti separati; il secondo mantiene il ruolo di Hub pubblico con TV, radio e giochi single player.

## Verifica

Controlli locali eseguiti con API Durable Object e DOM simulati: identità firmata, autorizzazioni, partite, patta, archivio/replay, presenza/chat, accesso con password e navigazione/radio. La verifica degli stream e della resa audio nel client Telegram richiede dispositivi reali.

## Dama italiana

12 pedine per parte, Bianco per primo, damiera con cantone scuro in basso a destra e caselle numerate 1–32. Pedine solo in avanti, dame corte in entrambe le direzioni; le pedine non catturano dame. Prese obbligatorie con precedenze: quantità, valore del pezzo prendente, numero di dame catturate, ordine dei pezzi catturati. La promozione termina il turno. Riferimento per movimenti e prese: [regolamento FID, articoli 2–6](https://www.fid.it/regolamenti/capo1.htm).

Adattamenti per il circolo: nessun orologio o regola del pezzo toccato; selezione annullabile fino all'invio dell'intera mossa. Una presa multipla si compone toccando ogni salto e viene validata e pubblicata come singola mossa completa. La parità scatta automaticamente alla terza posizione identica con identico turno o dopo 80 semimosse di sole dame senza prese, con almeno una dama per parte. La patta concordata resta disponibile. Vittoria automatica quando l'avversario non ha più pezzi o mosse.

La stessa identità non può aprire o raggiungere un secondo tavolo attivo, anche scegliendo un gioco diverso. Le vecchie partite senza campo game vengono trattate come scacchi. Nessuna nuova migrazione Durable Object richiesta.

`npm test` esegue i test del motore: precedenze, catture multiple, promozioni, vittoria, patte e 30 partite deterministiche.

## Radio: catalogo e brano in onda

Il catalogo richiede fino a 200 risultati italiani e conserva gli URL HTTPS utilizzabili. I preferiti restano personali. Il brano viene mostrato come testo scorrevole sotto i controlli, solo quando disponibile. Le emittenti che non trasmettono metadati ICY, o li offrono solo con API proprie, non mostrano titolo e artista.

L'audio rimane diretto tra dispositivo e stazione. L'endpoint autenticato `/api/radio/now-playing?station=UUID` risolve la stazione attraverso Radio Browser e legge solo un breve campione ICY: massimo 10 secondi, 256 KiB e quattro blocchi. Non accetta URL arbitrari dal client; verifica gli indirizzi e i redirect. I risultati hanno una cache breve per isolate e le richieste simultanee alla stessa stazione condividono il probe. Il client aggiorna ogni minuto durante l'ascolto con app visibile; pausa e cambio stazione invalidano le risposte precedenti.

Il pulsante per creare tavoli è nella pagina Giochi. La Lobby conserva elenco, presenti e chat.


## Labyrinth · prima versione

Esplorazione individuale in prima persona, avviabile dalla pagina Giochi. Un piano procedurale, una chiave da raccogliere e una porta che conduce al piano successivo. Ogni piano ha un percorso verificato fra ingresso, chiave e uscita. I livelli cambiano mantenendo seed e progressione; non ci sono ancora nemici o cooperativa.

Motore WebGL senza librerie esterne, con renderer Canvas di riserva quando WebGL non è disponibile. Texture e suoni sono generati localmente: carta da parati, moquette, soffitti, lampade, ronzio e passi. Il rendering si ferma in pausa e quando l’app passa in secondo piano.

Comandi PC: WASD/frecce, mouse (o trascinamento se il blocco del puntatore è negato), E per interagire, Spazio per saltare, Shift per accelerare, Esc per la pausa. Telefono in orizzontale: joystick sinistro, sguardo a destra, tasti Salta e Usa. Sensibilità, dettaglio e audio sono regolabili.

I progressi restano nel localStorage del dispositivo, separati per account Telegram quando aperto da Binottoland. Non sono una classifica verificata dal server. La modalità individuale non crea tavoli multiplayer e non usa il motore a turni. L’iframe riceve solo l’identificativo dell’account, senza token o password, e viene scaricato alla chiusura per liberare audio e grafica.

Verifica automatica: 500 mondi deterministici con percorsi fisicamente percorribili, raccolta chiave/porta, collisioni, confini e ripristino dei salvataggi. Verifica visiva nel browser in modalità Canvas; WebGL hardware e comandi sul vero client Telegram Android restano da provare sul dispositivo.
