# Stato dei lavori

Una pagina sola, da leggere all'inizio di ogni sessione e da aggiornare alla fine. Qui non si racconta cosa è stato
fatto (quello è nella storia dei commit): si scrive solo cosa serve per ripartire.

Aggiornato il 28 novembre 2026.

## Versioni

- `main`: **1.0.73**: in Zona Operativa al computer si cammina e si corre tenendo Maiusc. 1.0.72: Zona Operativa (poligono, online sul deserto, squadre con i bot), porta blindata e corridoio,
  Forza 4 vero sul tavolo 3D, F1 on paper! con i bot (1.0.71: macchinetta caffè e snack; 1.0.70: sala cinema nuova).
  Le 8 prove passate. Portata su richiesta del proprietario prima dei controlli a mano su staging: le voci di «Da
  provare» qui sotto valgono ora anche per l'app vera.
- `staging`: 1.0.73, uguale a `main` (`branch-diff`: nessuna differenza).

## In corso

**Macchinetta caffè e snack della Lobby 3D** (`docs/macchinetta.md`): nella 1.0.71, nell'atrio a destra della
porta del cinema (grafite con linee arancio, suoni, prodotto in mano visto anche dagli altri). Da guardare nell'app,
anche con due giocatori.

**Sala cinema della Lobby 3D**, un passo per volta con l'ok del proprietario. Nella 1.0.70 (staging e main), da
guardare con un film vero nell'app: sala 2 m più lunga (parete dello schermo a z 20,55), tetto a 5,5 m dello stesso colore delle pareti,
ingresso in piano con la Lobby, poi una rampa continua (niente gradini) che scende di 60 cm fino alla prima fila,
tenda d'ingresso com'era (si apre da sola avvicinandosi; la prova di una tenda «viva» che si sposta come stoffa
è stata tolta su richiesta del proprietario), 5 file con due divanetti doppi per parte (4 posti a sinistra e 4 a destra della corsia centrale, 20 divanetti),
schermo 7 × 3,94 m col bordo basso a 1,3 m dal pavimento davanti; visuale che entra come nelle altre porte; luci di
sala basse. Cabina di proiezione incassata sopra l'ingresso (`blender/proiettore.blend` → `models/proiettore.glb`):
finestrella col vetro, proiettore digitale moderno inclinato verso il centro dello schermo; col film in proiezione
obiettivo e lucina accesi, fascio di luce largo quanto lo schermo, luci di sala ancora più basse; il fascio prende
colore e luminosità dal film e nell'obiettivo si vede il film in piccolo, specchiato (con YouTube il fascio tremola
da solo). Tende ai lati dello schermo fatte nel codice: velluto a pieghe dal pavimento al tetto, contro la parete dello
schermo. La sala è buia perché i suoi materiali sono più scuri (`CINEMA_DIM` 0,18, riflessi bassi, pelle opaca), non
perché si abbassa la luce di tutta la scena: è la luce scelta dal proprietario, uguale vista dalla Lobby e da dentro.
Applique del cinema di Blender (`blender/applique_cinema.blend` → `models/applique_cinema.glb`): 5 per parete tra i
pannelli, con un ventaglio di luce sopra e sotto. Locandina nell'atrio accanto alla porta del cinema: titolo di
quello che si proietta e, dopo 10 secondi di film continui sullo stesso canale, un fotogramma del video (con
YouTube la copertina, se si lascia leggere). Girandosi il film non compare più in un riquadro piccolo.
Le pagine di prova solo locali (`public/_prova-*`) restano fuori da git (`.gitignore`). Cinema spento: sullo schermo l'insegna «BINOTTOLAND
PLAYGROUND CINEMA» su sipario rosso con cornice déco dorata, ferma (`public/lobby3d/cinema-sign.js`; scelta del
proprietario tra quattro proposte, anche rispetto a una versione con le lampadine animate).

La sala tavoli della Lobby 3D è finita: ogni gioco ha i suoi pezzi veri sul tavolo (Forza 4, carte, Scarabeo,
Battaglia navale, Scacchi e Dama), come dati nei file `public/lobby3d/table-*.js` e `connectFour` in `lobby3d.js`,
così più avanti il tavolo potrà mostrare la partita vera. Sedie ai lati corti, ogni giocatore ha i suoi pezzi
davanti.

**Partita vera sui tavoli della Lobby 3D** (`docs/finiture-lobby.md`, voce «Partita vera sui tavoli»): fatto
Forza 4, su staging dopo il push. Scelte del proprietario: si vede la tua partita, se no quella con l'ultima mossa;
senza partite i pezzi in posizione iniziale; in diretta solo vicino alla sala; si parte da Forza 4 e si aggiunge un
gioco alla volta, dopo averlo guardato nell'app.

