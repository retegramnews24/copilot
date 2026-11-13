# Binotto Simulator

Manageriale online in 2D dall’alto, integrato nel catalogo Binottoland. Nessuna guida diretta e nessuna nuova istanza Worker.

## Moduli

- `simulator/engine.js`: economia, mercato, iscrizioni, votazioni, calendario Europe/Rome, gara e classifiche. Funzioni pure con tempo esplicito.
- `simulator/server.js`: controlli di appartenenza Telegram, transazioni e allarmi persistenti.
- `public/arcade/binotto-simulator.html`: ingresso iframe e splash.
- `public/simulator/app.js`: scuderia, mercato, strategie, campionato, chat e regia.
- `public/simulator/renderer.js`: scenografia procedurale e monoposto su Canvas 2D.
- `public/simulator/geometry.js`: 13 linee centrali geografiche, proiettate senza alterare le proporzioni.
- `public/simulator/assets/`: le immagini già approvate, estratte dal prototipo in file WebP autonomi.

Il Worker inoltra esclusivamente `/api/simulator/*` all’oggetto `binotto-simulator-league-v1` nel binding ROOMS esistente. Le chiavi degli altri giochi non sono utilizzate. Nessuna migrazione o nuovo segreto è necessario: si riutilizza BOT_TOKEN. Il gruppo è quello indicato dall’owner (`-1001803941686`); TELEGRAM_ALLOWED_GROUP_ID, se già presente, prevale. Il bot deve essere amministratore del gruppo.

## Regole della prima versione online

Ogni account Telegram può creare una scuderia con 10 milioni, due posti pilota e tre posti tecnici vuoti. Il giocatore è il Team Principal. Servono cinque ingaggi e una power unit per iscriversi. Stipendi per GP; acquisto e sviluppo sono addebitati sul server. Mercato condiviso rinnovato ogni giorno UTC, offerte esclusive e fasce legate al livello. Nessuna importazione dei fondi o dei risultati dal prototipo locale.

Una proposta sceglie lun–dom, una o due gare al giorno, orari e data iniziale. Almeno 90 minuti tra gli eventi. Il calendario viene approvato con unanimità degli iscritti e almeno due voti. La riformulazione annulla i voti della proposta precedente. Alla conferma vengono fissati 13 appuntamenti e la lista dei partecipanti; le iscrizioni alla stagione si chiudono. Ogni membro può comunque creare e gestire la propria scuderia, seguire gare e prepararsi alla stagione successiva.

Le gare hanno 24 giri, durano in tempo reale e partono anche senza browser connessi. La durata massima è 70 minuti. Chi non ha organico completo o fondi per gli stipendi non prende il via. I piani dei due piloti sono indipendenti: pit programmato, soglia gomme e riserva automatica sotto 1,7 giri di carburante. I pit avvengono al passaggio del traguardo; sono previsti rifornimenti come regola del gioco. In diretta sono modificabili piano e ritmo e si può richiedere/annullare un pit. Le modifiche di organico/sviluppo sono bloccate durante la propria gara.

La presenza è un heartbeat dell’app visibile; dopo 25 secondi senza heartbeat si usa la velocità al 95%. L’assenza non impedisce la partenza. Il browser estrapola per massimo 3,3 secondi e non decide posizioni, consumi o denaro. I distacchi mostrati in diretta sono stime, marcate con ≈; l’ordine finale usa i tempi server. Classifica 25–18–15–12–10–8–6–4–2–1, sponsorizzazione 350.000 per scuderia partita e 6.000 per punto. XP 100 per gara, un livello ogni 300 XP. Fine stagione: iscrizioni e votazione nuove, organico/budget/sviluppo conservati, punti azzerati.

## Persistenza e accesso

Account derivato dalla sessione Telegram verificata dal Worker. Il client non può scegliere un altro proprietario né inviare un saldo. L’appartenenza viene verificata via getChatMember con cache massima 60 secondi; errori Telegram non concedono accesso. Lo splash e le risorse grafiche sono pubblici; dati e azioni richiedono sessione e appartenenza. Le strategie/carburante/usura degli avversari non sono esposti nelle viste di gara.

