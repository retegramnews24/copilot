# Stato dei lavori

Una pagina sola, da leggere all'inizio di ogni sessione e da aggiornare alla fine. Qui non si racconta cosa è stato
fatto (quello è nella storia dei commit): si scrive solo cosa serve per ripartire.

Aggiornato il 26 novembre 2026.

## Versioni

- `main`: **1.0.70**: sala cinema nuova della Lobby 3D. Le 8 prove passate. (1.0.69: backup dall'app; 1.0.68:
  Lobby 3D nuova.)
- `staging`: 1.0.70, uguale a `main` (`branch-diff`: nessuna differenza).

## In corso

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

La sala tavoli è finita: ogni gioco ha i suoi pezzi veri sul tavolo (Forza 4, carte, Scarabeo, della Lobby 3D finita: ogni gioco ha i suoi pezzi veri sul tavolo (Forza 4, carte, Scarabeo,
Battaglia navale, Scacchi e Dama), come dati nei file `public/lobby3d/table-*.js` e `connectFour` in `lobby3d.js`,
così più avanti il tavolo potrà mostrare la partita vera. Sedie ai lati corti, ogni giocatore ha i suoi pezzi
davanti.

## Da provare

Niente. Il 26 novembre il proprietario ha visto la Lobby 3D nuova nell'app vera e ha fatto le prove del balilla
(gol contato e fine partita sul server vero, posto tenuto 30 secondi con l'app nascosta): tutto a posto. Il
ripristino di un backup è stato provato sull'app di prova (Impostazioni → Backup). Lo schermo intero funziona su
Telegram Desktop; su Telegram Web il tasto non fa niente, perché Telegram Web non lo permette.

## Rimandato

- Sala tavoli: mostrare sul tavolo 3D la partita vera, come Pong sul televisore, così chi guarda non deve entrare
  nel gioco.
- Lobby 3D, meno oggetti disegnati (analisi 3.4 e 3.5): da riprendere se il telefono scalda. Prima guardare i
  numeri in Debug → «Misure della Lobby 3D».
- Dividere `public/lobby3d/lobby3d.js` e `public/app.js` in pezzi, uno per volta, con un piano.
- F1 on paper!: salvare le mosse a blocchi sul server (analisi 11.8).
- Punti facoltativi dell'analisi ancora aperti: 4.4, 4.8, 4.11, 4.12, 7.6, 7.9, 7.10, 7.11, 7.13.
- Avvisi dei giochi: toglierli dalla chat della Lobby (restano solo nella campanella) e renderli cliccabili sul
  pannello della Lobby 3D.

## Decisioni già prese (non riproporre)

**In generale**

- Nomi unici: «Impostazioni» e «Lavagna», non «Settings» e «Blackboard».
- Tolti per scelta: Labyrinth, il flipper a pagina intera, lo Sprint di F1.
- Costi e limiti di Cloudflare non interessano: l'app la usano al massimo 7-8 persone.
- Niente qualità automatica per i telefoni lenti.
- Per ora poche analisi nuove.
- Avvisi dei giochi nella campanella, non nella chat.
- Commit solo quando lo chiede il proprietario; il push lo fa Claude solo dopo il suo sì in chat, uno per volta
  (o lui da GitHub Desktop).
- Le informazioni di lavoro su Binottoland stanno solo qui nel repo (`CLAUDE.md`, questo file, i documenti dei
  giochi), non nelle note di Claude.

**F1 on paper!**

- In gara tutti scelgono la mossa insieme e si aspetta l'ultimo; sulla linea di partenza ci si mette a turno.
- La pista è approvata se sulla linea verde c'è posto per tutte le auto affiancate; non conta la larghezza.
- Niente colline, niente replay a fine gara, niente doppio tocco per muovere, niente griglia di partenza sfalsata.
- Niente avviso Telegram «tocca a te»: si gioca insieme, con il minuto per mossa.
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