**Zona operativa** (`docs/finiture-lobby.md`, voce «Zona operativa»): porta blindata nella sala giochi accanto al
quadro, tunnel di cemento, in fondo la Lobby 3D si spegne davvero e parte il gioco (per ora un segnaposto). Scelte
del proprietario: porta blindata industriale, tunnel di cemento, insegna «ZONA OPERATIVA», spegnimento vero (al
ritorno la Lobby si ricarica in qualche secondo). Il gioco, **Zona Operativa**, è progettato in
`docs/zona-operativa.md` (scelte del proprietario e 4 tappe: poligono di tiro, uno contro uno online, fino a 8 con
squadre Rossa/Blu e bot, rifiniture). Fatti in Blender, guidati passo passo dal
proprietario: mappa del deserto (`zona_deserto.blend`, con i punti di armi, casse mediche, rinascite e partenze),
soldati Rossi e Blu con 8 animazioni (`zona_soldato.blend`), 5 armi più coltello, braccia in prima persona e cassa
medica (`zona_armi.blend`), poligono di tiro con le sagome (`zona_poligono.blend`). Regole delle armi decise.
Tappa 1 scritta (`public/zona/`, poligono di tiro da soli con le 5 armi e il coltello): provata
nell'anteprima locale (si cammina, si prende un'arma al bancone, il colpo in testa abbatte la sagoma), da provare
nell'app vera. Tappa 2 scritta (commit su staging, non caricato): «Gioca online» nel menù porta alla partita sul deserto,
Tutti contro tutti, una partita sola per il circolo (`zona-server.js`, `public/zona-link.js`, `public/zona/net.js`,
`online.js`; mappa e soldati esportati da Blender, urti generati da `scripts/zona-deserto-urti.py`). Provata con le
prove automatiche (server e previsione contro il server) e nell'anteprima con messaggi finti (mappa, soldato,
classifica, eliminazione); il server vero si prova solo su staging. Dopo il commit, non ancora in un commit: anche
il poligono è condiviso (ci si vede, niente fuoco amico, sagome di ognuno), poi caricato. Poi, caricati su staging il 28 novembre:
sfarfallio corretto nei modelli (deserto e poligono), cielo, ombre e spigoli arrotondati sul deserto, scala della
torre che sale fino alla terrazza. E ancora: tappa 3 (sempre a squadre Rossa
contro Blu, 4 contro 4, bot «medi» nei posti vuoti, squadra scelta all'inizio), mani con le dita, arma dei soldati
lungo le due mani, mira con il tasto destro per tutte le armi camminando. Tutto provato con le prove automatiche e
nell'anteprima con messaggi finti; i bot veri si vedono solo su staging. Tutto portato su `main` nella 1.0.72, su
richiesta del proprietario, prima della prova nell'app.

**F1 on paper! con i bot** (`docs/f1-on-paper.md`, voce «Bot»): in tutti e tre i modi si scelgono «Piloti» e «Bot»,
al massimo 8 auto in tutto: «Contro l'IA» tu più da 1 a 7 bot, «Stesso telefono» piloti a turno più bot che muovono da
soli, online persone più bot (cambiabili in sala d'attesa da chi crea). Scelte del proprietario: posti liberi vuoti al
via, bravi come l'IA di oggi; nomi «Bot 1, Bot 2…». Tutto su staging e su `main` (1.0.72). Ultimo passo: online si parte sempre da 0 bot (prima un
bot salvato poteva prendersi l'unico posto libero, e all'altro non restava posto), e «Gioca» / il cabinet porta nella
gara online aperta (la tua, o una che aspetta piloti) invece di aprire una gara nuova.

## Da provare

- Lobby 3D tra amici (non in un commit): il salto ora si vede anche dagli altri (contatore `jump` nella posa, come i
  colpi; il server lo lascia passare, `worker.js`; chi guarda fa lo stesso salto, `peerJump`). Abbassarsi, parata e
  colpi arrivavano già: controllati con la prova `test:multiplayer-runtime`. Da provare in due nell'app.
- Zona Operativa (non in un commit): bot un po' più facili e arma principale a rotazione a ogni rinascita
  (Calabrone → Tuono → Ruggito → Falco). Da provare giocando.

- Zona Operativa al computer: ora si cammina e si corre tenendo Maiusc (prima era il contrario). Nella 1.0.73.
  Dopo, su staging (non ancora su `main`): camminata alla velocità della corsa di prima (5,2 m/s), corsa più
  veloce (7 m/s), sul telefono si corre con la levetta in fondo, saltando si sale su pietre, casse e ostacoli bassi
  (fino a circa 1,4 m). Da provare nell'app: velocità giuste? il salto sulle pietre riesce bene?
- Zona Operativa, arma in mano (su staging, non ancora su `main`): senza mirare la canna punta al mirino, mirando l'arma si
  raddrizza e la tacca sta al centro. Vista nell'anteprima solo con la pistola: guardare anche le altre armi.
- Zona Operativa, mappa e ambiente: scelte del proprietario in `docs/zona-operativa.md` (Tappa 4, «Mappa e ambiente
  più belli»). Mappa in Blender (non in un commit, approvata passo passo dal proprietario): ripari nuovi, vita del
  borgo, trame con rilievo su tutto, case e torri meno da prefabbricato, terremoto (56 case su 84 mezze crollate),
  rocce arrotondate, sabbia ai muri, ai massi e dune al muro di cinta; GLB compresso con Draco (7,8 MB, lettore in
  `public/vendor/three/addons/`), urti rigenerati, prove della mappa passate. Piante e acqua fatte (non in un
  commit): due oasi uguali col pozzo, palme, cespugli, fichi d'India, erba secca; GLB 8,2 MB, circa 750.000
  triangoli. Da fare: provarla sul telefono (scalda? scatta? quanto ci mette a caricare); se scatta, togliere
  l'ombra a erba e cespugli o diradarli. Restano i dettagli sui muri (scritte, manifesti, tende alle porte).
- Zona Operativa, mirare (non in un commit): tacche di mira vere su Baretta (tre puntini), Calabrone (diottra e palo)
  e Tuono (perline), lente ×2 per il Ruggito. Nell'anteprima provata la Baretta mirando (lama al centro della
  tacca); da provare giocando Calabrone, Tuono e la lente del Ruggito, anche sul telefono.
