# Giochi da tavolo

[← Binottoland](../README.md)

## Dama italiana

12 pedine per parte, Bianco per primo, damiera con cantone scuro in basso a destra e caselle numerate 1–32. Pedine solo in avanti, dame corte in entrambe le direzioni; le pedine non catturano dame. Prese obbligatorie con precedenze: quantità, valore del pezzo prendente, numero di dame catturate, ordine dei pezzi catturati. La promozione termina il turno. Riferimento per movimenti e prese: [regolamento FID, articoli 2–6](https://www.fid.it/regolamenti/capo1.htm).

Adattamenti per il circolo: nessun orologio o regola del pezzo toccato; selezione annullabile fino all'invio dell'intera mossa. Una presa multipla si compone toccando ogni salto e viene validata e pubblicata come singola mossa completa. La parità scatta automaticamente alla terza posizione identica con identico turno o dopo 80 semimosse di sole dame senza prese, con almeno una dama per parte. La patta concordata resta disponibile. Vittoria automatica quando l'avversario non ha più pezzi o mosse.

La stessa identità non può aprire o raggiungere un secondo tavolo attivo, anche scegliendo un gioco diverso. Le vecchie partite senza campo game vengono trattate come scacchi. Nessuna nuova migrazione Durable Object richiesta.

`npm test` esegue i test del motore: precedenze, catture multiple, promozioni, vittoria, patte e 30 partite deterministiche.

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

Scarabeo in singolo usa il piccolo lessico incorporato in `table-ai.js`, dichiarato nel selettore; le altre parole possono essere rifiutate anche se esistono. Il lessico è limitato e non sostituisce un vocabolario. In multiplayer rimane la convalida dei partecipanti. Il tutorial offre spiegazioni dello stato e una mossa suggerita eseguibile, lasciando comunque libere le altre mosse legali.

La pagina Giochi mostra due classifiche Top 5, una per il singolo e una per il multiplayer, con il totale e il dettaglio per gioco. Una vittoria corrisponde a una manche completata (una partita di Scopa completa a 11, non ogni smazzata); ogni compagno vincitore riceve il credito. Patte, tutorial, partite interrotte e bot sono esclusi. Pareggi nel totale ordinati per nome e identificatore stabile. I risultati sono registrati nella Lobby con chiave stanza/manche e sopravvivono alla cancellazione e alla scadenza dei tavoli. La classifica recupera in blocchi i risultati precedenti ancora disponibili, compresi gli archivi e gli storici dei tornei; quelli già cancellati o scaduti prima dell’introduzione della classifica non sono ricostruibili.

Verifica aggiuntiva: `node tests/scopa-ai.test.js`, `npm run test:table-runtime` e `npm run test:multiplayer-runtime`. La prova UI locale usa `npm run test:ui`. Nessuna fixture o identità sintetica fa parte degli asset pubblicati.
