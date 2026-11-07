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


## Labyrinth · spedizioni multiplayer

Dalla pagina Giochi si crea una spedizione numerata; nella Lobby gli altri possono entrare o assistere. Il creatore è il primo partecipante, ma non ospita la partita: ogni spedizione vive in un Durable Object distinto, tramite il binding ROOMS già configurato. Non servono nuove migrazioni, binding o segreti. Le spedizioni vuote non scadono e rimangono nella Lobby fino all’archiviazione o eliminazione da parte di un partecipante. La numerazione non riparte cancellando l’ultimo tavolo.

Fino a 16 partecipanti per spedizione e 40 connessioni complessive includendo spettatori. Ingresso tardivo dal primo piano. Quando qualcuno arriva nell’arena con un gruppo di più persone, si chiudono i nuovi ingressi; chi è già partecipante può riconnettersi. Se si arriva da soli, invece, gli ingressi restano aperti finché si sceglie **Apri vetrina**. Un nuovo ingresso durante questa attesa aggiunge la propria vetrina accanto alle altre ed elimina la possibilità di aprire da soli. L’apertura di gruppo attende tutti i partecipanti attivi; chi è ancora nel periodo di riconnessione resta nel conteggio. Gli spettatori non contano.

### Regole condivise e persistenza

Cinque labirinti deterministici con lo stesso seed per tutti: giallo, verde, rosso, blu e nero progressivamente più scuri. Ogni giocatore cambia piano indipendentemente. Una sola keycard di uscita per piano chiuso, a terra o nell’inventario di una persona. Le carte dei cinque piani vengono inizializzate dal server alla creazione; al caricamento delle partite salvate si ripristinano gli spawn mancanti o fuori dal pavimento, senza duplicare carte già in inventario. Le carte a terra sono leggermente più grandi; se la carta del piano è già in mano a un compagno, l’obiettivo ne mostra il nome. Raccolta, consumo all’apertura e respawn alla richiusura sono serializzati dal server. Porte aperte attraversabili da tutti, chiusura esplicita e carta nuova in una posizione raggiungibile. Il passe-partout nero giace nel quinto piano, occupa uno slot, non si consuma e serve per tornare ai piani precedenti.

Disconnessione: 60 secondi per rientrare; allo scadere le carte cadono sull’ultimo piano e nella posizione valida del giocatore, che viene tolto dal conteggio dell’arena. La perdita silenziosa di rete viene rilevata dopo 45 secondi senza heartbeat, quindi parte lo stesso periodo. Una vecchia connessione non può scollegare o muovere quella più recente dello stesso account. Equipaggiamento e progressi individuali si ritrovano rientrando; le carte già cadute non vengono duplicate. Se sparisce il creatore, gli altri continuano. Se spariscono tutti, lo stato rimane salvato.

Porte, carte, inventari e cambi di piano vengono salvati subito. Le posizioni vengono consolidate fino a ogni cinque secondi durante il movimento; un’interruzione improvvisa del runtime può arretrare la sola posizione fino all’ultimo consolidamento. Connessioni WebSocket con hibernation e allarmi Durable Object gestiscono i timer anche senza client collegati.

### Arena, personaggi e comandi

Arena ovale con una rete elastica da 18,5 × 5,8 metri, panchine, fioriere e lampioni. Una vetrina personale per partecipante attivo, con assegnazione stabile. Apertura simultanea e definitiva quando arriva l’ultimo del gruppo; in singolo apertura manuale solo da vicino con E/Usa. Ogni persona prende il proprio zaino (cinque slot totali) e la propria spada. Non è possibile svuotare la vetrina di un altro. Se una nuova vetrina compare dove c’è qualcuno, il server lo riposiziona in un punto libero.