- Zona Operativa, mirare (non in un commit): Ruggito con la lente ×1,5 dentro il mirino (prima lente ×2 a schermo
  nero, scartata); mirando a fondo l'arma sta ferma (il Calabrone «un po' storto»: i numeri dicono che da fermo è
  dritto e centrato, ondeggiava muovendo la vista). Da provare giocando.
- Zona Operativa, richieste del proprietario per il codice (28 novembre, da fare quando si lavora sul codice): **più armi
  a terra** (più punti di raccolta: i punti stanno nella mappa, raccolta `punti`), **si deve capire da dove arriva uno
  sparo** (segno a schermo e/o suono che viene dalla sua direzione), **audio migliore** («fa pena»).

- F1 on paper! con i bot: «Contro l'IA» con 7 bot sul telefono (il telefono regge? i bot ci mettono troppo a
  pensare?); «Stesso telefono» con 2-3 piloti e qualche bot; online su staging la sala d'attesa con i tasti dei bot,
  l'avviso nella campanella e una gara con un bot; in due, uno crea la gara e l'altro entra dal cabinet.

- Zona Operativa, poligono di tiro, nel computer e nel telefono: muoversi, prendere le armi al bancone, sparare,
  ricaricare, mirino del Falco, sfida di 60 secondi, suoni, Esci. Guardare se le braccia e le armi stanno bene in
  vista e se il telefono regge.

