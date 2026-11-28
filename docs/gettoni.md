# Binottocoin, gettoni e macchinetta cambia-gettoni (Lobby 3D)

## Decisioni del proprietario (28 novembre 2026)

- **Binottocoin (BTN):** la moneta ufficiale del circolo. È una **moneta d'oro, piena (senza foro), con la B in
  rilievo**. Serve nelle macchinette del cibo: hot dog, Binotto Cola, popcorn, caffè, tè e le altre bevande, patatine
  e tutti gli snack costano **1 BTN** ciascuno.
- **50 BTN a testa:** a ognuno si danno 50 BTN da usare (erano 100, abbassati il 28 novembre 2026).
- **Gettoni:** servono per gli arcade, il biliardo e i vari cabinati a gettone (coin-op), non per il cibo.
  Sono **d'ottone, con il foro in mezzo e la scanalatura** ad anello sulle due facce, come i gettoni di una volta.
- **Cambio:** **1 BTN = 5 gettoni**, e anche **indietro**: la macchinetta riconverte i gettoni in BTN allo stesso
  cambio, **5 gettoni = 1 BTN** (scelte del proprietario, 28 novembre 2026). Il **tasto «↔» sta sulla macchinetta**
  (sulla piastra della moneta, sotto la freccia: `tasto_cambio` nel modello) e gira i tasti, che diventano azzurri
  «5 · 25 · 50 gettoni → 1 · 5 · 10 BTN» (messaggio `wallet-change` con `back: true`).
- **Stessa fessura, stessa bocca:** BTN e gettoni si mettono dalla **stessa fessura** e quello che esce (gettoni, o
  BTN col cambio indietro) cade dalla **stessa bocca nella vaschetta**.
- **Vassoi:** quello che esce dalla macchinetta e le vincite delle slot **restano nel vassoio** di quella macchina,
  **solo per te**, e si accumulano; **ci restano anche se esci** dal circolo. Si prendono con un **tocco sul vassoio
  o «Prendi · N gettoni» (P)** e vanno nel saldo (messaggio `wallet-take`, `m` coin o slot-rossa/oro/nera). Per
  giocare o cambiare si usa il saldo: quello che sta nel vassoio va preso prima. Sul server: `vassoio` nel
  portafoglio; ognuno vede nei vassoi solo le sue monete.
- **Ordine dei lavori:** prima l'economia (i BTN a tutti e il cambio nella macchinetta); i prezzi dei giochi in
  gettoni si decidono dopo.

## Regole dei giochi (scelte del proprietario, 28 novembre 2026)

- **Soldi iniziali: 50 BTN** a testa (prima 100).
- **Si pagano 1 gettone a partita:** cabinati della sala giochi (Pong, Moto Trial, Acquedotto!, Lunar Lander, Number
  Connect, F1 on paper!, Golf, Giulio e Binotto Simulator, Ruggine 89), i due flipper, biliardo, calcio balilla e la
  Zona Operativa (**1 gettone a ogni entrata** dalla porta blindata, poi si gioca quanto si vuole). Finita la
  partita, per rigiocare si paga di nuovo. Nelle partite in più **ognuno mette il suo gettone**.
- **Senza gettoni non si gioca:** il gioco dice «INSERT COIN · servono gettoni» e manda alla macchinetta dei gettoni.
  Guardare resta gratis.
- **Premi: chi vince prende sempre 1 BTN**, da solo o in più, contro persone o contro bot e IA: arcade, biliardo,
  calcio balilla, flipper, Zona Operativa e tavoli. **Nessun tetto** ai premi.
- **Vincere nei giochi da soli** (flipper, Acquedotto!, Lunar Lander, Number Connect, Moto Trial…): battere il
  **proprio record personale** in quel gioco.
- **Cinema: sempre gratis.**
- **Sala tavoli: Lega Giochi Binottoland.** Per giocare ai tavoli ci si iscrive alla Lega: **1 BTN a settimana**,
  pagato in anticipo, **rinnovo automatico ogni 7 giorni**, poi tutti i giochi della sala tavoli senza limiti (le
  vittorie danno lo stesso 1 BTN). Al rinnovo, **se non hai 1 BTN, una settimana di credito** (il saldo va a -1 e lo
  paghi col prossimo BTN che arriva); alla settimana dopo, se sei ancora sotto, l'iscrizione si sospende.

## La macchinetta cambia-gettoni