L’oggetto dedicato usa transazioni SQLite Durable Object, snapshot spezzato in blocchi da 40.000 caratteri, un timestamp di avanzamento persistente e un solo allarme. Fine gara, premi e avanzamento round sono nella stessa transazione. Doppie esecuzioni dell’allarme non riassegnano premi. Se un risveglio è in ritardo, il motore recupera fino a 3.600 secondi per invocazione e riprogramma il recupero residuo. Fino a 64 scuderie; ultime 100 chat, 40 eventi, 26 risultati. Il roster già approvato resta iscritto anche se un partecipante successivamente lascia il gruppo; l’accesso interattivo viene invece revocato alla verifica successiva.

## Verifiche eseguite

- `npm test`: suite esistente degli altri giochi e test deterministici del manageriale.
- `npm run test:simulator`: calendario/DST, acquisti esclusivi, organico, strategie, 13 gare senza browser, premi una volta, penalità offline, privacy e geometrie finite.
- Test workerd/SQLite: sessioni e origini, non membro respinto, due acquisti concorrenti dello stesso contratto (uno solo riesce), rollback di azione non valida, riavvio e persistenza, allarme reale senza polling e premi non duplicati dopo riavvio.
- `wrangler deploy --dry-run`: bundle Worker e assets.
- Anteprima desktop 1363×936: immagini caricate, paddock, gara, camera pilota e cambio ritmo del primo pilota indipendente dal secondo; body scrollHeight=clientHeight e scrollWidth=clientWidth.
- Il controllo browser mobile si è interrotto per indisponibilità dell’anteprima. I client Telegram reali e una gara con più persone vere non sono stati verificati in questa sessione.

Le scene sono stilizzate: non sono scansioni del paesaggio e il modello gestionale non è una simulazione fisica di guida. Fonte geometrie e licenza MIT: `public/simulator/CIRCUITS-LICENSE.txt`.

## Correzione livrea e accesso (12 novembre 2026)
Le bozze della livrea resistono al polling; cambiare scheda salva il modulo, e una risposta arretrata non ripristina i vecchi colori. Test DOM del modulo e test di persistenza dopo riavvio. Accesso di gruppo esteso all’hub, rinnovo tramite sessione valida, initData iniziale massimo 5 minuti, setup chiuso per default.

La radio verifica A/AAAA prima di ogni fetch e redirect. Il preflight DNS è una protezione aggiuntiva, non un pinning IP: la risoluzione interna di fetch resta della piattaforma. Le protezioni esistenti di media e YouTube restano attive. Nessuna cancellazione degli archivi storici e nessuna separazione aggiuntiva della Lobby senza misurazioni di carico.

## Libere e qualifiche
Solo dopo il voto unanime che chiude le iscrizioni e pubblica il calendario: 30 minuti totali di libere per scuderia e Gran Premio, sul prossimo circuito, con le altre scuderie visibili in pista. Entrambi i piloti condividono il tempo e possono girare insieme. Le libere sono vietate per l’intera giornata se il calendario contiene una gara quel giorno. Pausa esplicita o chiusura normale fermano il tempo; una chiusura senza segnale consuma al massimo i 10 secondi della presenza residua. La riapertura riprende una sessione che era attiva; la pausa manuale richiede Riprendi. Budget, tempi e giro parziale persistono sul server, si rinnovano solo al round successivo, mai al cambio di giorno. Nessun costo, premio o XP nelle prove.

Qualifiche condivise nella finestra gara−30 minuti / gara−10 minuti (20 minuti reali). Ogni pilota esce dai box su comando del manager collegato. Dopo 10 secondi senza presenza torna ai box, perdendo il giro incompleto ma conservando i tempi validi; riconnettersi non fa uscire automaticamente la vettura. Al termine tutti ai box. Il primo giro di uscita non è cronometrato. Le auto usano la stessa funzione di passo della gara, con carburante, gomme, carico aerodinamico e freni. Assetti modificabili ai box; organico, sviluppo e identità bloccati dalle qualifiche alla gara. Griglia per miglior tempo; senza tempo si parte dietro, con ordine stabile. Distacco iniziale di 0,4 s per posizione.

I calendari nuovi richiedono almeno 30 minuti prima della prima gara. I calendari già approvati non vengono spostati. Test: tempo personale in pausa e dopo serializzazione, assenza di rinnovo giornaliero, blocco giorno gara, finestra qualifiche, concorrenza, timeout esatto, privacy, griglia e regressione dei salvataggi.