- Zona Operativa col mouse libero (l'amico con due monitor): portando il mouse al bordo della finestra la vista
  deve continuare a girare, a 360°.

- Zona Operativa a squadre con i bot, anche da soli: scelta della squadra, i bot che girano e sparano (troppo
  bravi o troppo scarsi?), punteggio delle squadre, mani e mira con il tasto destro.

- Zona Operativa online, in due su staging (meglio telefono contro computer): «Gioca online», ci si vede e ci si
  spara, salute, eliminazioni, rinascita dopo 3 s, armi a terra che spariscono e tornano dopo 20 s, casse mediche,
  classifica con Tab e a fine partita (5 minuti). Guardare se il movimento degli altri è liscio, se i colpi «dove si
  vedeva» contano, se la scala della torre centrale si sale, e come stanno le armi in mano ai soldati. Nel poligono,
  in due: ci si vede, si sentono gli spari dell'altro, i colpi lo attraversano.

- Zona operativa nell'app vera, sul telefono: entrare, arrivare in fondo, uscire con «Esci» e ritrovarsi nel
  corridoio. Guardare che la Lobby torni normale (luci, radio, persone) e che il telefono non scaldi.

- Forza 4 vero sul tavolo 3D, con due persone: una gioca, l'altra guarda il tavolo nella sala tavoli e vede i
  gettoni comparire; a partita chiusa la griglia torna vuota.

Il resto è a posto. Il 26 novembre il proprietario ha visto la Lobby 3D nuova nell'app vera e ha fatto le prove del balilla
(gol contato e fine partita sul server vero, posto tenuto 30 secondi con l'app nascosta): tutto a posto. Il
ripristino di un backup è stato provato sull'app di prova (Impostazioni → Backup). Lo schermo intero funziona su
Telegram Desktop; su Telegram Web il tasto non fa niente, perché Telegram Web non lo permette.

## Rimandato

- Sala tavoli: la partita vera anche sugli altri tavoli (dopo Forza 4): Scacchi, Dama, carte, Scarabeo,
  Battaglia navale.
- Lobby 3D, meno oggetti disegnati (analisi 3.4 e 3.5): da riprendere se il telefono scalda. Prima guardare i
  numeri in Debug → «Misure della Lobby 3D».
- Dividere `public/lobby3d/lobby3d.js` e `public/app.js` in pezzi, uno per volta, con un piano.
- F1 on paper!: salvare le mosse a blocchi sul server (analisi 11.8).
- Punti facoltativi dell'analisi ancora aperti: 4.4, 4.8, 4.11, 4.12, 7.6, 7.9, 7.10, 7.11, 7.13.

## Decisioni già prese (non riproporre)

**In generale**

- Nomi unici: «Impostazioni» e «Lavagna», non «Settings» e «Blackboard».
- Tolti per scelta: Labyrinth, il flipper a pagina intera, lo Sprint di F1.
- Costi e limiti di Cloudflare non interessano: l'app la usano al massimo 7-8 persone.
- Niente qualità automatica per i telefoni lenti.
- Per ora poche analisi nuove.
- Avvisi dei giochi nella campanella, non nella chat (dalla 1.0.30). Nella Lobby 3D stanno sulla bacheca: aperta
  con «Apri», ogni avviso ha il suo tasto (Entra, Riprendi…), come nella campanella (dalla 1.0.44).
- Commit solo quando lo chiede il proprietario; il push lo fa Claude solo dopo il suo sì in chat, uno per volta
  (o lui da GitHub Desktop).
- Le informazioni di lavoro su Binottoland stanno solo qui nel repo (`CLAUDE.md`, questo file, i documenti dei
  giochi), non nelle note di Claude.

**F1 on paper!**

- In gara tutti scelgono la mossa insieme e si aspetta l'ultimo; sulla linea di partenza ci si mette a turno.
- La pista è approvata se sulla linea verde c'è posto per tutte le auto affiancate; non conta la larghezza.
- Niente colline, niente replay a fine gara, niente doppio tocco per muovere, niente griglia di partenza sfalsata.
- Niente avviso Telegram «tocca a te»: si gioca insieme, con il minuto per mossa.
- Bot in tutti e tre i modi (Contro l'IA, Stesso telefono, online), piloti più bot al massimo 8 auto; online li sceglie
  chi crea e li cambia in sala d'attesa, i posti liberi restano vuoti al via; guidano come l'IA di oggi.
- Due marchi distinti: «Binotto Corsa Competizione» (uno sponsor tra gli altri) e «Binottoland». Mai foto di
  persone come loghi.

**Calcio balilla** (tutto in `docs/balilla.md`)

- La pallina esce con Spazio dal computer o con un tocco al centro dal telefono, chiunque sia seduto.
- I punti contano solo da due giocatori in su; il punteggio non si azzera a mano.
- La taratura sul telefono (ingranaggio con i quattro cursori) resta.

**Lobby 3D**

- Stile A «Circolo italiano anni '60» per pareti e finiture; i mobili della sala tavoli invece sono moderni.
- Modanature lunghe fatte in codice, oggetti singoli in Blender.

**Altri giochi**

- Acquedotto!: suono dell'acqua rilassante, pochissime bolle, niente fruscio; acqua trasparente e fluida.
- Biliardo: regole ufficiali; fisica sempre uguale su tutti i dispositivi (niente `sin`, `cos`, `exp` in
  `physics.js`).
- Ruggine 89: piste create dal codice; Blender eventualmente solo per i modelli. È un gioco originale.
- Zona Operativa: tutte le scelte (nome, modalità, 8 persone più bot, 5 minuti, armi a terra, 4 armi più coltello,
  deserto, low-poly, comandi, menù) stanno in `docs/zona-operativa.md`. Niente di Counter-Strike, nemmeno la pianta
  delle sue mappe.
