# Binottoland

Mini App Telegram del circolo: una Lobby condivisa con account verificati, presenti, chat e tavoli numerati. Checkmate! (scacchi) e Dama italiana sono disponibili nella stessa Lobby. Labyrinth aggiunge un’esplorazione individuale in prima persona.

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


## Labyrinth · cinque piani e arena (prova individuale)

Cinque labirinti procedurali collegati: giallo (illuminazione originale), verde, rosso, blu e nero. Luci, luce ambientale e nebbia diventano progressivamente più scure; gli ultimi piani hanno meno lampade. Nessun nemico o multiplayer in questa versione. La quinta uscita conduce a un cortile esterno con una vetrina e due reti elastiche.

Una tasca è visibile da subito. Le keycard giacciono sul pavimento con la banda del colore del piano, senza rotazione o bagliore. La raccolta richiede vicinanza e sguardo verso la carta; il passe-partout nero è ancora meno visibile e compare normalmente nel quinto piano. Una keycard apre la porta e viene consumata. Una porta aperta si attraversa con Usa; Chiudi porta la blocca e fa comparire una sola nuova keycard in un punto casuale raggiungibile. Il passe-partout non si consuma e permette di tornare ai piani precedenti; nella prova sblocca anche le uscite per accelerare il percorso. Le carte si possono lasciare a terra e riprendere; occupano uno slot.

Nell’arena, essendo soli, la vetrina non si apre automaticamente: il pulsante è **Apri vetrina**. Si può esplorare e rimbalzare sulle reti prima di aprire. La vetrina contiene uno zaino (porta gli slot totali a cinque) e una spada (occupa uno slot, non ancora utilizzabile). Raccolta unica e apertura sono persistenti. Le reti aumentano l’altezza del salto soltanto all’aperto; i confini restano chiusi.

### Prova rapida

Temporaneamente le nuove esplorazioni partono con un passe-partout. La guida indica il prossimo tratto del percorso effettivamente percorribile verso l’uscita, non una direzione attraverso i muri. Da Pausa → Comandi e impostazioni: guida disattivabile, kit iniziale disattivabile per la prossima nuova esplorazione, viaggio rapido verso ciascun piano o direttamente davanti alla vetrina dell’arena. Questi aiuti sono esplicitamente contrassegnati come prova, non premi o progressi verificati.

Comandi: WASD/frecce, mouse o trascinamento, E/Usa per interagire, Spazio/Salta, Shift/corsa, C/Chiudi porta, Q/Lascia a terra per la carta nello slot selezionato. Esc/Pausa include un pulsante Binottoland accessibile dentro il menu. Telefono in orizzontale con joystick e sguardo separati.

Settings di Binottoland e impostazioni del gioco condividono l’anteprima del personaggio dalle forme arrotondate: pelle rosa, maglietta e pantaloncini separati, dieci colori ciascuno. In questa prova non ci sono altri personaggi in scena. La selezione è locale al dispositivo; il modello visibile agli altri e la sincronizzazione arriveranno con il multiplayer.

Chat vocale nel menu di pausa: salvare il link Telegram alla chiamata del gruppo. Il collegamento è validato HTTPS/t.me e aperto dal contenitore tramite openTelegramLink; la Mini App non avvia chiamate, non gestisce il microfono e non rileva partecipanti vocali. Senza link mostra le indicazioni per entrare dalla chat del gruppo. Audio e voce insieme richiedono una prova sul vero client Telegram.

Motore WebGL senza librerie esterne, fallback Canvas, texture e suoni procedurali. Pausa e background sospendono il ciclo di rendering. I salvataggi v2 sono locali e separati per account Telegram: piani/porte/carte, inventario, vetrina, posizione e tempo; il vecchio progresso viene importato limitando il percorso a cinque piani. Nessuna modifica a segreti, Durable Object o autenticazione. L’iframe riceve soltanto l’identificativo dell’account, mai token o password.

Non ancora implementati: spedizioni nella Lobby, ingressi tardivi, attesa degli altri nell’arena, vetrine per partecipante, timer di disconnessione e caduta delle carte lato server. Queste regole appartengono al prossimo passo multiplayer.

Verifica: test dei labirinti/collisioni e dei cinque piani, unicità carte fra raccolta/apertura/chiusura/abbandono/salvataggio, guida percorribile, inventario e vetrina; prova del flusso DOM e verifica visiva/interazione nel browser con fallback Canvas. WebGL hardware e Telegram Android restano da verificare sul dispositivo.