## Pannello Evento, telemetria e premi
Evento mostra iscritti, calendario ufficiale, classifica piloti e costruttori. Durante la gara i punti proiettati sono marcati provvisori e non generano accrediti. I punti confermati derivano dai risultati salvati, conservando anche i piloti sostituiti. Gli spareggi usano i migliori piazzamenti. Il voto unanime su una proposta chiude le iscrizioni e pubblica il calendario; le sessioni sono bloccate prima della chiusura.

Telemetria mostra consumi e usura per giro, storico dei giri registrati, stima del passo, autonomia, soste e durata della gara (24 giri, massimo 70 minuti). I tecnici suggeriscono intervalli di carico e freni e carburante per qualifica/gara; i consigli sono stime del modello. La precisione degli intervalli dipende da competenza e giri registrati. Le telemetrie delle altre scuderie restano private.

A fine tredicesima gara viene salvato un archivio indipendente della stagione (calendario, gare e classifiche). Premio costruttori dal primo al decimo: 4.000.000, 3.000.000, 2.400.000, 2.000.000, 1.600.000, 1.200.000, 1.000.000, 800.000, 600.000, 400.000 euro di gioco. Premi piloti pari alla metà. Tutti gli accrediti vanno alla cassa unica della relativa scuderia e avvengono una sola volta nella stessa transazione del salvataggio. Nessun premio a chi non ha preso parte ad alcun GP. Gli archivi restano quando si apre la nuova stagione.

L’indicatore Connessi rimane nella barra superiore e mostra i nomi; presenza stimata con scadenza di 25 secondi. Il tempo delle vecchie libere con chiave giornaliera viene conservato nella migrazione al budget per GP.

## Disposizione e chat
I separatori tra pannelli sono trascinabili con mouse/touch e regolabili con le frecce della tastiera. La disposizione si salva durante la modifica e alla chiusura sul dispositivo; PC, tablet e telefono conservano proporzioni separate. Doppio clic sui nuovi separatori ripristina la griglia. Scheda aperta e camera della pista vengono ripristinate; i dati sportivi rimangono sul server. Le sessioni occupano tutta l’area disponibile.

La chat del paddock conserva sul server gli ultimi 100 messaggi, visibili ai membri autorizzati, con aggiornamento ogni 3 secondi quando il paddock è aperto. Il testo inviato viene svuotato solo dopo conferma; la bozza si salva localmente per utente. I tentativi ripetuti dello stesso invio sono deduplicati. Test DOM per errori di rete e bozze, test workerd/SQLite per consegna al secondo membro e persistenza dopo riavvio. Test separatori su DOM; verifica visiva Chromium non eseguita perché il runtime locale ne impedisce l’avvio.

Le modifiche a identità/livrea, strategie dei due piloti e strategia live si salvano automaticamente: bozza locale immediata, invio serializzato dopo 400 ms, conferma visibile e nuovo tentativo al ritorno della rete. Nessun pulsante Salva. Il calendario proposto resta una bozza locale finché si sceglie Invia, per non alterare voti e bacheca durante la digitazione. Acquisti, voto e invio chat rimangono azioni esplicite. Il piano live non modifica una richiesta pit già inviata.

Verificati i salvataggi esistenti di tavoli multiplayer, Labyrinth, Golf, Moto Trial e Number Connect e le preferenze dell’hub. Aggiunta persistenza locale alle preferenze Pong e a corsa/meteo/visuale di Giulio Simulator (comandi e uscita immediati, avanzamento ogni secondo, ripresa in pausa). Non viene dichiarata una conferma server durante assenza di connessione.

## Revisione accessi e correzioni di integrazione
La chat usa i moduli nativi: il launcher concede `allow-forms` soltanto all’iframe first-party Binotto Simulator, conservando le altre restrizioni. L’assenza di questo permesso bloccava gli invii nell’hub, anche se i test DOM che generavano direttamente l’evento submit passavano. La chat è accessibile anche ai membri senza scuderia. Gli stati di invio occupano una riga propria per non comprimere il campo testo.

