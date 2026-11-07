# Binottoland

Mini App Telegram del circolo: una Lobby condivisa con account verificati, presenti, chat e tavoli numerati. Checkmate! (scacchi) e Dama italiana sono disponibili nella stessa Lobby. Labyrinth aggiunge un’esplorazione individuale in prima persona.

## Configurazione privata

Configura il secret `BOT_TOKEN` del bot Telegram nel Worker Cloudflare di produzione. Il server verifica i dati firmati da Telegram e crea una sessione di 12 ore, conservata in memoria dal client. Chi può aprire la Mini App da Telegram può entrare. I permessi di archiviazione e cancellazione restano ai partecipanti delle rispettive partite.

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

Le partite di prova non archiviate scadono dopo sette giorni. Quelle archiviate rimangono fino all'eliminazione da parte di un partecipante. Ogni nuovo tavolo riceve il numero libero più basso a partire da 1. I tavoli archiviati liberano il numero e gli identificatori interni restano univoci. Le vecchie credenziali del browser consentono di collegare il proprio precedente posto all'account Telegram verificato.

## Progetti distinti

Binottoland è il circolo. DABradio e binottoland_hub rimangono progetti separati; il secondo mantiene il ruolo di Hub pubblico con TV, radio e giochi single player.

## Verifica

Controlli locali eseguiti con API Durable Object e DOM simulati: identità firmata, autorizzazioni, partite, patta, archivio/replay, presenza/chat, accesso automatico con Telegram e navigazione/radio. La verifica degli stream e della resa audio nel client Telegram richiede dispositivi reali.

## Dama italiana

