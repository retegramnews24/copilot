# Binottocoin, gettoni e macchinetta cambia-gettoni (Lobby 3D)

## Decisioni del proprietario (28 novembre 2026)

- **Binottocoin (BTN):** la moneta ufficiale del circolo. È una **moneta d'oro, piena (senza foro), con la B in
  rilievo**. Serve nelle macchinette del cibo: hot dog, Binotto Cola, popcorn, caffè, tè e le altre bevande, patatine
  e tutti gli snack costano **1 BTN** ciascuno.
- **100 BTN a testa:** a ognuno si danno 100 BTN da usare.
- **Gettoni:** servono per gli arcade, il biliardo e i vari cabinati a gettone (coin-op), non per il cibo.
  Sono **d'ottone, con il foro in mezzo e la scanalatura** ad anello sulle due facce, come i gettoni di una volta.
- **Cambio:** **1 BTN = 5 gettoni**.
- **Ordine dei lavori:** prima l'economia (i 100 BTN a tutti e il cambio nella macchinetta); i prezzi dei giochi in
  gettoni si decidono dopo.

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
  100 BTN e 0 gettoni. Messaggi della Lobby: `wallet` (chiedi il saldo), `wallet-change` (`btn` 1, 5 o 10: +5 gettoni
  per BTN), `wallet-pay` (`m` vend, dog o pop, `k` la scelta del popcorn). Il telefono li tiene in coda finché il
  server conferma (`ack`); un numero (`ref`) già visto non si paga due volte; il saldo non va mai sotto zero. La
  risposta `{type:'wallet', btn, gettoni, ok}` rimette il saldo giusto sul telefono. Prova:
  `tests/club-wallet.test.mjs`.
- **Prezzi:** caffè, bevande e snack 1 BTN, hot dog 1, popcorn 1, Binotto Cola 1, **popcorn e cola insieme 2**. Il
  tasto paga solo se il saldo basta, altrimenti il display dice «SALDO · serve 1 BTN» e suona l'errore. Chi guarda
  un altro che ordina non paga niente.
- **Macchinetta** (`public/lobby3d/gettoni.js`, `createCoinChanger`; in `lobby3d.js` `COIN` x 5,95, z -4,0, sul
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

## Da fare

- Provare nell'app di prova con due giocatori: l'altro vede il cambio? Il saldo resta giusto dopo una riapertura?
- Quanti gettoni costano arcade, biliardo e cabinati (per ora i giochi non li chiedono).
- Fessure per le monete sui cabinati e sulle macchinette, rifatte in Blender una alla volta (idea del proprietario).