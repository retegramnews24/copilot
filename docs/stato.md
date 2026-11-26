# Stato dei lavori

Una pagina sola, da leggere all'inizio di ogni sessione e da aggiornare alla fine. Qui non si racconta cosa è stato
fatto (quello è nella storia dei commit): si scrive solo cosa serve per ripartire.

Aggiornato il 26 novembre 2026.

## Versioni

- `main`: **1.0.69**: Lobby 3D nuova (dalla 1.0.68) e backup dall'app per il proprietario. Le 8 prove passate.
- `staging`: 1.0.69, uguale a `main` (`branch-diff`: nessuna differenza).

## In corso

Niente. Sala tavoli della Lobby 3D finita: ogni gioco ha i suoi pezzi veri sul tavolo (Forza 4, carte, Scarabeo,
Battaglia navale, Scacchi e Dama), come dati nei file `public/lobby3d/table-*.js` e `connectFour` in `lobby3d.js`,
così più avanti il tavolo potrà mostrare la partita vera. Sedie ai lati corti, ogni giocatore ha i suoi pezzi
davanti.

## Da provare

- Backup dall'app (Impostazioni → Backup, solo per il proprietario), nella 1.0.69. Provato il 26 novembre
  sull'app di prova: il proprietario è riconosciuto (creatore del gruppo), il bot manda il file in chat, una X
  disegnata sulla lavagna dopo il backup sparisce col ripristino.

- La Lobby 3D nuova (stile «Circolo», arredi di Blender, tavoli e sedie moderni, pezzi veri su tutti i tavoli) è
  già su `main` ma non è ancora stata vista dentro Telegram: guardarla nell'app vera e fare i controlli a mano di
  `docs/controlli-prima-del-rilascio.md`.

## Rimandato

- Sala tavoli: mostrare sul tavolo 3D la partita vera, come Pong sul televisore, così chi guarda non deve entrare
  nel gioco.
- Lobby 3D, meno oggetti disegnati (analisi 3.4 e 3.5): da riprendere se il telefono scalda. Prima guardare i
  numeri in Debug → «Misure della Lobby 3D».
- Dividere `public/lobby3d/lobby3d.js` e `public/app.js` in pezzi, uno per volta, con un piano.
- F1 on paper!: salvare le mosse a blocchi sul server (analisi 11.8).
- Punti facoltativi dell'analisi ancora aperti: 4.4, 4.8, 4.11, 4.12, 7.6, 7.9, 7.10, 7.11, 7.13.
- Prove che mancano (analisi 9.11): gol contato e fine partita del balilla sul server vero; posto tenuto 30
  secondi con l'app nascosta.
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