12 pedine per parte, Bianco per primo, damiera con cantone scuro in basso a destra e caselle numerate 1–32. Pedine solo in avanti, dame corte in entrambe le direzioni; le pedine non catturano dame. Prese obbligatorie con precedenze: quantità, valore del pezzo prendente, numero di dame catturate, ordine dei pezzi catturati. La promozione termina il turno. Riferimento per movimenti e prese: [regolamento FID, articoli 2–6](https://www.fid.it/regolamenti/capo1.htm).

Adattamenti per il circolo: nessun orologio o regola del pezzo toccato; selezione annullabile fino all'invio dell'intera mossa. Una presa multipla si compone toccando ogni salto e viene validata e pubblicata come singola mossa completa. La parità scatta automaticamente alla terza posizione identica con identico turno o dopo 80 semimosse di sole dame senza prese, con almeno una dama per parte. La patta concordata resta disponibile. Vittoria automatica quando l'avversario non ha più pezzi o mosse.

La stessa identità non può aprire o raggiungere un secondo tavolo attivo, anche scegliendo un gioco diverso. Le vecchie partite senza campo game vengono trattate come scacchi. Nessuna nuova migrazione Durable Object richiesta.

`npm test` esegue i test del motore: precedenze, catture multiple, promozioni, vittoria, patte e 30 partite deterministiche.

## Radio: catalogo e brano in onda

Il catalogo richiede fino a 200 risultati italiani e conserva gli URL HTTPS utilizzabili. I preferiti restano personali. Il brano viene mostrato come testo scorrevole sotto i controlli, solo quando disponibile. Le emittenti che non trasmettono metadati ICY, o li offrono solo con API proprie, non mostrano titolo e artista.

L'audio rimane diretto tra dispositivo e stazione. L'endpoint autenticato `/api/radio/now-playing?station=UUID` risolve la stazione attraverso Radio Browser e legge solo un breve campione ICY: massimo 10 secondi, 256 KiB e quattro blocchi. Non accetta URL arbitrari dal client; verifica gli indirizzi e i redirect. I risultati hanno una cache breve per isolate e le richieste simultanee alla stessa stazione condividono il probe. Il client aggiorna ogni minuto durante l'ascolto con app visibile; pausa e cambio stazione invalidano le risposte precedenti.

Il pulsante per creare tavoli è nella pagina Giochi. La Lobby conserva elenco, presenti e chat.


## Moto Trial · Platform 2D

Dalla pagina Giochi si può partire in singolo o creare una corsa multiplayer. Le corse appaiono nella Lobby e ospitano fino a otto piloti sullo stesso percorso. Le moto degli altri giocatori si vedono in tempo reale, con nomi e colori distinti, e possono incrociarsi. La propria moto resta al centro della visuale mentre il canyon scorre. La campagna ha dieci circuiti fissi in ordine di difficoltà crescente. Si parte dal primo e il traguardo sblocca il successivo. In multiplayer ogni pilota avanza al proprio ritmo e vede gli altri sullo stesso circuito. Il progresso si conserva nel browser in singolo e nella stanza in multiplayer. Servono slancio sulla rampa e controllo dell’assetto in aria. Il freno carica la forcella e ogni sospensione si comprime separatamente. Sul bordo la moto ruota attorno alla ruota ancora in appoggio e in appoggio singolo può prendere un po’ più di velocità. La rotazione in aria segue gli impulsi di X-Moto Classic, applicati al modello 2D di Moto Trial con inerzia aggregata. Riferimenti [parametri Classic](https://github.com/xmoto/xmoto/blob/539984a84e8b1ad6f1ab7f90f92e5af9c9878e1c/bin/Physics/original.xml) e [controllo dell’assetto](https://github.com/xmoto/xmoto/blob/539984a84e8b1ad6f1ab7f90f92e5af9c9878e1c/src/xmscene/BikePlayer.cpp). Mani e piedi seguono manubrio e pedane. Bacino e busto si spostano per bilanciare la moto e articolano gomiti e ginocchia. Il casco segue la stessa posa usata per disegnare il pilota. Il contatto del casco con il terreno conta come caduta. Dopo un atterraggio sulle ruote si può proseguire dal ripiano raggiunto. I primi circuiti hanno appoggi di recupero più ampi e frecce per riprendere la direzione. Per sbloccare il livello successivo si attraversa la bandiera del traguardo da qualunque verso. Se si esce nel vuoto si può scegliere di tornare al via. Il traguardo mostra il tempo del giro riuscito e il numero di cadute.

Frecce o WASD per accelerare, frenare e inclinare la moto. Tenere premuta un’inclinazione può farla ribaltare. Il motore sale di giri con il gas, mentre salto e atterraggio hanno suoni distinti. Spazio inverte la direzione mantenendo lo slancio. Su telefono si può tenere premuto Gas e toccare Gira con un altro dito. Dal menu di pausa si può riprendere e, in singolo, generare un altro percorso. La grafica è vettoriale, disegnata su Canvas.

## Labyrinth · spedizioni multiplayer

Dalla pagina Giochi si crea una spedizione numerata; nella Lobby gli altri possono entrare o assistere. Il creatore è il primo partecipante, ma non ospita la partita: ogni spedizione vive in un Durable Object distinto, tramite il binding ROOMS già configurato. Non servono nuove migrazioni, binding o segreti. Le esplorazioni vuote rimangono nella Lobby fino all’archiviazione o eliminazione da parte di un partecipante. L’arena conclusa libera il numero e si può archiviare dal menu prima di uscire. Quando una spedizione si chiude, il suo numero torna disponibile.

Fino a 16 partecipanti per spedizione e 40 connessioni complessive includendo spettatori. Ingresso tardivo dal primo piano. Quando qualcuno arriva nell’arena con un gruppo di più persone, si chiudono i nuovi ingressi; chi è già partecipante può riconnettersi. Se si arriva da soli, invece, gli ingressi restano aperti finché si sceglie **Apri vetrina**. Un nuovo ingresso durante questa attesa aggiunge la propria vetrina accanto alle altre ed elimina la possibilità di aprire da soli. L’apertura di gruppo attende tutti i partecipanti attivi; chi è ancora nel periodo di riconnessione resta nel conteggio. Gli spettatori non contano.

In **Dev Mode** si può raggiungere subito qualsiasi piano o l’arena dal menu e caricare l’equipaggiamento completo con il passe-partout. La freccia per l’uscita è disponibile solo in Dev Mode. Il tutorial locale usa istruzioni testuali.

### Regole condivise e persistenza

Cinque labirinti deterministici con lo stesso seed per tutti: giallo, verde, rosso, blu e nero progressivamente più scuri. Ogni giocatore cambia piano indipendentemente. Una sola keycard di uscita per piano chiuso, a terra o nell’inventario di una persona. Le carte dei cinque piani vengono inizializzate dal server alla creazione; al caricamento delle partite salvate si ripristinano gli spawn mancanti o fuori dal pavimento, senza duplicare carte già in inventario. Le carte a terra sono leggermente più grandi; se la carta del piano è già in mano a un compagno, l’obiettivo ne mostra il nome. Il server valida la raccolta e consuma la carta quando apre la porta. La porta rimane aperta per tutti e mostra un’anteprima dell’ingresso successivo. Attraversare la soglia fa avanzare automaticamente. Il passe-partout nero giace nel quinto piano, occupa uno slot, si può riusare per aprire qualsiasi porta dei piani, compresa quella nera, e per tornare indietro.

Disconnessione: 60 secondi per rientrare; allo scadere le carte cadono sull’ultimo piano e nella posizione valida del giocatore, che viene tolto dal conteggio dell’arena. La perdita silenziosa di rete viene rilevata dopo 45 secondi senza heartbeat, quindi parte lo stesso periodo. Una vecchia connessione non può scollegare o muovere quella più recente dello stesso account. Equipaggiamento e progressi individuali si ritrovano rientrando; le carte già cadute non vengono duplicate. Se sparisce il creatore, gli altri continuano. Se spariscono tutti prima del combattimento, la spedizione rimane salvata.

Porte, carte, inventari, vita, cambi di piano e attivazione dei quadri vengono salvati subito. Le posizioni vengono consolidate fino a ogni cinque secondi durante il movimento; un’interruzione improvvisa del runtime può arretrare la sola posizione fino all’ultimo consolidamento. Connessioni WebSocket con hibernation e allarmi Durable Object gestiscono i timer anche senza client collegati.

Dal secondo al quinto piano, alcuni quadri oscillano prima di cadere quando un giocatore si avvicina. Il quadro caduto poggia contro la parete opposta. Si supera con un salto sul lato più basso. Un quadro in caduta toglie il 25% di vita una volta per giocatore. A zero si riparte all’ingresso del piano con il 100% di vita e tutto il proprio equipaggiamento.

Ogni piano del labirinto ha tre specchi a parete. Quello visibile più vicino riflette la stanza e i personaggi con il motore WebGL. Il renderer 2D usa riflessi dei personaggi semplificati.

### Arena, personaggi e comandi

Quando tutte le vetrine del gruppo si aprono, inizia la sfida. Chi perde tutta la vita resta in tribuna. L’ultimo superstite ottiene una vittoria nella classifica multiplayer. Chi gioca da solo usa l’arena come allenamento.

Colosseo ovale con fondo di sabbia, gradinate a cinque file, due ordini di arcate, stendardi, bracieri e anfore. Il pubblico è geometria raggruppata con oscillazioni leggere, ferma se il dispositivo preferisce ridurre le animazioni. Il brusio degli spalti sostituisce il ronzio del labirinto. La rete elastica da 22,5 × 9,2 metri resta ferma finché il giocatore salta. Il rimbalzo successivo dipende dall’energia d’impatto e dalla posizione sulla rete. La maglia flette in atterraggio e i salti crescono fino a un limite. Accovacciarsi interrompe la sequenza al contatto. Una vetrina personale per partecipante attivo, con assegnazione stabile. Apertura simultanea e definitiva quando arriva l’ultimo del gruppo; in singolo apertura manuale solo da vicino con E/Usa. Ogni persona ha due mani e due tasche. La vetrina contiene uno zaino da marcia con quattro spazi aggiuntivi, gladio, scudo ricurvo, elmo crestato e corazza a fasce, tutti ispirati all’equipaggiamento romano. Gli alloggiamenti indossati appaiono alla raccolta. La corazza attiva una miniatura che mostra colori e oggetti effettivamente in uso. Non è possibile svuotare la vetrina di un altro. Se una nuova vetrina compare dove c’è qualcuno, il server lo riposiziona in un punto libero.

Gli altri personaggi sono visibili solo nel proprio piano, con forme morbide, pelle rosa, maglietta e pantaloncini selezionabili in dieci colori distinti; l’equipaggiamento indossato e in mano compare anche negli specchi. Posizioni e rotazioni vengono interpolate. Il corpo ruota con la visuale e la testa segue anche l’inclinazione. Le braccia sono articolate dalla spalla alla mano e sostengono la spada. In prima persona, abbassando lo sguardo si vedono anche le gambe e le scarpe. I giocatori dello stesso piano collidono tra loro e possono separarsi se compaiono nello stesso punto. Nomi mostrati solo da vicino, nascosti dietro i muri. Il server verifica distanza, direzione e muri per ogni colpo tra giocatori. Un pugno toglie il 2% di vita e una spada il 10%. Una parata frontale annulla il pugno e riduce il danno della spada al 7%. Con corazza, scudo in mano ed elmetto la spada toglie il 2%. Il braccio sinistro mantiene la guardia mentre la destra colpisce. Durante la sfida, chi viene eliminato osserva dagli spalti con la sola visuale libera. Passi, salti, atterraggi, pugni e spade hanno suoni distinti.

PC: WASD/frecce, mouse o trascinamento, E per usare, F/clic sinistro per il colpo, destro tenuto premuto per parare, Spazio per saltare, Shift per correre, Ctrl tenuto premuto per abbassarsi, Q per lasciare la carta in mano, M per liberare o riagganciare il mouse, Esc per la pausa. Telefono in orizzontale: joystick sinistro movimento, joystick destro visuale; Colpisci diventa Usa vicino a un oggetto. Salta e Para sono a destra. Tieni premuto Para per restare in guardia. Tocca Abbassa a sinistra per accovacciarti o rialzarti. Il menu di pausa permette il ritorno a Binottoland. I collegamenti e le impostazioni della chat vocale sono rimossi; le chiamate si gestiscono esternamente.

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

## UNO · da 2 a 10 giocatori

Tavolo da due a dieci, mazzo da 108 carte, sette a testa e carte iniziali con effetto. La partita prosegue fino a 500 punti con i valori della scheda Mattel W2085. +2 e +4 non si sommano. Chi gioca la penultima carta può dichiarare UNO con la giocata o prima che inizi il turno successivo. Una segnalazione valida costa due carte. Il destinatario di un +4 può accettare la penalità o contestarlo. La mano contestata è mostrata solo al destinatario. Inverti a due funziona come Stop.

Le mani e l’ordine del mazzo rimangono nello stato del Durable Object. Risposte HTTP e messaggi WebSocket vengono proiettati per identità verificata: ciascuno riceve solo la propria mano, gli spettatori nessuna mano. Tutti vedono il numero di carte per giocatore, lo scarto, il colore attivo, il turno e gli eventi pubblici. Nessun replay delle mani nascoste: nell’archivio rimane lo storico pubblico. Il protocollo di patta a due non viene usato in UNO; i partecipanti possono chiudere e gestire il tavolo.

Verifica con 72 partite a 500 punti da 2 a 10 persone, incluse le contestazioni e le mani private. La prova workerd verifica il limite dei dieci posti, l’avvio, le mani private via HTTP e WebSocket e l’archivio.

## Scarabeo e tornei

Scarabeo: da due a quattro persone, otto lettere private e plancia 17 × 17. Il server verifica il leggio, la geometria delle parole, gli incroci e i punti; i vocaboli proposti vengono convalidati a maggioranza dagli altri partecipanti. Non è incluso un dizionario automatico: in caso di dubbio il gruppo consulta il vocabolario. L’autore può ritirare una proposta; una parola respinta non cambia plancia o lettere. Plancia premio del circolo, jolly recuperabili, premi per sei/sette/otto tessere e SCARABEO/SCARABEI; niente clessidra. Due giri completi di passaggi chiudono la manche con penalità dei leggii. Gli spettatori vedono plancia e proposte, mai le lettere non giocate. Riferimento del regolamento: https://www.centrosportivoinminiatura.it/download/regolamentoscarabeo.pdf .


Prima di creare un gioco da tavolo si sceglie partita veloce o torneo al raggiungimento di tre/cinque vittorie. Il traguardo di cinque è intenzionale: con due persone possono servire nove manche decisive. Le patte non assegnano vittorie; nelle manche a punteggio con primi a pari merito non viene attribuita una vittoria. Stessi partecipanti, punteggi serie salvati sul server e manche successiva avviata dal creatore. Fra le manche il tavolo continua a occupare i posti dei partecipanti, impedendo di creare un secondo tavolo. La chiusura manuale o l’archiviazione interrompono il torneo. Labyrinth mantiene il flusso separato di spedizione cooperativa, senza tornei.




## Battaglia navale e Briscola

Battaglia navale: due persone, oceani 10 × 10 e cinque navi da 5/4/3/3/2 caselle. Posizionamento manuale o casuale, conferma indipendente dal turno, navi dritte senza sovrapposizioni; possono toccarsi. Un tiro per turno anche dopo un centro. Il nome della nave colpita, l’affondamento e la vittoria sono calcolati sul server. Ogni account riceve soltanto la propria flotta; gli spettatori ricevono acqua, colpi e navi già affondate. Nessun replay rivela le posizioni nascoste. Riferimento: https://instructions.hasbro.com/api/download/A3264_en-in_battleship.pdf .

Briscola: quaranta carte con illustrazioni SVG originali ispirate alle siciliane, semi Coppe/Denari/Spade/Bastoni e figure Fante/Cavallo/Re. Nessuna scansione di un mazzo commerciale. A due si gioca individualmente; a tre si rimuove il 2 di Coppe e vince il maggior punteggio; a quattro coppie fisse 1+3 contro 2+4. Tre carte in mano, vincitore della presa pesca per primo, briscola scoperta pescata per ultima. Nessun obbligo di rispondere al seme. Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2: 120 punti complessivi; In caso di parità in testa si ridistribuisce con lo stesso mazziere. Riferimento: https://www.modiano.it/it/gioco/briscola/ .

Briscola in cinque: tavolo separato con esattamente cinque posti e otto carte a testa. Variante chiamata con asta sulla carta, dal valore più alto al più basso; sul 2 si può salire da 61 fino a 120 punti. Passaggio definitivo, ridistribuzione se passano tutti. Il vincitore sceglie il seme e la carta; il socio è segreto fino alla sua giocata. Possibile chiamare una propria carta per giocare da soli; se si possiede il 2 del seme, è ammessa anche la carta più bassa mancante di quel seme. Il contratto deve essere raggiunto. Punteggio della chiamata ±2/±1, solitaria ±4/±1, moltiplicatori delle soglie e cappotto descritti al tavolo. Non si applicano prima mano al buio o variante col monte. Riferimento della variante scelta: https://www.pagat.com/aceten/briscola_chiamata.html .

Ogni risposta HTTP/WebSocket contiene soltanto la mano dell'identità verificata. Nessun mazzo, altra mano o socio ancora segreto viene inviato agli spettatori. Punti delle prese conteggiati sul server, totale mostrato alla fine. Tutti e tre i tavoli conservano spettatori, avvio manuale, partita veloce o torneo. In Briscola ogni membro della parte vincente guadagna una vittoria di serie; più persone che raggiungono il traguardo condividono il titolo. Il mazziere ruota alla smazzata successiva.

Verifiche: sessanta battaglie complete e 240 smazzate complete (due/tre/quattro/cinque persone), tutte le combinazioni di due carte per presa, conservazione delle 39/40 carte e dei 120 punti, chiamate speciali, aste, patte e vittorie condivise. Test workerd con flotte pronte fuori turno, mani distinte per identità, spettatori HTTP/WebSocket, turni iniziali e riavvio SQLite; verifiche DOM e browser per disposizione, tiri, aste e carte responsive.


## Scopa, avversari automatici e classifica storica

La Lobby mostra i tavoli attivi. Dopo la fine di una partita o di un torneo, il tavolo viene eliminato quando esce l’ultimo giocatore che sta guardando il risultato. Il pulsante **Archivia partita** lo conserva. Il risultato già registrato rimane nella classifica storica.

Cluedo è stato ritirato dal catalogo e i suoi tavoli non occupano più il posto del giocatore. Scopa usa le stesse carte siciliane della Briscola: 2–3 individuali, 4 in coppie 1+3 contro 2+4. Tre carte a testa e quattro a terra, presa obbligatoria e carta uguale prima delle somme, ultima giocata senza scopa, residui all’ultima presa. Si ridistribuisce se sul tavolo iniziale ci sono almeno tre re. Carte, denari, settebello, primiera e scope; traguardo 11 punti a fine smazzata, proseguendo in caso di parità. Regolamento di riferimento: https://www.sisal.it/content/dam/new-dam/italy/canali/sisal-it/doc-pdf/giochi-di-carte/regolamenti-giochi/scopa.pdf . Non sono attive Napola e varianti assopigliatutto.

Tutti i giochi da tavolo hanno tre scelte alla creazione: multiplayer, singolo veloce contro AI, tutorial contro AI. Nel singolo si sceglie il numero di posti entro i limiti del gioco e gli altri sono bot, compresa la chiamata in cinque. Non si creano tornei in singolo. Gli avversari usano le informazioni visibili al proprio posto e la cronologia pubblica. Nel singolo veloce scacchi, dama e Forza 4 analizzano più turni. Negli altri giochi l’AI valuta prese, carte, parole o bersagli secondo le regole del tavolo. Il tutorial mantiene il livello base. Non sono motori professionali né modelli linguistici. Le risposte avvengono tramite Durable Object alarm, una azione per risveglio e con salvataggio prima del turno successivo. Non richiedono servizi AI, chiavi o nuove migrazioni Cloudflare. Gli spettatori conservano le stesse limitazioni sulle mani e sulle flotte.

Scarabeo in singolo usa il piccolo lessico incorporato in `table-ai.js`, dichiarato nel selettore; le altre parole possono essere rifiutate anche se esistono. Il lessico è limitato e non sostituisce un vocabolario. In multiplayer rimane la convalida dei partecipanti. Il tutorial offre spiegazioni dello stato e una mossa suggerita eseguibile, lasciando comunque libere le altre mosse legali. Labyrinth rimane cooperativo: esplorazione locale e tutorial contestuale su carte, uscite, vetrina, zaino e spada, senza avversario AI e senza vittorie competitive.

La pagina Giochi mostra due classifiche Top 5, una per il singolo e una per il multiplayer, con il totale e il dettaglio per gioco. Una vittoria corrisponde a una manche completata (una partita di Scopa completa a 11, non ogni smazzata); ogni compagno vincitore riceve il credito. Patte, tutorial, partite interrotte e bot sono esclusi. Pareggi nel totale ordinati per nome e identificatore stabile. I risultati sono registrati nella Lobby con chiave stanza/manche e sopravvivono alla cancellazione e alla scadenza dei tavoli. La classifica recupera in blocchi i risultati precedenti ancora disponibili, compresi gli archivi e gli storici dei tornei; quelli già cancellati o scaduti prima dell’introduzione della classifica non sono ricostruibili.

Verifica aggiuntiva: `node tests/scopa-ai.test.js`, `npm run test:table-runtime` e `npm run test:multiplayer-runtime`. La prova UI locale usa `npm run test:ui`. Nessuna fixture o identità sintetica fa parte degli asset pubblicati.