Gli altri personaggi sono visibili solo nel proprio piano, con forme morbide, pelle rosa, maglietta e pantaloncini selezionabili in dieci colori distinti; zaino e spada riflettono l’equipaggiamento. Posizioni e rotazioni vengono interpolate. Nomi mostrati solo da vicino, nascosti dietro i muri. Colpo di spada animato e condiviso, con breve recupero; non ci sono ancora nemici, danni o PvP.

PC: WASD/frecce, mouse o trascinamento, E per usare, F/clic sinistro per il colpo, Spazio per saltare, Shift per correre, C per richiudere, Q per lasciare la carta selezionata, Esc per la pausa. Telefono in orizzontale: joystick sinistro movimento, joystick destro visuale; Azione/Colpisci diventa Usa vicino a un oggetto, Salta fra i due comandi di destra. Il menu di pausa permette il ritorno a Binottoland. I collegamenti e le impostazioni della chat vocale sono rimossi; le chiamate si gestiscono esternamente.

Gli spettatori possono seguire la visuale di un partecipante oppure scegliere un piano ed esplorare liberamente, senza raccogliere o cambiare nulla. Il selettore rapido dei piani è disattivato per i partecipanti delle spedizioni condivise. La precedente prova individuale resta separata nei salvataggi locali e non viene importata come progresso verificato.

### Schermo intero e sicurezza

Su PC l’altezza segue il viewport effettivo, anche se Telegram conserva un viewportStableHeight precedente. Ingresso e uscita dal fullscreen nativo aggiornano il layout; coordinate CSS e risoluzione del buffer grafico rimangono separate. Lobby centrata con larghezza massima di 760 px; scena a pieno viewport e intestazione desktop con colonne laterali uguali. Verificati nel browser viewport CSS 3840 × 2160 e 1920 × 1080, quest’ultimo equivalente alle dimensioni CSS di un monitor 4K con scala 200%; resta da verificare il client Telegram sul dispositivo reale.

All’accesso viene richiesto il fullscreen di Telegram dove supportato. safeAreaInset del dispositivo e contentSafeAreaInset di Telegram riservano le rispettive aree in pixel CSS; le variabili vengono ricalcolate su rotazione, resize, cambi delle safe area e fullscreen. Il gioco riceve gli stessi margini dal contenitore. La scena può estendersi sotto le barre, mentre HUD, menu, inventario, joystick e pulsanti rimangono nell’area utilizzabile. Collaudo visivo con una zona Android di 26 px e Telegram di 58 px sopra, più 24 px sotto; questi sono valori di prova, non misure fisse imposte ai telefoni.

Il contenitore mantiene il token di sessione e apre HTTP/WebSocket autenticati: nessuna credenziale viene inviata nell’iframe. Origine e finestra mittente vengono controllate in entrambe le direzioni. Il server ricava il giocatore dall’identità verificata e valida distanze, collisioni, carte, vetrine personali, colori e frequenza dei messaggi; lo spettatore è in sola lettura. Le carte e l’apertura delle vetrine non dipendono dalla fiducia nel client. La Mini App non richiede accesso al microfono.

### Grafica procedurale e prestazioni

Testa con normali morbide, capelli, orecchie e lineamenti; colletto, risvolti, calze e scarpe. Geometrie condivise per tutti i personaggi, dettagli minuti visibili solo da vicino e ombre di contatto leggere. Il renderer Canvas usa versioni direzionali disegnate via codice, con cache LRU di 24 personaggi.

Carta da parati, trama del pavimento, mattoni e lastre sono generati in RGBA da un Worker dedicato al caricamento del piano, quindi riutilizzati. Anteprima immediata di 64 × 64 pixel; materiali finali di 256 × 256. Cache LRU di tre piani, pari a 2,25 MiB per le sole mappe RGBA, esclusi copie GPU, mipmap e altri asset. In assenza di Worker è previsto un fallback asincrono sul thread principale. Non richiede OffscreenCanvas. Cielo, nuvole, vetrine e decorazioni sono disegnati con codice e conservati in cache.