I separatori rimangono nodi stabili durante gli aggiornamenti, anche nei pannelli piloti delle sessioni. Le misure vengono lette all’inizio del gesto; puntatore/touch e tastiera funzionano senza dipendere dal successo di pointer capture. La pagina Box contiene assetto e piano gara, telemetria e tecnici. I premi raddoppiati valgono per i campionati non ancora liquidati; gli archivi e gli accrediti già completati restano immutati.

Il server verifica identità firmata, scadenza e appartenenza al gruppo prima delle API. L’identità e la scadenza inoltrate ai Durable Object sovrascrivono sempre gli header client. Le connessioni WebSocket registrano la scadenza firmata; prima di richieste, messaggi e allarmi vengono esclusi anche gli spettatori passivi scaduti/revocati. Cache appartenenza: massimo 60 secondi; le connessioni inattive vengono controllate al successivo evento server. Statici pubblici, API private. Nessuna modifica ai permessi di amministrazione del bot o ai segreti.

`npm run test:access`: 13 famiglie di route senza identità/fuori gruppo, firma e scadenza, origine estranea, fallimento verifica Telegram, impersonificazione, privacy spettatori/replay, chat senza scuderia, connessioni passive scadute/revocate. Revisione mirata, non penetration test completo. Test di integrazione del launcher e interazioni DOM; nessuna verifica manuale su Telegram reale dichiarata.


## Modello gara correlato (novembre 2026)

`simulator/physics.js` è la fonte comune di passo, consumo, temperatura, usura e servizio box per sessioni, gara e previsioni. I coefficienti sono di gameplay, calibrati per scelte comprensibili: non sono dati riservati F1 né un modello ingegneristico certificato. Profili dei 13 circuiti con tempo base, abrasività, quota pieno acceleratore, transito box e difficoltà di sorpasso. Il ritmo lungo il tracciato deriva dalla curvatura delle sagome geografiche; l'integrazione attraversa i settori senza saltarli se cambia il passo temporale.

- Giri per circuito fissati alla chiusura delle iscrizioni: obiettivo 35–45 minuti in condizioni normali. Le gare già partite mantengono i propri giri; limite di sicurezza 70 minuti. Gli archivi restano immutati.
- Carburante in kg: distanza, ritmo, efficienza di motore/motorista e carico influenzano il consumo. Il peso modifica passo e usura. A zero carburante si ferma prima di attribuire un arrivo o un rifornimento irraggiungibile.
- Soft/Medium/Hard/Intermedie/Wet: grip distinto dalla gomma residua, riscaldamento dopo il pit, effetto di temperatura, abrasività, peso, stile e ripartizione freni. Il degrado peggiora progressivamente, soprattutto sotto il 40% residuo.
- Carico: compromesso fra resistenza sui rettifili e prestazione in curva; il riferimento varia con pista e acqua. Meteo di gioco deterministico per evento con transizioni progressive, non meteo reale o casualità per richiesta.
- Fino a tre soste programmate con giro, mescola e kg per ciascuna. Giro zero omette la riga. Il piano compilato sostituisce il singolo pit; una sosta anticipata di sicurezza consuma la prossima voce. Esaurito il piano, resta la regola di riserva. Rifornimento 3,5 kg/s in parallelo al cambio gomme, transito specifico della pista; i due piloti condividono il servizio e possono accodarsi.
- Traffico calcolato dalle posizioni iniziali del tick, con sorpassi favoriti sui rettifili e soglie diverse per pista. Effetto termico della scia. Modello gestionale semplificato: niente collisioni, safety car o simulazione aerodinamica CFD.
- Previsioni tramite simulazione dello stesso modello, confronti a una/due soste con carburante distribuito. Sono senza traffico, coda al box e penalità offline: il margine indicativo si restringe con le libere e la competenza dei tecnici. Non è un intervallo statistico misurato. La telemetria conserva carburante e gomma consumati fra passaggi consecutivi.
- Recupero gare offline limitato per numero di vetture: gli allarmi continuano il recupero senza un unico ciclo illimitato.

`public/simulator/pit-layout.js` usa 13 percorsi box dedicati, ricostruiti da disegni e fotografie ufficiali: [fonti e criteri](circuit-pits.md). Nessuna ricerca automatica di corridoi liberi. Geometrie di gioco schematiche, con ingresso/uscita e lato garage specifici; traguardo di Monaco riallineato. Test di intersezione e separazione per corsie e garage.