- **Posto:** sul mobile della radio (credenza di noce, lato est dell'atrio), **a sinistra della radio** guardando il
  mobile dall'atrio, girata verso la stanza come la radio.
- **Aspetto:** stile sala giochi ma piccola, da bancone: **cromata e arancio**, larga 35 cm, alta 55, profonda 30
  (con la vaschetta 38). Insegna inclinata con le lampadine attorno (due gruppi che si accendono a turno), pannello
  arancio davanti, fianchi arancio con il filo cromato, bocca dei gettoni con la cornice luminosa e vaschetta cromata
  che sporge.
- **Come si usa:** si sceglie quanti BTN cambiare con i **tasti 1 · 5 · 10 BTN** (5, 25 o 50 gettoni), si mette la
  moneta BTN nella **fessura** (in piedi, sulla piastra cromata a destra), il **display** mostra l'importo e i gettoni
  che escono, e i **gettoni cadono** uno alla volta dalla bocca nella vaschetta. Sulla targa a sinistra «1 BTN =
  5 GETTONI».

## Modello

`blender/gettoni.blend` → `public/lobby3d/models/gettoni.glb` (circa 800 KB, 23.600 triangoli: quasi tutti nel
rilievo della moneta). Lo script che lo costruisce è dentro il file (testo `gettoni_build.py`). Davanti verso -Y in
Blender (+z in three), base sul piano del mobile (z = 0), centro in x e y. I pezzi che si muovono o si stampano sono
oggetti a parte, già al loro posto, con l'origine nel punto dove si muovono:

- `corpo` (scocca, bocca, vaschetta, scatola dell'insegna) e `pannello` (cornici, piastra e fessura della moneta,
  freccia luminosa): fermi;
- `insegna` (scritta «GETTONI»), `display`, `targa` («1 BTN = 5 GETTONI»): la faccia davanti ha UV da 0 a 1 per la
  scritta che disegna il gioco;
- `tasto_1`, `tasto_5`, `tasto_10`: origine dietro, si premono verso +Y; faccia davanti con UV da 0 a 1;
- `lampadine_a`, `lampadine_b`: materiali a parte (`lampadina_a`, `lampadina_b`) per farle rincorrere;
- `moneta_btn`: in piedi davanti alla fessura (facce verso ±X), origine al centro: entra scorrendo verso +Y. Su una
  faccia il **pagliaccio di Binotto Corsa Competizione coniato in rilievo**, preso dall'icona
  (`public/lobby3d/corsa-competizione.jpg`, griglia alzata dove l'immagine è chiara); sull'altra il **simbolo BTN**:
  una B coniata con i bordi smussati e **tre aste verticali** che escono sopra e sotto (come la ₿ del Bitcoin, che ne
  ha due), con un giro di perline sotto il bordo. Scelte del proprietario del 28 novembre 2026: per la moneta vale la
  sua immagine, anche se di solito niente foto di persone come loghi;
- `gettone`: uno solo, sdraiato nella vaschetta, origine al centro, largo 3,5 cm (più grande del vero, scelta del
  proprietario): il gioco lo copia per ogni gettone che cade dalla bocca.

## Codice (28 novembre 2026)

- **Saldo sul server** (`club-wallet.js`, chiave `wallet:<id>` nello spazio della Lobby): chi non ce l'ha parte con
  50 BTN e 0 gettoni (erano 100 all'inizio). Messaggi della Lobby: `wallet` (chiedi il saldo), `wallet-change` (`btn` 1, 5 o 10: +5 gettoni
  per BTN), `wallet-pay` (`m` vend, dog o pop, `k` la scelta del popcorn). Il telefono li tiene in coda finché il
  server conferma (`ack`); un numero (`ref`) già visto non si paga due volte; il saldo non va mai sotto zero. La
  risposta `{type:'wallet', btn, gettoni, ok}` rimette il saldo giusto sul telefono. Prova:
  `tests/club-wallet.test.mjs`.
- **Prezzi:** caffè, bevande e snack 1 BTN, hot dog 1, popcorn 1, Binotto Cola 1, **popcorn e cola insieme 2**. Il
  tasto paga solo se il saldo basta, altrimenti il display dice «SALDO · serve 1 BTN» e suona l'errore. Chi guarda
  un altro che ordina non paga niente.
- **Macchinetta** (`public/lobby3d/gettoni.js`, `createCoinChanger`; in `lobby3d.js` `COIN` x 5,95, z -3,73: il piano del mobile è diviso in tre parti uguali, la macchinetta a un terzo e la radio a due terzi, z -2,97, scelta del proprietario, sul
  mobile a 1 m, girata verso la stanza): «Usa · Gettoni (E)», la visuale va davanti. Si tocca 1, 5 o 10 BTN: la
  prima moneta arriva col pagliaccio verso di te, si gira ed entra nella fessura (con 5 e 10 ne entrano tre), il
  display conta, i gettoni cadono uno alla volta nella vaschetta, poi «FATTO! +N GETTONI». I gettoni vanno subito
  nel saldo; la vaschetta si svuota quando te ne vai. Lampadine a turno (più svelte mentre cambia). Una persona alla
  volta e gli altri vedono il cambio (`use.m = 'coin'`, `k` i BTN). Mentre sei a una macchinetta in alto c'è il
  saldo («Saldo: 97 BTN · 25 gettoni»).
- **Suoni** (`vendingSounds` in `vending.js`, squillanti come monete vere): `moneta` (rotola e rimbalza dentro),
  `gettone` (ogni volta un po' diverso), `cambio` (din-din-din e pioggia di monete).
- **INSERT COIN** che lampeggia in basso sugli schermi dei cabinati della sala giochi e, tra un giro e l'altro della
  classifica, sul display dei due flipper (scelta del proprietario).
- Prova locale: `public/_prova-gettoni.html` (fuori da git, portafoglio finto). Provato nell'anteprima: 10 BTN →
  90 BTN e 50 gettoni, moneta col rilievo che entra.

## Codice dei giochi (28 novembre 2026)

- **Gettoni all'avvio** (`payGame` in `lobby3d.js`, `wallet-play` in `club-wallet.js`): nella Lobby 3D si paga 1
  gettone aprendo un cabinato, il biliardo, una partita al flipper, accendendo Pong sul monitor, sedendosi al calcio
  balilla (e a ogni «di nuovo» a fine partita) e a ogni entrata nella Zona Operativa. Senza gettoni: «INSERT COIN ·
  servono gettoni» e il gioco non parte (dalla Zona si torna indietro). Ogni partita pagata lascia un biglietto per
  quel gioco (al massimo 5), che serve al premio del record.
- **Premi dal server:** `/lobby/result` (tavoli, biliardo, F1 on paper!, Golf) dà 1 BTN a ogni vincitore che non è un
  bot, una volta sola per risultato; il calcio balilla a chi è seduto dalla parte che vince (`balilla-hub.js`); il
  flipper al record personale battuto (punteggio già controllato dal server, `club-pinball.js`); Number Connect al
  record personale (partita rifatta dal server).
- **Record e vittorie dai giochi da soli** (messaggio `arcade:record` dal gioco → `/api/record`, serve il biglietto
  della partita pagata): Acquedotto! (livello finito più alto), Lunar Lander 3D (somma dei migliori atterraggi),
  Ruggine 89 (gara vinta), Pong contro il computer (partita vinta). Il primo punteggio fissa il record, poi ogni record
  battuto vale 1 BTN.
- **Lega Giochi** (`/api/league`, `/lobby/league`): creare un tavolo o sedersi a un tavolo della sala tavoli senza
  Lega risponde 402; l'app chiede «Ti iscrivi?» (1 BTN, rinnovo automatico ogni 7 giorni) e riprova. Il rinnovo
  si fa quando il portafoglio si legge (`renewLeague`). Le prove dei tavoli iscrivono prima i giocatori finti.
- **Saldo sempre in vista** (scelta del proprietario): nella Lobby 3D sotto la barra in alto («47 BTN · 3 gettoni ·
  Lega ✓»), nella Lobby classica in cima alla pagina Giochi.
- **Il tasto dice sempre il costo:** davanti a un gioco a gettone il tasto della 3D è «Gioca · Nome · 1 gettone (E)»,
  oppure «Nome · INSERT COIN · servono gettoni»; premerlo senza gettoni fa vedere l'avviso e **resta nella 3D** (prima
  la 3D si chiudeva lo stesso e si finiva nella Lobby classica senza avviso). Nella pagina Giochi i tasti dei giochi a
  gettone dicono «· 1 gettone» e pagano anche lì (`setPayGate` in `games-catalog.js`); dalla 3D il gettone è già
  pagato. Elenco dei giochi a gettone uno solo: `public/coin-games.js`.
- **Ritorno dai giochi:** uscendo da un gioco aperto dalla 3D si torna subito nella 3D, senza vedere la Lobby classica
  per un paio di secondi.
- La pagina Giochi della Lobby classica verrà abbandonata e tolta più avanti (nota del proprietario).
- Quando arriva un premio, nella Lobby 3D compare «+1 BTN». Il saldo si aggiorna a ogni giro di presenza (25 s).

## Da fare

- Provare nell'app di prova con due giocatori.
- Premi ancora da collegare: Pong online, Moto Trial, Zona Operativa (squadra che vince), Giulio Simulator, Binotto
  Simulator.
- Dentro un gioco, rigiocare senza uscire (Acquedotto! livello dopo, Ruggine gara dopo) non chiede un altro gettone:
  si paga a ogni apertura del cabinato.
- Sedersi da soli al balilla per allenarsi costa un gettone come una partita.
- Disdire la Lega Giochi (per ora si rinnova sempre) e far vedere la scadenza anche nella Lobby classica.
- Fessure per le monete sui cabinati e sulle macchinette, rifatte in Blender una alla volta (idea del proprietario).