In WebGL i materiali passano alla GPU e gli otto punti luce più vicini vengono aggiornati a intervalli, evitando ordinamenti a ogni fotogramma. Inventario e nomi riutilizzano i nodi DOM. La qualità automatica può ridurre la risoluzione interna fino al 65% dopo un carico sostenuto e recuperarla gradualmente quando il carico scende; le qualità manuali restano fisse. Nessuna promessa di FPS universale: il risultato dipende da telefono, temperatura e WebView. Non vengono creati più Worker del necessario né ridisegnate le texture a ogni fotogramma.

### Verifica

`npm test`: motori esistenti, labirinti, rendering, quattro partecipanti simulati, carte/porte, timer, arrivi e vetrine, persistenza del modello e safe area. `npm run test:multiplayer-runtime`: build di prova Wrangler e test workerd con quattro veri WebSocket più uno spettatore, autenticazione, correzioni del movimento, autorizzazioni, archiviazione/eliminazione e riavvio con stato SQLite conservato. La build di questo test resta in `.test-bundle/` e non va pubblicata come asset.

Controllati inoltre cinque DOM client e il bridge della Lobby, e verificato nel browser il layout con barre simulate e renderer Canvas. WebGL hardware e l’uso simultaneo su veri telefoni Telegram Android richiedono ancora il collaudo sui dispositivi.

## Forza 4

Tavolo condiviso per due account Telegram con spettatori nella stessa Lobby. Griglia 7 × 6, Rosso per primo e Giallo per secondo; scegliendo una colonna la pedina scende nell’ultimo posto libero. Il server valida identità, turno, revisione e colonne, riconosce quattro in fila orizzontali, verticali o diagonali e la patta a griglia piena. Nomi degli spettatori in diretta, proposta di patta, chiusura, archiviazione/eliminazione dei partecipanti e player di revisione nell’archivio. Layout limitato sia dalla larghezza sia dall’altezza disponibile.

Verifiche: 600 partite complete con controllo indipendente delle linee e della gravità; test workerd con creazione, occupazione dei due posti, spettatore in sola lettura, mosse fuori turno/colonne non valide, vittoria, replay e archivio. Collaudo visivo a 390 e 760 pixel CSS di larghezza.

## UNO · da 2 a 8 giocatori

Tavolo aperto fino all’avvio manuale del creatore, con almeno due persone e un massimo di otto. Dopo l’avvio i nuovi ingressi sono spettatori. Sette carte a testa, mazzo classico da 108 carte rimescolato sul server, colore/numero/simbolo, Stop, Inverti, +2, jolly e +4; Inverti a due funziona come Stop. Si può pescare una carta e giocare solo quella se consentita, oppure passare. I +2/+4 non si sommano; il server vieta il +4 quando si possiede il colore attivo. Versione del circolo a manche singola, con UNO automatico e senza bluff/contestazione: le differenze sono mostrate nelle regole del tavolo. Riferimento per le carte e il gioco a due: https://service.mattel.com/instruction_sheets/J3723-0824.pdf .

Le mani e l’ordine del mazzo rimangono nello stato del Durable Object. Risposte HTTP e messaggi WebSocket vengono proiettati per identità verificata: ciascuno riceve solo la propria mano, gli spettatori nessuna mano. Tutti vedono il numero di carte per giocatore, lo scarto, il colore attivo, il turno e gli eventi pubblici. Nessun replay delle mani nascoste: nell’archivio rimane lo storico pubblico. Il protocollo di patta a due non viene usato in UNO; i partecipanti possono chiudere e gestire il tavolo.

Test: 105 partite con 2–8 persone, conservazione delle 108 carte anche nel riciclo, validazione turni/colori e viste private. Test workerd con otto account, limite posti, avvio riservato al creatore, spettatore in sola lettura e assenza di mani avversarie/mazzo nelle risposte HTTP, nei WebSocket e nell’archivio. Verifica DOM con otto persone e sette carte proprie e collaudo visivo a 390/760 pixel CSS.