Verifica: `npm run test:simulator` include calibrazione sui 13 GP, integrazione per settori, consumo e temperature, previsione contro gara server, esaurimento vicino al traguardo/ingresso box, doppio pit, intersezioni geometriche, autosalvataggio del piano multi-sosta e test workerd/SQLite. Render canvas esaminati con motore Skia; interfaccia verificata via DOM, non dichiarata una prova manuale dentro Telegram.

Riferimenti concettuali: Mercedes, “What Goes into F1 Strategy?” (https://www.mercedesamgf1.com/news/what-goes-into-f1-strategy), “Temperature Talk” (https://www.mercedesamgf1.com/news/insight-temperature-talk); Pirelli, “Formula 1 for dummies: the choice of tyres in Formula 1” (https://www.pirelli.com/global/en-ww/race/racingspot/formula-1/formula-1-for-dummies-the-choice-of-tyres-in-formula-1-53864/). Nessun coefficiente è presentato come dato ufficiale di questi team o fornitori.

## Disponibilità, Box e Muretto
Ogni proposta contiene `slots: [{day, times}]`: giorni lun–dom con orari distinti, una gara al giorno iniziale, due opzionali. Il vecchio formato `days/times` resta leggibile. La UI mostra qualifica da −30 a −10 minuti, compreso l’eventuale giorno precedente. La pubblicazione è esplicita, la bozza è locale, voto unanime necessario per chiudere e fissare le 13 gare.

Libere e qualifiche hanno assetti separati per pilota (`sessionSetups`) e dal piano gara. Autosalvataggio con coda, conferma e bozza offline; i comandi attendono il salvataggio. Carico, benzina, mescola e numero di giri lanciati si impostano ai box; ritmo e ripartizione frenante anche in pista. Il Muretto aggiorna velocità, tempi, consumi, autonomia, gomme, temperatura e grip senza ricreare i campi in corso di modifica. Rientra richiede il ritorno al termine del giro, conservando il tempo valido; Allunga aggiunge un giro al programma e annulla il rientro richiesto, solo con riserva di carburante/gomme e tempo sufficiente. Il giro di uscita non è cronometrato. Il timeout qualifiche resta 10 secondi.

Android: somma degli inset `system` e `content` ricevuti dal contenitore, su tutti i lati. Padding esterno alle righe header anche in landscape, intestazione a due righe su telefono, altezza visual viewport, pannelli interni scorrevoli. Il BackButton Telegram passa al gestionale: chiude dialog/elenco connessi, torna al paddock, poi esce salvando vista e bozze. Gli altri arcade conservano il comportamento precedente. Test DOM e messaggi host; prova manuale su Telegram Android ancora da eseguire.

## Team e sessioni live (12 novembre, revisione successiva)
Navigazione: Paddock, Team, Evento, Campionato, Box, Libere, Qualifiche, Gara. Team riunisce gestione e mercato in pannelli contenuti nel frame; le liste scorrono internamente. Bacheca e riepilogo Team Principal scambiati nel paddock. Campionato dedicato a proposte/calendario, classifiche in Evento. Giorni settimana multiselezionabili, campi orari mostrati solo per giorni scelti.

Rimossa la fascia informativa sotto il circuito delle sessioni e i separatori del contenitore principale. Nota nel titolo fino alla prima partenza di gara, poi nascosta. Restano i separatori fra pista/classifica e fra i due piloti. La transizione live confronta lo stato con la gara effettivamente renderizzata, non soltanto con l’ultimo heartbeat. Mercato aggiornato subito se cambia XP/disponibilità.

Progressione: 300 XP per livello, 75 XP per GP disputato dalla scuderia; 100 XP se collegata per almeno il 50% della durata reale di gara. Quattro gare normali o tre in presenza; gare miste accumulano XP proporzionalmente. Accredito una volta per scuderia, non per pilota. XP preesistenti conservati. Conteggio presenza server, nessun credito retroattivo dal solo accesso dopo la gara. Il mercato aggiunge subito le nuove fasce (fino al livello 10 già previsto), preservando gli acquisti effettuati nella giornata.

`simulator/race-events.js`: tre estrazioni pseudocasuali indipendenti al 2% ciascuna per vettura e GP, persistite alla partenza; non al giro, al tick o alla riconnessione. Danno aerodinamico: +6 s sul passo di riferimento, richiesta box e riparazione con +8 s. Foratura: gomma residua limitata al 2%, passo ×1,6 e richiesta box; cambio gomme risolve il problema. Incidente: ritiro della sola vettura coinvolta. Eventi possibili una sola volta ciascuno; nessun incidente casuale nelle libere/qualifiche. Piano futuro nascosto nelle risposte API; messaggi pubblici solo quando l’evento accade. Le gare già in corso prima dell’aggiornamento non ricevono nuovi sorteggi.

Test aggiunti: soglia/probabilità di ciascun evento, applicazione singola, pit riparazione, ritiro, privacy, persistenza SQLite, XP 4/3 e acquisti preservati; allarmi reali aprono qualifiche e avviano la gara senza browser; ordine navigazione, Team integrato, bacheca, nota/sessioni, aggiornamento livello e transizione LIVE dopo heartbeat.

## Conferma calendario in tre passaggi
Accetta proposta salva la scelta senza chiudere le iscrizioni. Pronto! richiede una proposta accettata ed è revocabile finché tutti gli iscritti non sono pronti sulla stessa proposta (minimo due). Quindi le scelte vengono bloccate e ogni iscritto deve premere Si parte!!: solo l'ultima conferma pubblica il calendario e abilita le sessioni. Riformulare o cambiare iscritti azzera i pronti; cambiare proposta azzera il proprio pronto. Tutto è persistito dal server. Se il primo GP è ormai a meno di 30 minuti, i pronti vengono azzerati per consentire una nuova proposta. I campionati già approvati restano invariati.

Libere e Qualifiche hanno un unico separatore orizzontale pista/muretto. Non ripristinano le vecchie griglie generiche; il nuovo divisore conserva la sua altezza per dispositivo. Splash con titolo intero e nessuno scorrimento orizzontale.

## Cockpit grafico e adattamento verticale
Tema blu/turchese/oro in cockpit.css. Libere, qualifiche e gara usano pista piena con classifica sovrapposta, due muretti affiancati e un separatore orizzontale. La navigazione su telefono ha due righe per mantenere tutte le sezioni raggiungibili. Le proporzioni del cockpit vengono salvate separatamente per pagina e tipo di schermo; i valori precedenti vengono ignorati.

Il modulo cockpit.js ridimensiona il contenuto effettivo dei pannelli entro il riquadro, conservando i nodi degli input e quindi focus, valori e autosalvataggio. L'adattamento reagisce alle dimensioni, ai dati live e all'apertura dei dettagli. Su schermi piccoli i testi diventano più compatti. Mercato, classifiche, chat, bacheca, iscritti, proposte e archivi hanno navigazione a pagine; nessun record viene cancellato dal server. In Paddock le pagine della chat partono dai messaggi più recenti.

Verifica: regressioni DOM su salvataggi concorrenti/livrea/strategie/chat e accesso ai livelli del mercato attraverso le pagine; controlli sul ridimensionamento e conservazione degli input; controllo bundle e aree sicure. La resa visiva su Android Telegram reale resta da verificare sul dispositivo.


### Muretto integrato (v13)

- Bacheca e chat del paddock mostrano tutti gli elementi disponibili in un flusso scorrevole, senza pagine. Le schede mercato hanno altezza naturale.
- Piani sosta e consigli tecnici sono aperti inizialmente in Box. Le sessioni espongono i propri controlli direttamente nel muretto; su desktop il pannello informazioni laterale è ridimensionabile.
- In libere e qualifiche ritmo e freni si applicano subito; gli altri valori modificati in pista sono persistiti come assetto programmato e applicati al rientro. La telemetria del giro concluso resta riferita ai valori effettivi.
- In gara il carico effettivo è separato da quello pianificato e cambia all’ingresso ai box. Mescola e rifornimento seguono il piano sosta. I comandi di rientro attendono il completamento dell’autosalvataggio, evitando di ripristinare un piano precedente.
- Gli aggiornamenti live preservano i nodi dei campi e le modifiche in corso. Le impostazioni private non sono esposte agli spettatori.
