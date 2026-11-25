# Analisi di Binottoland Playground

Analisi in sola lettura, fatta il 24 novembre 2026 sul ramo `staging`.

- **Area 1: sicurezza e server**, letta sul commit `33ef835`.
- **Area 2: multigiocatore**, letta sul commit `005b97d`, cioè dopo i tre commit «Sicurezza (analisi Fable, gruppo 1, 2 e 3)».

- **Area 3: Lobby 3D su telefono**, letta sul commit `dcbc5e6` (dopo i quattro commit «Multigiocatore (analisi Fable, area 2)»).
- **Area 4: fisica e regole dei giochi**, letta sul commit `dbb8d06` (dopo i commit «Lobby 3D (analisi Fable, area 3…)»).
- **Area 5: qualità del codice**, letta sul commit `ba287b1` (dopo i commit del calcio balilla del 25 novembre).
- **Area 6: staging contro main**, fatta il 25 novembre 2026 confrontando `staging` al commit `a7a56b9` con `main` al commit `a615b09` (versione 1.0.60).
- **Area 7: prove** e **Area 8: esperienza d'uso**, fatte il 25 novembre 2026 su `staging` al commit `ed88d2a` (versione 1.0.61, Labyrinth e Sprint già tolti).

Le altre aree verranno aggiunte allo stesso modo.

**Area 1 e produzione.** Quando ho scritto l'Area 1 il codice del server su `main` (`d2c9a02`, versione 1.0.57) era uguale a quello di `staging`, tranne quattro differenze piccole. Ora `staging` ha in più i tre commit di sicurezza, che su `main` non ci sono ancora: quindi i problemi dell'Area 1 valgono ancora per la produzione. Su `staging` risultano affrontati; rileggendo per l'Area 2 ho visto le correzioni dei punti 1, 2, 3, 4, 5, 8, 9 e 10, gli altri non li ho ricontrollati.

**Area 2 e produzione.** Per ogni problema dell'Area 2 è scritto se c'è solo su `staging` o anche su `main`. Due problemi sono nati proprio dalle correzioni di sicurezza e vanno sistemati prima di portarle su `main`.

**Legenda**

- **[V]** verificato leggendo il codice.
- **[S]** sospetto: il meccanismo è nel codice, ma l'effetto reale va confermato con una prova.
- Gravità: alta, media, bassa.

**Cosa ho letto per intero:** `worker.js`, `api.js`, `auth.js`, `worker-shared.js`, `lobby-hub.js`, `balilla-hub.js`, `club-pinball.js`, `club-stools.js`, `leaderboard.js`, `match-series.js`, `table-rules.js`, `cinema-server.js`, `cinema-routes.js`, `cinema-telegram.js`, `cinema-media.js`, `cinema-youtube.js`, `blackboard-server.js`, `turn-notices.js`, `telegram-bot.js`, `backup.js`, `radio-metadata.js`, `pong-server.js`, `golf-server.js`, `f1-server.js`, `biliardo-server.js`, `moto-trial-server.js`, `labyrinth-server.js`, `simulator/server.js`, `staging-worker.js`, `wrangler.jsonc`, `scripts/deploy-gate.mjs`.

**Cosa ho letto solo in parte** (ricerche mirate): le regole dei giochi di carte (solo la parte che decide cosa vede ogni giocatore), `public/lobby3d/balilla-rules.js`, `public/arcade/number-connect-rules.js`, `public/app.js` e `public/lobby3d/lobby3d.js` (solo quanto spesso scrivono al server).

**Cosa non ho letto:** `simulator/engine.js` e il resto del simulatore, `expedition-model.js`, `table-ai.js`, `table-strategy.js`.

**Area 2, cosa ho letto per intero:** `balilla-hub.js`, `biliardo-server.js`, `f1-server.js`, `pong-server.js`, `worker.js`, `lobby-hub.js`, `worker-shared.js`, `socket-limits.js`, `club-stools.js`, `club-pinball.js`, `public/lobby3d/balilla.js`, `public/f1-link.js`, `public/biliardo-link.js`, `public/arcade-link.js`. **Solo in parte:** `public/app.js` (collegamenti e presenze), `public/lobby3d/lobby3d.js` (sgabelli, pose, cabinati, altri giocatori), `public/lobby3d/flipper3d.js`, `public/gara/main.js` e `public/biliardo/main.js` (la parte online), `public/arcade/pong.js`, `golf-server.js` (solo l'invio del risultato). **Non letti:** la fisica e le regole dei giochi (`public/biliardo/engine.js`, `public/gara/rules.js`, `balilla-rules.js`), Moto Trial e Labyrinth online.

---

## I problemi più importanti dell'Area 8 (esperienza d'uso)

**Come leggere quest'area.** Ho letto le scritte e il codice dei comandi, e ho raccolto con un programma tutte le scritte visibili (1.092) e tutti i messaggi d'errore (353). **Non ho guardato l'app su un telefono né su Telegram Desktop**: quello che il codice mostra o non mostra è **[V]**; come appare davvero è da controllare a occhio. Il codice distingue solo «telefono» e «computer», mai Android da iPhone: le differenze tra i due sono quelle tecniche dell'Area 3.

| # | Problema | Dove si sente | Gravità | Stato |
|---|---|---|---|---|
| U1 | Calcio balilla senza nessuna scritta di stato: non dice se sei seduto, se il lato è pieno, se la partita è in pausa, a chi tocca la pallina | telefono e computer | media | [V] |
| U2 | I messaggi d'errore finiscono sotto la Lobby 3D, che dopo un secondo e mezzo si riapre da sola e li copre. Nella 3D non c'è nemmeno il segno «collegamento perso» | telefono e computer | media | [V] |
| U3 | Comandi che non si possono scoprire: tasti dei flipper, del balilla, dello sgabello, di Pong; e il mouse «agganciato» che si libera con Esc senza che sia scritto | computer | media | [V] |
| U4 | Scritte da tastiera mostrate sul telefono: «PREMI E PER GIOCARE» sui flipper, «Prendi · G», «↑ W», «↓ S» sui tasti dello sgabello | telefono | media | [V] |
| U5 | Comandi del telefono senza nome o spiegazione: i due pad ↕ e 🔍 del balilla, la «Taratura» con numeri grezzi, la zona della leva del flipper non segnata | telefono | media-bassa | [V] |
| U6 | Nomi diversi per la stessa cosa: Settings e Impostazioni, Blackboard e Lavagna, tavolo/sala/stanza/partita/gara, tre modi di dire «non tocca a te» | telefono e computer | media-bassa | [V] |
| U7 | Al balilla su computer Esc libera il mouse ma ti fa anche alzare dal tavolo | computer | media-bassa | [V] |
| U8 | Con la 3D aperta il tasto Tab porta sui tasti della pagina sotto, che non si vedono | computer | bassa | [V] |
| U9 | Inglese rimasto: «Settings», «Debug», «Live», «Blackboard», «DNS unavailable»; messaggi tecnici («WebSocket richiesto.») e generici («Richiesta non valida.») | telefono e computer | bassa | [V] |
| U10 | Caratteri piccoli (288 punti sotto i 12 px, fino a 7 px nel Simulator) e un testo di Informazioni non più vero | telefono e computer | bassa | [V] |

Il dettaglio è nella sezione «Area 8: esperienza d'uso», più sotto.

---

## I problemi più importanti dell'Area 7 (prove)

**Come leggere quest'area.** Ho letto le prove e le ho fatte girare molte volte in condizioni diverse (fuso orario, computer occupato, date particolari, ripetizioni). **[P]** = provato facendole girare. Niente è stato modificato; i programmi che le lanciano sono fuori dal repo.

**In breve:** le prove sono tante e solide: 61 file, circa 2.280 controlli, tutti gli 8 passi passano in circa due minuti e mezzo. In 1.331 esecuzioni ripetute ne è fallita a caso una sola. Il buco vero è quello che non ha prove: il 40% del codice del telefono, quasi tutto 3D.

| # | Problema | Gravità | Stato |
|---|---|---|---|
| T1 | Una prova fallisce a caso circa 2 volte su 100 (`tests/table-rules.test.js`), nel passo «Test principali»: può bloccare una pubblicazione su `main` senza che ci sia un errore | media | [V] [P] |
| T2 | La numerazione di tavoli e sale non ha più prove: erano dentro la parte di Labyrinth | media | [V] |
| T3 | Il 40% del codice del telefono non ha nessuna prova (53 file, 923 KB): tutta la Lobby 3D, le scene 3D e i programmi principali di Biliardo e F1, Acquedotto, Ruggine, la radio | media | [V] |
| T4 | Il collegamento della Lobby non è provato: né il «ping» sul server, né la riapertura sul telefono | media | [V] |
| T5 | Calcio balilla a più giocatori provato solo con collegamenti finti dentro il modulo: mai attraverso il server vero, mai il ripristino dopo una pausa del server | media-bassa | [V] |
| T6 | Lavagna quasi senza prove; fisica del flipper Binotto GT senza prove | media-bassa | [V] |
| T7 | Prove che dipendono dai tempi veri: una ha 10 millisecondi di margine. Oggi reggono anche a computer occupato | bassa | [V] [P] |
| T8 | Due prove a copione unico (253 e 320 controlli in fila): il primo errore nasconde tutti gli altri. Una ha ancora il nome di Labyrinth | bassa | [V] |
| T9 | Le partite complete usano il caso vero: se una fallisce non si può rifare uguale | bassa | [V] |

Il dettaglio è nella sezione «Area 7: prove», più sotto.

---

## I punti più importanti dell'Area 6 (staging contro main)

**Come leggere quest'area.** È un confronto fatto con git tra i due rami, file per file, quindi tutto è **[V]**. Non ho provato niente nell'app. I due rami oggi sono quasi uguali: su 22 file diversi, solo 2 esistono soltanto su `staging` e nessuno soltanto su `main`.

| # | Cosa | Dove | Proposta |
|---|---|---|---|
| S1 | **Ruggine 89 non è solo su staging: è già in produzione.** I sette file sono identici sui due rami e il cabinato è nella sala giochi della Lobby 3D di `main` | `public/ruggine/`, `public/lobby3d/lobby3d.js` | decidere se va bene così (vedi rischio R6) |
| S2 | Lo «Sprint» di F1 è solo su staging, in sette file | `public/gara/` | togliere da staging: dopo, F1 torna identico a `main` |
| S3 | La ripresa del posto al balilla con una connessione nuova è solo su staging, con la sua prova | `balilla-hub.js`, `tests/balilla-bar.test.mjs` | portare su `main` |
| S4 | La rimessa automatica della palla in allenamento guarda solo le aste di chi gioca: solo su staging (una riga) | `public/lobby3d/balilla-rules.js` | portare su `main` |
| S5 | File di Blender: sono tutti su tutti e due i rami, tranne il sorgente dell'auto di F1 | `blender/auto.blend` | portare su `main` |
| S6 | Nella cartella di staging ci sono cose fuori da git: un modello modificato e non salvato, nove copie di sicurezza di Blender | `blender/` | decidere e mettere `*.blend1` tra i file ignorati |
| S7 | File dell'ambiente di prova diversi apposta (prove su GitHub, cancello di pubblicazione, documento) | `.github/`, `scripts/`, `wrangler.jsonc`, `docs/` | portare su `main`, così i file diventano uguali; il documento va prima aggiornato |
| S8 | Numero di versione: 1.0.51 su staging, 1.0.60 su `main`, più i timbri `?v=` che ne discendono | sei file | allineare staging a `main` dopo ogni rilascio |

Il dettaglio è nella sezione «Area 6: staging contro main», più sotto.

---

## I problemi più importanti dell'Area 5 (qualità del codice)

**Come leggere quest'area.** Qui non ci sono errori che l'utente vede: sono cose che rendono il codice più lento da cambiare e più facile da rompere. I numeri vengono da piccoli programmi di misura fatti girare sul repo (fuori dal repo, niente è stato modificato), poi controllati a mano nei punti citati. Il codice misurato: 56 file sul server (479 KB), 128 sul telefono (2.108 KB), 65 file di prove (467 KB).

| # | Problema | Gravità | Stato |
|---|---|---|---|
| Q1 | La Lobby 3D è una sola funzione da 2.026 righe (137 KB) che fa tutto | media | [V] |
| Q2 | I due flipper sono due copie della stessa fisica (77% uguale): ogni correzione va fatta due volte, e già oggi non coincidono | media | [V] |
| Q3 | I collegamenti dei giochi online sono copiati tra F1, Biliardo e Golf, sul telefono e sul server | media | [V] |
| Q4 | Sul server gli errori veri dei giochi vengono mascherati: diventano «409» con il messaggio grezzo e non finiscono nei log | media | [V] |
| Q5 | Codice morto e provvisorio rimasto dentro: computer del balilla, pannello nascosto, taratura provvisoria, pagine e file che nessuno apre | media-bassa | [V] |
| Q6 | Labyrinth è «ritirato» ma è ancora tutto nel repo, con sei file di prove e un passo intero della CI | media-bassa | [V] |
| Q7 | Due modi di scrivere il codice; il controllo di formattazione copre un file su tre | media-bassa | [V] |
| Q8 | Piccoli pezzi ripetuti in decine di file (risposta JSON, lettura dell'utente, memoria del telefono, tocco, vibrazione) | bassa | [V] |
| Q9 | Gli errori dentro i giochi nei riquadri non arrivano ai log; alcuni errori di rete vengono ignorati in silenzio | bassa | [V] |
| Q10 | Piccole incoerenze: lingua dei commenti, codici d'errore, commenti rimasti indietro, un aggancio di prova lasciato acceso | bassa | [V] |

Il dettaglio è nella sezione «Area 5: qualità del codice», più sotto.

---

## I problemi più importanti dell'Area 4 (fisica e regole)

**Come leggere quest'area.** Oltre a leggere il codice l'ho fatto girare: flipper, calcio balilla e biliardo sono codice "puro", quindi li ho simulati con dei piccoli programmi di prova (fuori dal repo, niente è stato modificato). Per questo c'è un segno in più: **[P]** = provato in simulazione. I numeri delle prove sono in fondo alla sezione dell'area.

**In breve:** la fisica regge bene. In circa 5 ore di flipper e balilla simulati e 110.000 colpi di biliardo non è mai uscito un numero non valido, una pallina fuori dal tavolo o una partita che non finisce. I problemi trovati sono casi limite precisi.

| # | Problema | Gravità | Stato |
|---|---|---|---|
| G1 | Snooker: dopo «bianca in buca» la bianca viene rimessa nella D anche se lì c'è già una bilia: restano una dentro l'altra | media | [V] [P] |
| G2 | Flipper Grand Prix: con la leva lasciata a forza zero la pallina resta ferma per sempre sul cancelletto in cima alla corsia | media | [V] [P] |
| G3 | Calcio balilla: una palla ferma che una sola squadra può raggiungere resta lì per sempre se quella squadra non la tocca (nessun limite di possesso) | media-bassa | [V] [P] |
| G4 | Calcio balilla: il 14,5% del campo è irraggiungibile (soprattutto le quattro zone ai lati delle porte): palla rimessa dal foro molto spesso | media-bassa | [V] [P] |
| G5 | Calcio balilla: una palla lenta che supera la riga di porta ma si ferma subito dopo non è gol e viene rimessa | bassa | [V] [P] |
| G6 | Biliardo: un colpo con direzione esattamente «di traverso» (dx = 0) parte in diagonale | bassa | [V] [P], oggi non raggiungibile dal gioco |
| G7 | Flipper, multiball: la pallina che passa sulla rampa urta le palline sul piano sotto di lei | bassa | [V] [P] |
| G8 | Flipper: la fisica crea 8-10 mila oggetti da buttare al secondo | bassa | [V] il codice, [S] quanto pesa |
| G9 | Palla 8: se il colpo arriva senza buca chiamata, la nera vale in qualunque buca | bassa | [V] |
| G10 | 5 birilli: due regole da confrontare con il regolamento | bassa | [S] |

Il dettaglio è nella sezione «Area 4: fisica e regole dei giochi», più sotto.

**Cosa ho letto per intero:** `public/flipper/physics.js`, `public/lobby3d/balilla-rules.js`, `public/biliardo/physics.js`, `public/biliardo/engine.js`. **Solo in parte:** `public/flipper/physics-gt.js` (tavolo e rampe; il resto è la stessa fisica e l'ho provato in simulazione), `public/biliardo/main.js` (solo il ciclo del colpo). **Non letti:** `public/biliardo/ai.js`, `public/lobby3d/balilla-ai.js` (il computer), Golf, Moto Trial, Pong e F1 (non erano nell'elenco).

---

## I problemi più importanti dell'Area 3 (Lobby 3D su telefono)

**Come leggere quest'area.** Ho letto il codice, non ho misurato niente su un telefono. Quindi **[V]** qui vuol dire «il codice fa davvero questo», mentre quanto pesa (fotogrammi al secondo, batteria, megabyte) è una stima segnata **[S]**. Il primo passo consigliato è misurare (proposta 3.1).

| # | Problema | Gravità | Stato |
|---|---|---|---|
| L1 | I due flipper ridipingono il vetro del tabellone 30 volte al secondo e lo rimandano alla scheda grafica, sempre, anche se sei in un'altra sala | alta | [V] il codice, [S] quanto pesa |
| L2 | Nessun limite ai fotogrammi e nessuna pausa da fermi: tutta la scena si ridisegna 60, 90 o 120 volte al secondo | alta | [V] |
| L3 | Troppi oggetti separati, disegnati anche dietro i muri; un personaggio intero per ogni persona collegata, senza tetto | alta | [V] il codice, [S] i numeri |
| L4 | Troppe luci per fotogramma (fino a 12 in sala biliardo); le luci dei flipper sfuggono allo spegnimento per sala | media-alta | [V] |
| L5 | Il film del cinema si scarica e si decodifica ovunque nella Lobby 3D, e già durante lo splash | media | [V] |
| L6 | Su iPhone i volumi "a distanza" non funzionano: radio a tutto volume ovunque, anche in sala cinema sopra il film | media | [V] il codice, [S] da provare su iPhone |
| L7 | Se la grafica 3D non parte: splash di 26 secondi, poi un errore ogni secondo e mezzo, senza modo di passare alla Lobby classica | media | [V] la logica, [S] quanto è frequente |
| L8 | Mini app ridotta a icona in Telegram: la 3D, la radio e il collegamento possono restare accesi | media | [V] manca il codice, [S] il comportamento di Telegram |
| L9 | Nessuna qualità ridotta per i telefoni lenti; sfocatura dietro ogni tasto sopra la scena | media-bassa | [V] il codice, [S] quanto pesa |
| L10 | Memoria: circa 65-70 MB di disegni tenuti in RAM più altrettanti sulla scheda grafica, e restano caricati mentre giochi a un altro gioco 3D | media-bassa | [V] le misure delle tele, [S] il totale |

Il dettaglio è nella sezione «Area 3: Lobby 3D su telefono», più sotto.

**Cosa ho letto per intero:** `public/lobby3d/lobby3d.js`, `textures.js`, `balilla.js`, `balilla-sounds.js`, `public/window-mode.js`, `public/safe-area.js`. **Solo in parte:** `flipper3d.js` (costruzione, comandi, suoni, aggiornamento), `character.js` (come si costruisce un personaggio), `public/radio.js` (parte del club), `public/app.js` (avvio, Telegram, splash), `public/splash/intro.js`, `public/app.css` (margini sicuri). **Non letti:** `flipper-art.js` e `gt-art.js` (i disegni), la fisica dei flipper, `public/biliardo/scene3d.js`, i modelli `.glb` (quanti pezzi e quali texture contengono).

---

## I problemi più importanti dell'Area 2 (multigiocatore)

| # | Problema | Gravità | Dove c'è | Stato |
|---|---|---|---|---|
| A | Le vittorie di Biliardo, F1 e Golf online non arrivano più alla classifica né agli avvisi | alta | solo `staging` | [V] |
| B | F1 e Biliardo: se un giocatore esce a metà, gli altri aspettano un minuto a ogni suo turno fino alla fine, e solo chi ha creato la partita può chiuderla | alta | `staging` e `main` | [V] |
| C | Flipper: il punteggio si perde se il collegamento della Lobby cambia durante la partita (basta guardare una notifica) | media | solo `staging` | [V] |
| D | Calcio balilla: se uno dei due guarda un'altra app per un attimo, perde il posto e il punteggio torna 0-0 per tutti e due | media | `staging` e `main` | [V] |
| E | Sgabelli: dopo essere tornati da un'altra app il telefono ti crede ancora seduto (o con lo sgabello in mano) ma il server no | media | `staging` e `main` | [V] |
| F | Posti del balilla e sgabelli restano occupati da collegamenti "fantasma" | media-bassa | `staging` e `main` | [V] il codice, [S] per quanto tempo |
| G | Calcio balilla: la partita vive solo in memoria, a ogni pubblicazione il punteggio riparte da zero | media-bassa | `staging` e `main` | [V] |
| H | Pong: mentre ti ricolleghi un altro può prenderti il posto e la partita si azzera | bassa | `staging` e `main` | [V] |
| I | Nessun controllo che il collegamento sia davvero vivo: "In diretta" anche quando non lo è, comandi persi in silenzio | bassa | `staging` e `main` | [V] il codice, [S] quanto dura |
| J | F1 e Biliardo: se la rete cade o la sessione scade il gioco resta fermo senza dire niente | bassa | `staging` e `main` | [V] |

Il dettaglio di ognuno è nella sezione «Area 2: multigiocatore», più sotto.

**Aggiornamento del 24 novembre 2026: A e C corretti su `staging`** (modifiche non ancora in un commit).

- **A:** Biliardo, F1 e Golf mandano la chiave interna e segnalano nei log se la Lobby non registra il risultato. Prova nuova: `tests/arcade-result.test.mjs`.
- **C:** l'inizio della partita al flipper è salvato per persona nello spazio della Lobby (chiave `pinballStart:<id>`), non più nel collegamento; un inizio più vecchio di 3 ore non vale. Il telefono tiene in attesa inizio e punteggio se la Lobby è scollegata e li manda appena si ricollega. Prova aggiornata: `tests/pinball-top.test.mjs`.
- Non provato dal vivo su un telefono dentro Telegram.

---

## I 10 problemi più importanti dell'Area 1 (sicurezza e server)

| # | Problema | Gravità | Stato |
|---|---|---|---|
| 1 | Ogni passo nella Lobby 3D fa rispedire a tutti l'intera Lobby, senza limite di frequenza | alta | [V] |
| 2 | Lobby e tavolo possono bloccarsi a vicenda per 30 secondi | alta | [V] il ciclo, [S] quanto spesso |
| 3 | Se Telegram non risponde, i collegati vengono buttati fuori come se non fossero più del gruppo | alta | [V] il meccanismo, [S] quanto spesso |
| 4 | Una sola persona può occupare tutti i posti di collegamento della Lobby o di un tavolo | media | [V] |
| 5 | Il punteggio del flipper è quello che dichiara il telefono | media | [V] |
| 6 | Il controllo sulla grandezza delle richieste si può aggirare | media | [V] il codice, [S] l'effetto su Cloudflare |
| 7 | Lavagna: chiunque cancella qualsiasi lavagna, e non ci sono limiti a lavagne e tratti | media | [V] |
| 8 | Nessun limite alla creazione di sale, tavoli archiviati e sale Cinema | media | [V] |
| 9 | Le classifiche si possono gonfiare o negare | media | [V] |
| 10 | Dati personali mandati a tutti i collegati, e backup in chiaro su Telegram | media-bassa | [V] |

### 1. Ogni passo nella Lobby 3D fa rispedire a tutti l'intera Lobby

- **Dove:** `worker.js:685-752` (messaggio `presence`), `lobby-hub.js:155-171` (`lobbyBroadcast`), `lobby-hub.js:82-148` (`lobbyPayload`), `public/lobby3d/lobby3d.js:1841` (il telefono manda la posizione fino a 5 volte al secondo).
- **Cosa succede:** a ogni messaggio di posizione il server ricostruisce tutta la Lobby. Rilegge l'elenco dei tavoli, **tutti i risultati di sempre** (`lobby-hub.js:133`) e altri sette valori, ricalcola due classifiche e, siccome la posizione è cambiata, spedisce tutto a tutti i collegati: tavoli, 100 messaggi di chat, 30 avvisi, classifiche, sgabelli, persone.
- **Quando:** basta camminare. Con 10 persone che camminano e 20 collegate sono circa 50 ricostruzioni e 1.000 messaggi grandi al secondo. Il server non mette alcun limite, quindi un telefono modificato può mandarne molte di più.
- **Effetto:** Lobby lenta per tutti, consumo di dati sui telefoni, costi Cloudflare che crescono con il numero dei risultati salvati. La stima dei costi è [S].

### 2. Lobby e tavolo possono bloccarsi a vicenda

- **Dove:** `worker.js:293` (tutta la logica dentro `blockConcurrencyWhile`), `worker.js:84-89` e `90-102` (a ogni salvataggio il tavolo chiama la Lobby, se c'è un risultato), `lobby-hub.js:207-210` (la classifica chiama i tavoli finiti), `lobby-hub.js:331-338` (sedersi chiama il tavolo).
- **Cosa succede:** la Lobby, mentre è bloccata, aspetta la risposta del tavolo. Il tavolo, mentre è bloccato, aspetta la risposta della Lobby. Nessuno dei due può ricevere la richiesta dell'altro. Si sblocca solo dopo 30 secondi, quando Cloudflare azzera gli oggetti e tutti i collegati cadono.
- **Quando (caso 1):** qualcuno apre la classifica mentre un tavolo appena finito sta salvando (per esempio chi guarda il risultato, la prossima manche, la rivincita).
- **Quando (caso 2):** qualcuno chiede di sedersi a un tavolo di un torneo già in corso mentre lì si sta muovendo. Dalla seconda manche in poi ogni mossa chiama la Lobby. Il telefono normale non lo propone, ma un membro può farlo apposta e ripeterlo.
- **Da confermare:** quanto spesso capita per caso. La finestra è di pochi centesimi di secondo per richiesta.

### 3. Se Telegram non risponde, i collegati vengono buttati fuori

- **Dove:** `worker.js:216-242` (`guardSockets`, riga 232), `worker.js:621`, `auth.js:17-41`.
- **Cosa succede:** `memberAccess` risponde `null` quando Telegram non risponde, va in errore o chiede di rallentare. Per le richieste normali questo diventa "verifica temporaneamente non disponibile". Per i collegamenti in diretta invece `null` è trattato come "non sei del gruppo": collegamento chiuso con codice 4003.
- **Aggravanti:** il controllo gira a **ogni** messaggio ricevuto, per tutti i collegati. Non c'è nulla che eviti domande doppie a Telegram mentre una è già in corso. La memoria dura 60 secondi e scade per tutti quasi insieme.
- **Quando:** durante una partita a calcio balilla arrivano decine di messaggi al secondo. Allo scadere dei 60 secondi ognuno fa partire le sue domande a Telegram. Se Telegram ne rifiuta una, quella persona cade. Inoltre ogni messaggio aspetta Telegram (fino a 5 secondi) prima di essere eseguito.
- **Da confermare:** che Telegram rifiuti davvero in condizioni normali.

### 4. Una sola persona può occupare tutti i collegamenti

- **Dove:** `lobby-hub.js:243` (120 per la Lobby), `worker.js:342` (60 per tavolo), `cinema-server.js:204` (120 per il Cinema), `blackboard-server.js:123-124` (nessun limite).
- **Cosa succede:** il tetto è sul totale, non per persona.
- **Quando:** un membro apre 120 collegamenti alla Lobby e nessun altro entra. Senza Lobby non funzionano chat, presenze, Lobby 3D e calcio balilla. Su un tavolo, 60 spettatori finti impediscono ai giocatori stessi di collegarsi, perché giocatori e spettatori dividono lo stesso tetto.

### 5. Il punteggio del flipper è quello che dichiara il telefono

- **Dove:** `worker.js:673-679`, `club-pinball.js:9-26`.
- **Cosa succede:** il server accetta qualsiasi numero intero fino a 50 milioni. L'unico freno è uno ogni 20 secondi per collegamento.
- **Quando:** un membro manda `{"type":"pinball-score","score":50000000}` e resta primo per sempre. Non esiste un modo per togliere un punteggio.

### 6. Il controllo sulla grandezza delle richieste si può aggirare

- **Dove:** `worker.js:288-292` (guarda solo l'intestazione `Content-Length`), `lobby-hub.js:283` (`req.json()` senza limite, dentro il blocco della Lobby), `api.js:183`, `api.js:213`, `worker.js:412-413` (leggono tutto e controllano dopo).
- **Cosa succede:** se la richiesta arriva senza `Content-Length`, il controllo passa e il server legge tutto in memoria.
- **Quando:** un membro manda un messaggio di chat enorme a pezzi. La Lobby prova a leggerlo mentre è bloccata, finisce la memoria e cade per tutti.
- **Da confermare:** se Cloudflare aggiunge sempre `Content-Length` prima di consegnare la richiesta.

### 7. Lavagna: chiunque cancella qualsiasi lavagna

- **Dove:** `blackboard-server.js:357-361` e `305-322` (elimina), `99-117` (crea), `395-411` (tratti).
- **Cosa succede:**
  - Chi è dentro una lavagna può eliminarla con tutti i disegni, anche se non l'ha aperta. La colonna `owner` esiste ma non viene controllata. Vale anche per la lavagna 1, che poi non si ricrea più.
  - Nessun limite al numero di lavagne che una persona apre.
  - Nessun limite al numero di tratti né alla frequenza. Chi entra dopo deve ricevere tutta la storia.
- **Quando:** vandalismo di un membro, oppure un telefono che manda tratti in automatico.

### 8. Nessun limite alla creazione di sale, tavoli archiviati e sale Cinema

- **Dove:** `lobby-hub.js:396` (le sale arcade saltano la regola "un tavolo per gioco"), `lobby-hub.js:84` (i tavoli archiviati di tutti vanno a tutti), `worker.js:479-500` (archiviare), `cinema-server.js:310-322` (sale Cinema), `cinema-server.js:375-394` (lista condivisa).
- **Cosa succede:**
  - Sale di Pong, Golf, F1, Biliardo e Moto Trial senza limite e senza freno. Ognuna aggiunge un avviso nella campanella, che ne tiene solo 30.
  - Crea e archivia si può ripetere all'infinito. I tavoli archiviati non scadono mai e finiscono nel pacchetto spedito a tutti (vedi problema 1).
  - Un membro può aprire tutte le 24 sale Cinema in pochi secondi. Restano occupate un'ora.
  - Chiunque può svuotare la lista condivisa dei canali Cinema.

### 9. Le classifiche si possono gonfiare o negare

- **Dove:** `worker.js:584-595` (`/finish`), `worker.js:479-482` (`/delete`), `leaderboard.js`, `public/arcade/number-connect-rules.js:46-47`.
- **Cosa succede:**
  - Chi sta perdendo può chiudere o eliminare il tavolo. La partita finisce senza vincitore e l'altro non prende la vittoria.
  - Due persone d'accordo (o una con due account nel gruppo) possono farsi vittorie a ripetizione. Un Forza 4 si vince in 7 mosse e non c'è freno.
  - Number Connect: il bonus "combo" raddoppia i punti se il ritardo tra due mosse è sotto i 3 secondi, ma il ritardo lo dichiara il telefono.
  - La classifica contro il computer conta ogni vittoria, quindi si può far giocare un programma.

### 10. Dati personali mandati a tutti, backup in chiaro

- **Dove:** `lobby-hub.js:107-108` con `api.js:129`, `lobby-hub.js:84`, `backup.js:82-93` e `135-147`, `api.js:44-55`, `api.js:108`.
- **Cosa succede:**
  - A ogni collegato arrivano, per ogni persona online: numero identificativo Telegram, nome utente, foto e scadenza della sessione. Per disegnare la Lobby bastano nome e foto.
  - Il backup settimanale va in una chat Telegram come file leggibile: chat, identificativi, nomi, preferenze.
  - Non c'è modo di togliere i dati di chi lascia il gruppo (classifiche, flipper, chat recente).
  - La sessione di 12 ore si rinnova senza fine. Chi ruba un gettone lo tiene valido finché la vittima resta nel gruppo.

---

## Area 1: sicurezza e server

### 1.1 Accesso riservato e sessioni

**Controlli che ho trovato corretti [V]**

- Firma dei dati di Telegram, con scadenza a 5 minuti e rifiuto delle chiavi doppie (`auth.js:71-109`).
- Confronti a tempo costante (`auth.js:8-13`).
- Appartenenza al gruppo verificata a ogni richiesta `/api/`, con errore distinto se Telegram non risponde (`api.js:104-107`).
- Le intestazioni fidate (`X-Checkmate-User`, `X-Access-Tag`, `X-Session-Expires`) vengono sempre riscritte dal server: il telefono non può fingersi un altro (`api.js:128-132`).
- Controllo dell'origine sulle richieste del browser (`api.js:92-93`).
- Percorsi di amministrazione dietro `ADMIN_TOKEN` di almeno 24 caratteri (`api.js:60-80`).
- Webhook del bot con il suo segreto, configurazione spenta per default (`telegram-bot.js:23-31`, `56-60`).
- I percorsi interni (`/backup/import`, `/lobby/result`, `/notices/queue`, `/init`) oggi non sono raggiungibili da fuori: ho controllato tutte le strade di `api.js`.

**Problemi**

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `worker.js:252-266`, `lobby-hub.js:304`, `turn-notices.js:266` | I percorsi interni sono protetti solo dal fatto che `api.js` non li espone. Dentro l'oggetto non c'è alcun controllo. [V] | Un errore futuro in una riga di `api.js` esporrebbe ripristino dei backup e scrittura delle classifiche | media (rischio futuro) |
| `api.js:108`, `auth.js:110-131` | La sessione si rinnova senza durata massima. [V] | Gettone rubato: resta valido finché la vittima è nel gruppo | bassa |
| `wrangler.jsonc:17-25` | Staging usa lo stesso bot. Se usa anche lo stesso `BOT_TOKEN`, un gettone creato in staging vale in produzione. [S] | Un errore nel codice di prova che rilascia sessioni varrebbe anche in produzione | bassa |
| `staging-worker.js` | File non usato: `wrangler.jsonc` pubblica `worker.js` anche in staging. Il commento dice il contrario. [V] | Confonde chi legge | bassa |
| `api.js:95` | Staging dichiara versione 1.0.51, main 1.0.57. [V] | Solo informativo | bassa |
| `worker.js:604-606`, `golf-server.js:68`, `f1-server.js:374-376`, `biliardo-server.js:280-282`, `cinema-server.js:395` | Il testo dell'errore interno viene mandato al telefono. [V] | Un errore di programma mostra dettagli interni | bassa |
| `auth.js:18`, `simulator/server.js:19` | Numero del gruppo scritto nel codice come valore di riserva. [V] | Non è un segreto, ma è in due punti | bassa |

### 1.2 Collegamento in diretta della Lobby

Controlli corretti [V]: messaggi oltre 512 caratteri scartati (`worker.js:647`), posizione e colori del personaggio ripuliti campo per campo (`worker.js:694-750`), stazione radio accettata solo se ha la forma giusta (`worker.js:655-660`).

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `worker.js:685-752` | Vedi problema 1. [V] | Camminando nella Lobby 3D | alta |
| `worker.js:216-242`, `621` | Vedi problema 3. [V] | Telegram lento o che rifiuta | alta |
| `lobby-hub.js:243` | Vedi problema 4. [V] | Un membro apre molti collegamenti | media |
| `worker.js:673-679` | Vedi problema 5. [V] | Punteggio flipper inventato | media |
| `worker.js:663-666`, `club-pinball.js:15-16` | I freni di radio, volume e flipper sono per collegamento, non per persona. [V] | Con più collegamenti si aggirano | bassa |
| `club-stools.js:16`, `21` | La vicinanza allo sgabello si calcola sulla posizione che il telefono dichiara. [V] | Un telefono modificato sposta qualsiasi sgabello o resta seduto per bloccarlo | bassa |
| `worker.js:623`, `751` | Il server legge i dati del collegamento, aspetta, poi li riscrive. Due messaggi ravvicinati potrebbero sovrascriversi. [S] | Sgabello prenotato che si perde | bassa |

### 1.3 Calcio balilla

Controlli corretti [V]: comandi delle aste limitati (`balilla-rules.js:128-136`), regolazioni del tavolo limitate e solo in allenamento (`balilla-rules.js:25-39`, `balilla-hub.js:236`), solo chi è seduto comanda, rimessa solo a chi tocca.

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `balilla-hub.js:183-190`, `151-153` | Chiunque guardi può dichiarare "sto giocando sul telefono" e il tavolo risulta occupato per tutti, senza scadenza. [V] | Un membro blocca il tavolo finché resta collegato | bassa |
| `balilla-hub.js:267-279` | Chi è seduto può azzerare il punteggio in qualsiasi momento. [V] | Probabilmente voluto; chi perde può azzerare | bassa |
| `balilla-hub.js:290-322` | Con una persona seduta al tavolo del bar il timer gira 30 volte al secondo senza fine. L'oggetto Lobby non va mai a riposo. [V] | Qualcuno resta seduto e fermo: costo continuo | bassa |
| `balilla-hub.js:98-107` | Punteggio e campo sono solo in memoria. [V] | A ogni pubblicazione la partita in corso riparte da zero | bassa |
| `worker.js:621`, `649` | Ogni comando delle aste passa prima dal controllo con Telegram (problema 3). [V] | Scatti nel gioco allo scadere dei 60 secondi | media |

### 1.4 Tavoli da gioco

Controlli corretti [V]: mosse rifatte sul server per tutti i giochi, turno verificato, numero di revisione contro le richieste doppie, ogni giocatore riceve solo le proprie carte (ho controllato le viste di UNO, Scopa, Briscola, Scarabeo e Battaglia navale con uno spettatore), il gettone del tavolo non arriva mai agli altri.

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `worker.js:293`, `84-102` | Vedi problema 2. [V] | Classifica o richiesta di posto mentre il tavolo salva | alta |
| `worker.js:342` | Vedi problema 4. [V] | 60 spettatori finti | media |
| `worker.js:479-482`, `584-595` | Vedi problema 9. [V] | Chi perde chiude o elimina | media |
| `worker.js:389-393` | Ogni lettura dello stato di un tavolo finito scrive, aumenta la revisione e rispedisce a tutti. [V] | Chiunque del gruppo, anche non giocatore, può ripeterla a raffica | bassa |
| `lobby-hub.js:200-215` | Per effetto della riga sopra, la classifica richiede di nuovo i risultati allo stesso tavolo a ogni apertura. [V] | Lavoro sprecato e più occasioni per il problema 2 | bassa |

### 1.5 Lobby: chat, creazione, classifiche

Controlli corretti [V]: chat da 1 a 500 caratteri con un messaggio ogni 1,5 secondi e solo se collegati (`lobby-hub.js:346-354`), Number Connect rigiocato sul server mossa per mossa (`lobby-hub.js:284-303`), regola "un tavolo per gioco" applicata dentro il blocco, senza corse.

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `lobby-hub.js:283` | Vedi problema 6. [V] | Richiesta enorme senza `Content-Length` | media |
| `lobby-hub.js:396`, `84` | Vedi problema 8. [V] | Sale e tavoli archiviati senza limite | media |
| `lobby-hub.js:133`, `307` | I risultati non si cancellano mai e vengono riletti tutti a ogni invio della Lobby. [V] | Il costo cresce con ogni partita giocata | media |
| `lobby-hub.js:366`, `213` | Chiavi `chatlimit:` e `migrated:` mai cancellate. [V] | Crescita lenta dello spazio | bassa |
| `number-connect-rules.js:46-47` | Vedi problema 9. [V] | Bonus combo dichiarato dal telefono | bassa |
| `api.js:215`, `lobby-hub.js:432-460` | La pista di F1 (fino a 400 kB) viene letta e controllata mentre la Lobby è bloccata. [S] | Piste al limite spedite a ripetizione rallentano la Lobby | bassa |

### 1.6 Sale arcade (Pong, Golf, F1, Biliardo, Moto Trial, Labyrinth)

Controlli corretti [V]: Biliardo e F1 rifanno ogni colpo e ogni mossa sul server, la pista di F1 è ricontrollata, i colpi hanno limiti numerici, Pong e Moto Trial hanno un freno sui messaggi, Labyrinth ne accetta 32 al secondo.

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `f1-server.js:352-358`, `biliardo-server.js:258-263` | Finché si aspetta, un ospite appena entrato può chiudere la sala di chi l'ha creata. [V] | Dispetto prima della partenza | bassa |
| `moto-trial-server.js:132-140` | L'arrivo al traguardo lo dichiara il telefono; il server controlla solo che la posizione sia vicina. [V] | Campagna completata senza guidare. Non c'è classifica | bassa |
| `labyrinth-server.js:27` | Eliminando una spedizione il server svuota lo spazio e subito dopo riscrive lo stato. [V] | Le spedizioni eliminate restano salvate per sempre | bassa |
| `golf-server.js:13-16`, `f1-server.js:289-297`, `biliardo-server.js:211-216`, `pong-server.js:30-33` | Le sale chiamano la Lobby mentre sono bloccate. [V] | Se la Lobby è lenta o ferma (problemi 1 e 2), si fermano anche le partite | media |

### 1.7 Lavagna e Pictionary

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `blackboard-server.js:357-361`, `305-322` | Vedi problema 7. [V] | Un membro elimina le lavagne altrui | media |
| `blackboard-server.js:99-117` | Lavagne senza limite. [V] | Un telefono ne crea migliaia | media |
| `blackboard-server.js:395-411`, `164-175` | Tratti senza limite né freno. [V] | Lavagna lentissima da aprire | media |
| `blackboard-server.js:123-124` | Nessun tetto ai collegamenti. [V] | Vedi problema 4 | bassa |
| `blackboard-server.js:295-302` | Tentativi di Pictionary senza freno; le parole sono 64. [V] | Un programma le prova tutte in un secondo | bassa |

### 1.8 Cinema

Controlli corretti [V]: i file di Telegram si vedono solo dalla sala dove sono in proiezione (`cinema-server.js:225-229`), tipo di file verificato dai primi byte (`cinema-media.js:9-19`), solo indirizzi `https` (`cinema-server.js:29-35`), comandi riservati a chi ha aperto la sala (chiudere, spegnere, saltare).

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `cinema-server.js:310-322`, `375-394` | Vedi problema 8. [V] | Sale tutte occupate, lista condivisa svuotata | media |
| `cinema-server.js:347-354` | Chiunque in sala può mettere come canale un indirizzo qualsiasi. I telefoni degli altri lo aprono. [V] | Un membro vede gli indirizzi di rete di chi è in sala | bassa |
| `cinema-server.js:362-374` | Pausa e salto senza freno; ogni comando salva e rispedisce a tutti. [V] | Un telefono che li manda a raffica | bassa |
| `cinema-youtube.js:135-141` | 6 ricerche al minuto a testa, ma la quota giornaliera di YouTube basta per circa 100 ricerche in tutto. [V] il limite, [S] la quota | Una persona la esaurisce in 20 minuti | bassa |
| `worker.js:270-273`, `cinema-telegram.js:92-96` | Lo scaricamento da Telegram (fino a circa 23 secondi) avviene con l'oggetto bloccato; il tetto è 30 secondi. [S] | File grandi con Telegram lento | bassa |

### 1.9 Avvisi dei turni e bot

Controlli corretti [V]: un solo messaggio per turno, ore di silenzio, verifica che il turno sia ancora quello, gli avvisi si accendono dall'app solo dopo aver avviato il bot.

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `turn-notices.js:341-359` | L'avviso viene tolto dalla coda prima dell'invio. [V] | Se Telegram rifiuta in quel momento, l'avviso è perso | bassa |
| `telegram-bot.js:101` | Se l'invio del pulsante fallisce il server risponde con errore, e Telegram riprova più volte. [V] | Persona che ha bloccato il bot: richieste ripetute | bassa |
| `turn-notices.js:293`, `noticeText` | Il nome dell'avversario nel messaggio del bot è il nome Telegram scelto dalla persona. [V] | Un nome scritto apposta finisce nei messaggi del bot ad altri | bassa |

### 1.10 Backup e amministrazione

| Dove | Cosa succede | Quando | Gravità |
|---|---|---|---|
| `backup.js:82-93`, `135-147` | Vedi problema 10. [V] | Ogni lunedì, se `BACKUP_CHAT_ID` è impostato | media-bassa |
| `backup.js:64-71` | Il ripristino svuota tutto e poi riscrive a gruppi di 100. [V] | Se si interrompe a metà, l'oggetto resta mezzo vuoto | bassa |
| `backup.js:113-122` | Una chiamata per ogni tavolo, una dopo l'altra. [S] | Con molti tavoli si può superare il tetto di chiamate di Cloudflare; finiscono in `failed` | bassa |

### 1.11 Dati personali e spazio occupato

| Dato | Dove | Chi lo vede | Per quanto |
|---|---|---|---|
| Identificativo Telegram, nome utente, foto, scadenza sessione | `lobby-hub.js:107-108` | tutti i collegati | finché online |
| Identificativo e nome nelle classifiche | chiavi `result:`, `pinballTop`, `number-connect:` | tutti | per sempre |
| Chat (identificativo, nome, foto, testo) | chiave `chat` | tutti | ultimi 100 messaggi |
| Tavoli archiviati con i giocatori | `lobby-hub.js:84` | tutti, non solo i giocatori | per sempre |
| Errori del telefono con identificativo | `api.js:44-55` | chi vede i log di Cloudflare | secondo Cloudflare |
| Tutto quanto sopra | backup | la chat Telegram del backup | per sempre |

---

## Area 2: multigiocatore

Come sono fatti i giochi online, in breve:

| Gioco | Dove gira la partita | Come arriva al telefono |
|---|---|---|
| Calcio balilla | dentro l'oggetto della Lobby, solo in memoria, 30 aggiornamenti al secondo | collegamento in diretta della Lobby |
| Pong | un oggetto per sala, salvato a ogni punto | collegamento in diretta suo |
| F1 on paper!, Biliardo | un oggetto per partita, salvato a ogni mossa | il telefono chiede lo stato ogni 0,9 secondi |
| Sgabelli, flipper, pose nella Lobby 3D | dentro il collegamento della Lobby (dati legati al singolo collegamento) | collegamento in diretta della Lobby |

Molti problemi qui sotto hanno la stessa radice: **posto al balilla, sgabello e inizio della partita al flipper sono legati al singolo collegamento, e il telefono apre un collegamento nuovo ogni volta che torna in primo piano** (`public/app.js:507` chiama `connectLobby()`, che in `public/app.js:402-403` chiude il vecchio e ne apre uno nuovo).

### 2.1 Risultati verso la Lobby

**A. Le vittorie di Biliardo, F1 e Golf non arrivano più alla Lobby** — alta, [V], solo `staging`

- **Dove:** `worker-shared.js:26-31` (`/lobby/result` è tra i percorsi interni), `worker.js:313-314` (senza chiave interna risponde 404), `biliardo-server.js:211-216` e `:223-224`, `f1-server.js:289-297` e `:309-310`, `golf-server.js:27` (chiamano `/lobby/result` senza la chiave e non guardano la risposta).
- **Cosa succede:** il commit del gruppo 3 ha protetto `/lobby/result` con la chiave interna. I tavoli (`worker.js:126-133`) e Labyrinth (`labyrinth-server.js:14`) la mandano; Biliardo, F1 e Golf no. La Lobby risponde "non trovato" e il risultato si perde: niente riga in classifica, niente avviso «🏆 … vince».
- **Quando:** a ogni partita online di Biliardo, F1 o Golf che finisce con un vincitore, su `staging`.
- **Perché non si recupera:** il recupero dei risultati persi (`lobby-hub.js:261-267`) guarda solo i tavoli, non le sale arcade.
- **Nota:** `tests/abuse-limits.test.mjs` controlla che il percorso sia protetto, ma nessuna prova controlla che una vittoria di Biliardo o F1 arrivi davvero in classifica.

### 2.2 F1 on paper! e Biliardo

**B. Un giocatore che esce a metà blocca il ritmo per tutti** — alta, [V], `staging` e `main`

- **Dove, F1:** `f1-server.js:15` (un minuto per mossa), `:232` (a ogni giro riparte un minuto intero), `:172` (il conto dei giri "senza nessuno" si azzera se anche uno solo ha scelto), `:224` (la gara si chiude da sola solo se per 3 giri non sceglie nessuno), `:132-133` (dopo la partenza non si può uscire), `:355-356` (in gara la chiude solo chi l'ha creata).
- **Dove, Biliardo:** `biliardo-server.js:14` (un minuto a colpo), `:166-167` (il conto dei colpi automatici si azzera a ogni colpo di una persona), `:176`, `:80-81`, `:260-261`.
- **Cosa succede:** chi esce viene guidato dal pilota automatico, ma solo allo scadere del minuto, ogni volta. Finché almeno una persona gioca, la partita non viene mai considerata abbandonata.
- **Quando, F1:** 4 piloti, uno chiude Telegram al terzo giro. Gli altri tre scelgono in pochi secondi, poi aspettano il resto del minuto. Una gara da 40 giri di mosse dura 40 minuti. Se chi è uscito è il creatore, nessuno può chiuderla.
- **Quando, Biliardo:** uno contro uno, l'avversario esce. Dopo ogni tuo colpo aspetti un minuto per il suo; se il pilota automatico imbuca e resta al tavolo, un altro minuto per ogni colpo. Il pilota automatico può anche vincere, e la vittoria va a chi se n'è andato.
- **Aggrava:** aprire dalla Lobby una partita in attesa ti fa entrare come giocatore (`public/f1-link.js:74-78`, `public/biliardo-link.js:67-71`) e a posti pieni si parte da soli (`f1-server.js:364`, `biliardo-server.js:269`). Chi voleva solo dare un'occhiata diventa un pilota che poi se ne va.

**J. Rete caduta o sessione scaduta: il gioco resta fermo senza dire niente** — bassa, [V], `staging` e `main`

- **Dove:** `public/f1-link.js:60-61`, `public/biliardo-link.js:53-54`.
- **Cosa succede:** quando la richiesta di stato fallisce, il telefono reagisce solo a "partita chiusa" (404). Tutti gli altri errori vengono ignorati: il tavolo resta com'era, il conto alla rovescia continua con l'orologio del telefono, nessun messaggio.
- **Quando:** in galleria, o dopo essere stati tolti dal gruppo.

**Altro, gravità bassa** [V]

- In sala d'attesa qualunque ospite può chiudere (cancellare) la partita di un altro, non solo uscirne: `f1-server.js:353-357`, `biliardo-server.js:259-262`. Il gioco agli ospiti mostra solo «Esci» (`public/gara/main.js:868`), quindi serve una richiesta fatta a mano.
- Se la Lobby non conferma la rimozione, la sveglia della partita finita va in errore (`biliardo-server.js:227-231`, `f1-server.js:313-318`). **[S]** Dopo i tentativi di Cloudflare la partita potrebbe restare per sempre nell'elenco.
- F1: se rifare una mossa sul telefono dà errore, l'errore viene solo scritto nella console (`public/gara/main.js:862`) e la gara su quel telefono resta indietro, senza ripartire dall'inizio. **[S]** Non ho trovato un caso che lo provochi.
- Cose che funzionano bene: il telefono che ha perso più mosse salta allo stato del server senza animarle tutte (`public/gara/main.js:789`, `public/biliardo/main.js:756`); il server rifà ogni colpo e ogni mossa, quindi i telefoni non possono divergere a lungo.

### 2.3 Flipper

**C. Punteggio perso se il collegamento cambia durante la partita** — media, [V], solo `staging`

- **Dove:** `club-pinball.js:16-20` e `:29-30` (l'inizio della partita è scritto nel collegamento, e senza inizio il punteggio è rifiutato), `lobby-hub.js:316-327` (un collegamento nuovo nasce vuoto), `public/app.js:507` e `:402-403` (collegamento nuovo a ogni ritorno in primo piano), `public/lobby3d/flipper3d.js:505-509` (l'inizio si annuncia una volta sola, quando ti metti al flipper), `public/app.js:83` (inizio e punteggio partono solo se in quel momento il collegamento è aperto, senza riprovare).
- **Cosa succede:** il controllo contro i punteggi inventati (gruppo 1) si fida dell'ora d'inizio salvata nel collegamento. Se il collegamento viene sostituito a metà partita, quello nuovo non ha nessun inizio e il punteggio finale viene scartato in silenzio. Il display del flipper ti dice comunque la posizione in classifica, perché la calcola da solo (`flipper3d.js:786-792`).
- **Quando:** partita da 8 minuti; a metà abbassi la tendina delle notifiche per due secondi. Oppure il collegamento cade e si riapre dopo 4 secondi. Oppure ti metti al flipper proprio mentre si sta ricollegando.

### 2.4 Calcio balilla

**D. Un attimo in un'altra app: posto perso e punteggio a zero** — media, [V], `staging` e `main`

- **Dove:** `public/app.js:507` (app nascosta: `sendPresence(true)`), `worker.js:782-786` (il server ti toglie dal club e chiama `balilla.leave`), `balilla-hub.js:344-364` (`leave`), `balilla-hub.js:300-306` (`updateBar`: con una sola persona seduta il tavolo passa in allenamento e il punteggio diventa 0-0), `public/lobby3d/balilla.js:407` (online si gioca sempre in modalità "bar").
- **Cosa succede:** basta che uno dei due nasconda l'app per un momento. Il server lo fa alzare, l'altro resta da solo, il tavolo passa in allenamento e il punteggio si azzera. Al ritorno il telefono apre un collegamento nuovo e si risiede da solo, ma solo dopo 3-6 secondi (`balilla.js:736-741`: chiede lo stato ogni 3 secondi e si risiede al giro dopo).
- **Quando:** siete 7 a 6, l'avversario riceve una chiamata o guarda una notifica. Tornate 0-0.
- **In più:** in quei secondi il telefono si crede ancora seduto (usa l'ultimo stato ricevuto, `balilla.js:406`), muove le aste sullo schermo (`balilla.js:611-616`) e manda comandi che il server ignora (`balilla-hub.js:161-163`).
- **Costo:** ogni ritorno in primo piano di chiunque fa due invii completi della Lobby a tutti, uno per il collegamento chiuso (`worker.js:867`) e uno per quello nuovo (`lobby-hub.js:328`).

**G. La partita vive solo in memoria** — media-bassa, [V], `staging` e `main`

- **Dove:** `balilla-hub.js:98-108` (campo e punteggio sono variabili dell'oggetto), `:110-132` (`restore` rimette le persone ai loro posti, ma con un campo nuovo, `:124-127`).
- **Quando:** a ogni pubblicazione su Cloudflare (su `staging` a ogni push) o riavvio dell'oggetto Lobby: punteggio e partite vinte ripartono da zero.

**F. Posto occupato da un collegamento fantasma** — media-bassa, [V] il codice, [S] per quanto tempo, `staging` e `main`

- **Dove:** `balilla-hub.js:148-150` (chi è seduto: nessun controllo su quando si è fatto sentire l'ultima volta), `:154-157` (il controllo dei 15 secondi c'è solo per "gioco sul telefono").
- **Cosa succede:** se un telefono sparisce senza chiudere il collegamento (galleria, batteria), il suo lato resta «Lato occupato» finché Cloudflare non si accorge che il collegamento è morto. La stessa persona, tornando, si riprende il posto (`:205-219`); gli altri no. Il telefono manda già un segnale ogni 3 secondi (`member.seenAt`, `:169`), ma per i posti non viene usato.
- **Anche:** chi resta seduto senza giocare tiene il posto per sempre; dopo 5 minuti il tavolo si ferma (`:318-321`) ma il posto no.

**Altro, gravità bassa** [V]

- Se la stessa persona si siede da un secondo dispositivo su un lato diverso, il primo dispositivo viene tolto dal tavolo senza passare da `leave` (`balilla-hub.js:205-219`): il timer non si ferma e le aste non vengono bloccate.
- Il calcio balilla gira dentro l'oggetto della Lobby: quando la Lobby ha molto da fare (invii completi, molte persone che camminano) gli aggiornamenti del tavolo possono arrivare a scatti. **[S]** Da misurare con più persone collegate.

### 2.5 Sgabelli e Lobby 3D

**E. Dopo un attimo in un'altra app, telefono e server non sono più d'accordo sullo sgabello** — media, [V], `staging` e `main`

- **Dove:** `worker.js:783-784` (app nascosta: il server cancella la tua prenotazione dello sgabello), `public/app.js:402` (il vecchio collegamento viene chiuso con `onclose=null`, quindi `stoolDisconnected` di `public/app.js:407` e `public/lobby3d/lobby3d.js:2034` non parte), `club-stools.js:19` (chi non ha la prenotazione riceve "no"), `lobby3d.js:549-552` (al "no" il telefono non cambia niente).
- **Quando, seduto:** sei sullo sgabello 3, guardi una notifica, torni. Sul tuo schermo sei ancora seduto, per il server lo sgabello è libero: un altro può sedersi sullo stesso sgabello. Quando ti alzi, l'altezza che avevi regolato non viene salvata.
- **Quando, con lo sgabello in mano:** al ritorno il telefono crede di portarlo ancora, ma ogni tentativo di posarlo viene rifiutato. Resti con lo sgabello in mano finché non esci dalla Lobby 3D (`lobby3d.js:1984-1985`).

**F (sgabelli). Sgabello bloccato da un collegamento fantasma** — media-bassa, [V] il codice, [S] per quanto tempo

- **Dove:** `club-stools.js:12-15` (occupato se un collegamento qualsiasi ha la prenotazione: non guarda `seen`), `lobby-hub.js:126` (invece l'elenco delle persone nasconde chi tace da 65 secondi), `socket-limits.js:25` (i collegamenti vecchi della stessa persona si chiudono solo dal terzo in poi).
- **Quando:** il telefono perde la rete mentre sei seduto. Tu sparisci dalla sala dopo 65 secondi, ma lo sgabello resta inutilizzabile per tutti, e anche per te quando torni con un collegamento nuovo.

**I. Nessun controllo che il collegamento sia vivo** — bassa, [V] il codice, [S] quanto dura

- **Dove:** `public/app.js:759` (un segnale ogni 25 secondi, ma senza aspettare risposta), `public/app.js:81-83` e `:724` (si scrive se il collegamento "risulta" aperto).
- **Cosa succede:** quando la rete cambia (Wi-Fi → dati) il collegamento può restare "aperto" per il browser anche se è morto. La Lobby dice «● In diretta», comandi e posizioni vanno persi, e il ricollegamento parte solo quando il browser se ne accorge.

**Altro, gravità bassa** [V]

- Cabinati: chi guarda una partita senza giocarla viene disegnato sul posto del primo giocatore (`lobby3d.js:1397`, `Math.max(0, …)`). F1 ha fino a 8 piloti ma il cabinato ha 5 posti (`lobby3d.js:1130`, `:1399`): dal sesto in poi si sovrappongono ai primi.
- Il posto libero al cabinato e sul divano lo sceglie il telefono (`lobby3d.js:1882`, `:1951`, `:1958`), il server non arbitra. **[S]** Due persone che si siedono nello stesso istante possono finire sovrapposte.
- Cose che funzionano bene: le posizioni degli altri arrivano con il messaggio piccolo ogni 200 ms e vengono ammorbidite sul telefono (`lobby3d.js:1322-1328`); chi tace da 65 secondi sparisce; con più collegamenti della stessa persona conta il più recente (`lobby-hub.js:128-136`).

### 2.6 Pong

**H. Posto preso durante il ricollegamento** — bassa, [V], `staging` e `main`

- **Dove:** `pong-server.js:145-159` (alla caduta la sala torna "in attesa" con un posto libero, visibile nella Lobby), `:62-72` (chi entra in un posto che era di un altro azzera la partita), `public/arcade-link.js:198-211` (chi era caduto riprova dopo 0,85 secondi e trova «sala al completo»).
- **Quando:** siete 9 a 8, la rete del tuo avversario cade tre secondi. Un terzo vede la sala con un posto libero, entra: partita azzerata, il tuo avversario resta fuori.

**Altro, gravità bassa** [V]

- Nessuna pausa se uno dei due ha l'app in secondo piano o il collegamento mezzo morto: la sua racchetta resta ferma (`pong-server.js:98`) e l'altro segna fino alla fine. La sala passa "in attesa" solo quando il collegamento si chiude davvero.
- La partita avanza solo quando arriva un comando (`pong-server.js:115-123`). Finché almeno uno dei due telefoni scrive va bene; è un limite da tenere presente se un giorno ci saranno spettatori.
- **[S]** Se dopo un riavvio del server l'evento di chiusura non arriva, la sala vuota resta nell'elenco: la sveglia che la toglie parte solo dalla chiusura (`pong-server.js:157`, `:161-168`).

---

## Area 3: Lobby 3D su telefono

### 3.1 Prestazioni: cosa si disegna a ogni fotogramma

**L1. I flipper ridipingono il tabellone sempre** — alta, [V] il codice, [S] quanto pesa

- **Dove:** `public/lobby3d/lobby3d.js:1837` (a ogni fotogramma si aggiornano tutti e due i flipper), `public/lobby3d/flipper3d.js:633` (`update`, senza nessun controllo di distanza o di sala), `flipper3d.js:750-782` (ogni trentesimo di secondo `paintBackglass` ridisegna la tela 768×579 e la segna da ricaricare), `flipper3d.js:93` (la texture ha le mipmap, quindi a ogni ricarica si rifanno anche quelle).
- **Cosa succede:** per ognuno dei due flipper, 30 volte al secondo: un disegno 2D di una tela da 768×579 e il suo invio alla scheda grafica (1,8 MB l'uno, più le versioni rimpicciolite). Succede anche in attesa (il giro di lampadine) e anche se sei al cinema o al biliardo.
- **Quando:** sempre, finché la Lobby 3D è aperta. È lavoro continuo di processore e scheda grafica per una cosa che quasi mai si vede.
- **In più:** a ogni fotogramma si aggiornano anche le lampadine del piano (`flipper3d.js:707-748`) e le barre di potenza (`:696-704`) di tutti e due.

**L2. Nessun limite ai fotogrammi, nessuna pausa** — alta, [V]

- **Dove:** `lobby3d.js:1775-1863` (`frame`), `:1778` (`requestAnimationFrame` senza freno), `:1862` (`renderer.render` sempre).
- **Cosa succede:** la scena intera viene ricalcolata e ridisegnata a ogni fotogramma che lo schermo concede. Sui telefoni a 90 o 120 Hz vuol dire 90 o 120 volte al secondo. Succede anche da fermi, da seduti, con la bacheca aperta a leggere la chat.
- **Quando:** sempre con la 3D aperta. È la prima causa del consumo di batteria e del telefono che scalda.
- **Cose fatte bene:** con l'app nascosta il ciclo si ferma (`:1992`), e quando apri un gioco la 3D si ferma (`hide`, `:1988`).

**L3. Troppi oggetti separati, e si disegnano anche dietro i muri** — alta, [V] il codice, [S] i numeri

- **Dove:** `lobby3d.js:112-118` (`std`, `glow`, `box`, `rbox`, `plane`: ogni chiamata crea una geometria, spesso un materiale, e un oggetto a sé), `:1134-1212` (un cabinato: da 25 a 45 oggetti, per 11 cabinati), `:1093-1104` (16 casse, 4 oggetti l'una), `:782-804` (cinema), `public/lobby3d/balilla.js:65-205` (calcio balilla: oltre 100 oggetti più 22 omini), `flipper3d.js:196-211` (ogni lampadina del flipper è un oggetto trasparente con il suo materiale).
- **Cosa succede:** ogni oggetto è un comando separato alla scheda grafica. La scena ne ha, a stima, tra 1.200 e 1.500. three.js scarta quelli fuori dall'inquadratura, ma non quelli nascosti da un muro: guardando dall'atrio verso la sala giochi si disegnano tutti i cabinati, il balilla e i flipper anche se li copre la parete.
- **Quando:** sempre. Sui telefoni economici qualche centinaio di comandi con materiali "fisici" è già il limite per restare fluidi.
- **Personaggi:** un personaggio completo per ogni persona collegata, anche chi è nella Lobby classica (`lobby3d.js:1454-1486`, in piedi attorno al tappeto). Ogni personaggio è fatto di pezzi copiati con i loro materiali (`public/lobby3d/character.js:81-131`) più due scritte con il nome (due tele 512×96, `lobby3d.js:1250-1253` e `:1450-1453`). Non c'è un tetto: la Lobby accetta fino a 120 collegamenti.
- **Cose fatte bene:** le pedine di scacchi e dama sono disegnate tutte insieme (`:646-649`), le ombre vere sono spente e sostituite da macchie a terra (`:189-191`, `:1247`).

**L4. Troppe luci** — media-alta, [V]

- **Dove:** `lobby3d.js:176` (atrio, 3), `:478-480` e `:495` (biliardo: 4 faretti e 3 luci), `:617` (tavoli, 1), `:811` (cinema, 2), `:1241` (sala giochi, 4), `flipper3d.js:221-222` (una per flipper), `lobby3d.js:1999-2009` (`lightRoom`: accende la sala dove sei più l'atrio).
- **Cosa succede:** ogni luce accesa viene calcolata per ogni punto di ogni oggetto illuminato. In sala biliardo sono 4 faretti + 3 luci + 3 dell'atrio; in sala giochi 4 + 3; nell'atrio 3 + la principale di ogni altra sala (7).
- **Le luci dei flipper sfuggono:** l'elenco delle luci per sala si fa una volta, all'avvio (`lobby3d.js:2001`), ma le luci dei flipper nascono dopo, quando arriva il modello (`flipper3d.js:154`, `:221`). Non entrano nell'elenco, quindi restano accese in tutte le sale: due luci in più ovunque, quasi sempre a intensità zero ma calcolate lo stesso. In sala biliardo si arriva a 12.
- **Cose fatte bene:** l'idea di accendere solo la sala dove sei, e di preparare le combinazioni prima (`prepareLights`, `:2011`), è giusta.
- **[S]** Preparare le cinque combinazioni vuol dire compilare ogni materiale cinque volte durante lo splash: su un telefono lento può allungare l'avvio di parecchi secondi.

**L9. Nessuna qualità ridotta per i telefoni lenti** — media-bassa, [V] il codice, [S] quanto pesa

- **Dove:** `lobby3d.js:94-99` (antialias sempre, fino a 1,5 punti per pixel sul telefono, resa dei colori "da film"), `:105-107` (riflessi d'ambiente su tutti i materiali), `:405` e `:1138` (materiali con vernice trasparente su tavolino e cabinati), `:52` (`backdrop-filter: blur` su ogni tasto della 3D).
- **Cosa succede:** la qualità è una sola per tutti. Non si guarda mai quanto dura un fotogramma per abbassare la risoluzione o togliere qualcosa. Il gioco F1 una scelta di qualità ce l'ha, la Lobby no.
- **La sfocatura dietro ai tasti:** ogni tasto sopra la scena (Lobby classica, Vista, i quattro tasti attorno al joystick, il tasto d'azione, quelli del balilla) sfoca quello che ha dietro. Con la scena che cambia a ogni fotogramma, il telefono rifà la sfocatura a ogni fotogramma per ogni tasto. Su Android è noto per essere costoso.
- **La tela trasparente:** la scena è disegnata su una tela trasparente (`alpha: true`, `:94`) per far vedere il film che sta sotto (`:846-849`). Una tela trasparente a tutto schermo costa di più da comporre, anche quando non c'è nessun film.

**Altro, gravità bassa** [V]

- A ogni fotogramma si creano oggetti da buttare: la posa trasformata in testo (`lobby3d.js:1838`), una copia dei dati per ognuno dei 12 sgabelli (`:586`), elenchi di appoggio (`:1589`, `:1834`), un vettore nuovo in vista dagli occhi (`:1854`). Poco ognuno, ma fanno lavorare il pulitore di memoria.
- A ogni fotogramma si riscrivono una decina di stili della pagina anche se non cambiano (`:601-607`, `:1816-1817`, `:1833-1836`, `:1858-1861`).
- Radio del club: per ognuna delle 16 casse si programmano due cambi di volume e posizione a ogni fotogramma (`public/radio.js:354-377`), quasi 2.000 al secondo. **[S]** Da verificare se pesa.
- Quando arriva un messaggio in chat la bacheca (1024×948) viene ridisegnata e ricaricata sulla scheda grafica (`lobby3d.js:264-299`, `:1746`): un piccolo scatto.

### 3.2 Memoria e avvio

**L10. Quanta memoria occupa** — media-bassa, [V] le misure, [S] il totale

- **Dove:** `public/lobby3d/textures.js:4-12` (ogni disegno è una tela che resta in memoria, più la copia sulla scheda grafica con le versioni rimpicciolite).
- **Le tele più grandi:** tre pareti da 2048×512 (`textures.js:41`), due piani dei flipper da 1024×2088 (`flipper3d.js:224-230`), bacheca e sughero da 1024×948 (`lobby3d.js:249-260`), otto cartelli delle porte da 1024×164 (`:438`), le insegne dei cabinati da 768×208 (`:1190`), nove piani dei tavoli da 512×384 (`:623`), schermo del cinema da 1024×576 (`:844`).
- **Stima:** 65-70 MB di tele in RAM e circa altrettanto, o un po' di più, sulla scheda grafica, senza contare i modelli (5,5 MB di file `.glb`) e i due suoni del balilla.
- **Quando pesa:** quando dalla 3D apri un altro gioco 3D (Biliardo, F1). La Lobby 3D si ferma ma tiene tutto caricato, e il gioco apre una seconda scena 3D sua. Su un telefono con poca memoria Telegram può ricaricare la mini app. **[S]**
- **Suoni del balilla:** `sounds/balilla-partita.mp3` (539 KB) viene decodificato tutto in memoria (`public/lobby3d/balilla-sounds.js:14-25`) per usarne sei pezzetti da un decimo di secondo. **[S]** A stima sono una decina di MB di audio decodificato.

**L7. Se la grafica 3D non parte** — media, [V] la logica, [S] quanto è frequente

- **Dove:** `lobby3d.js:71-77` (pagina e stile della 3D aggiunti al documento) e `:94` (creazione della grafica, che può fallire), `public/app.js:106` (primo tentativo, errore ignorato), `:105` e `:110` (lo splash aspetta la 3D, al massimo 26 secondi), `:114` (ogni 0,7 secondi, se la Lobby è libera, si riprova ad aprire la 3D e si mostra l'errore).
- **Cosa succede:** su un telefono dove WebGL non parte (vecchio, scheda grafica esclusa dal browser, memoria finita) lo splash resta 26 secondi. Poi compare la Lobby classica, ma ogni secondo e mezzo l'app riprova, fallisce di nuovo e mostra «Lobby 3D: …». A ogni tentativo resta nel documento un pezzo di pagina in più (`:77` viene prima di `:94`).
- **Senza uscita:** la scelta "Lobby classica" si salva solo dal tasto ✕ dentro la 3D (`lobby3d.js:1647`), che su quel telefono non si vede mai.
- **Contesto perso:** non c'è niente per il caso in cui la scheda grafica "perde" la scena a 3D aperta (succede su Android dopo un po' in secondo piano). three.js ricarica da solo texture e modelli, ma i riflessi d'ambiente creati all'avvio (`lobby3d.js:105-108`) non vengono rifatti. **[S]** Da provare.

**Altro** [V]

- La 3D si prepara a ogni avvio per chiunque non abbia scelto la Lobby classica (`public/app.js:106`): three.js, 5,5 MB di modelli e tutte le tele, anche con la rete del telefono e anche se si è aperta l'app da un avviso per andare dritti a un tavolo.

### 3.3 Cinema e radio nella Lobby 3D

**L5. Il film gira ovunque** — media, [V]

- **Dove:** `lobby3d.js:1826` (a ogni fotogramma `playProjection`), `:938-972` (se c'è una proiezione crea il video o il riquadro di YouTube, dovunque tu sia), `:2027` (lo fa partire già durante lo splash), `:931-935` e `:1992` (con l'app nascosta il film viene azzittito, non fermato).
- **Cosa succede:** se in sala cinema c'è un film, ogni telefono nella Lobby 3D lo scarica e lo decodifica, anche da dietro tre muri, con il volume a zero. Solo lo schermo condiviso si collega quando sei vicino (`:940`).
- **Quando:** qualcuno proietta un film e gli altri giocano a balilla: tutti consumano dati e batteria per un video che non vedono.
- **In più:** il riquadro del video viene riposizionato a ogni fotogramma con una trasformazione 3D (`:974-990`).

**L6. iPhone: i volumi a distanza non funzionano** — media, [V] il codice, [S] da provare su iPhone

- **Dove:** `public/radio.js:379` e `:945-951` (il volume della radio del club si regola con `plain.volume` e `fx.volume`), `radio.js:371` (i volumi delle casse non tengono conto né del cursore né della sala), `lobby3d.js:1812` e `:960` (il volume del film si regola con `previewVideo.volume`).
- **Cosa succede:** su iPhone il volume di un elemento audio o video non si può cambiare da programma: resta sempre al massimo. Quindi la radio non si abbassa allontanandosi dal bancone, il cursore «Radio» non fa niente, ed entrando in sala cinema la radio non si spegne (`setClubGain(0)` mette il volume a zero, che su iPhone non ha effetto) e suona sopra il film. Anche il cursore «Cinema» e la dissolvenza entrando non funzionano; il film passa solo da muto a pieno volume (`:1823`, questo funziona).
- **Rimedio:** far passare il suono da un regolatore di volume di Web Audio, oppure mettere in pausa o in muto invece di abbassare.

### 3.4 Audio su Android e iPhone

Gravità bassa o media-bassa.

- **[V] Tre motori audio insieme:** la radio (`public/radio.js:383-387`), la Lobby 3D (`lobby3d.js:861`) e, con Pong acceso sul cabinato, la pagina nascosta di Pong (`:1891`). Funziona, ma consuma di più.
- **[V] il codice, [S] l'effetto. Dopo una telefonata su iPhone:** l'audio viene risvegliato solo se è nello stato «sospeso» (`lobby3d.js:861`). iPhone dopo una chiamata o Siri lo mette in uno stato diverso («interrotto»), che il codice non considera: balilla, flipper e passi possono restare muti finché non si riapre la 3D. Basta risvegliarlo ogni volta che non è «in funzione».
- **[S] Tasto del silenzioso su iPhone:** i suoni fatti con Web Audio (flipper, balilla, passi, colpi) seguono il tasto laterale del silenzioso, mentre radio e film no. Chi ha il silenzioso sente la radio ma non il flipper.
- **[V] Voce del flipper:** usa la sintesi vocale del browser (`flipper3d.js:372-379`). Dentro Telegram su Android di solito non c'è: lì il flipper non parla, senza errori.
- **Cose fatte bene:** lo sblocco dell'audio anche quando il dito si alza (`lobby3d.js:863-864`, serve su iPhone); i suoni sintetizzati si scollegano da soli quando finiscono (`:1041`, `:1048`); il mixer del cinema solo per i video dello stesso sito (`:965`), così gli altri non diventano muti.

### 3.5 Comandi touch

Nel complesso sono fatti con cura: più dita insieme, cattura del dito, tasti che non si sovrappongono anche a 360 punti di larghezza, niente zoom o selezione per sbaglio (`lobby3d.js:46`). Restano questi punti, tutti di gravità bassa.

- **[V] Joystick con centro fisso e zona grande:** qualunque tocco nel quarto in basso a sinistra dello schermo diventa joystick (`lobby3d.js:1551`), ma il centro resta quello del cerchio disegnato (`:1559`). Toccando lontano dal cerchio il personaggio parte subito al massimo in quella direzione. Un joystick che nasce dove appoggi il dito è più naturale.
- **[V] Flipper senza scossa da telefono:** la scossa è solo sulla barra spaziatrice (`flipper3d.js:534-535`); dal telefono non c'è modo di darla (`:563-579`).
- **[V] Telefoni e computer con schermo tattile:** basta che il dispositivo abbia il tocco per avere la disposizione da telefono (`lobby3d.js:80`, `flipper3d.js:447`, `balilla.js:235`). Su un portatile con schermo tattile, usando il mouse, compaiono joystick e tasti da telefono e spariscono le scritte dei tasti.
- **[V] Balilla in verticale:** la distanza della telecamera dipende da quanto è largo lo schermo (`balilla.js:629-643`). Con il telefono in verticale il tavolo viene piccolo; in orizzontale va bene. Non c'è un invito a girare il telefono.
- **[S] Bacheca e tastiera su iPhone:** la chat della bacheca è una pagina vera appoggiata in prospettiva sul sughero (`lobby3d.js:356-368`). Quando si apre la tastiera di iPhone la pagina non si ridimensiona: il campo dove si scrive può finire sotto la tastiera.
- **[V] Niente vibrazione:** nella Lobby 3D non si usa mai la vibrazione di Telegram (colpo preso, gol, flipper), che i giochi invece usano.

### 3.6 Telegram

**L8. Mini app ridotta a icona** — media, [V] manca il codice, [S] il comportamento di Telegram

- **Dove:** `public/app.js:576` (gli eventi di Telegram ascoltati: misure, margini, schermo intero) e `:795` (tasto Indietro); `lobby3d.js:1992` (la 3D si ferma solo con `visibilitychange`).
- **Cosa succede:** Telegram dalla versione 8.0 avvisa con `deactivated` e `activated` quando la mini app viene ridotta a icona o coperta. L'app non li ascolta. Se in quel caso il telefono non segnala la pagina come nascosta, la 3D continua a disegnare, la radio a suonare e il collegamento resta «presente».
- **Quando:** trascini giù la mini app per rispondere a un messaggio e la lasci lì.

**Altro** [V]

- Con Telegram più vecchio della 7.7 non si può bloccare lo scorrimento verso il basso (`lobby3d.js:1969`): tirando giù il joystick la mini app si riduce o si chiude. Non c'è nemmeno la conferma di chiusura nella Lobby 3D.
- **Cose fatte bene:** margini sicuri calcolati bene e aggiornati a ogni cambio (`public/safe-area.js`, `public/app.css:1680-1687`, `public/app.js:576`); tutti i comandi della 3D li rispettano (`lobby3d.js:49`, `:61`, `:1625`); lo scorrimento verticale viene bloccato entrando e sbloccato uscendo (`:1969`, `:1987`).

### 3.7 Batteria: il conto

In ordine di peso stimato **[S]**:

1. Scena ridisegnata senza limite (L2), con tanti oggetti (L3) e tante luci (L4).
2. Tabelloni dei flipper ridipinti 60 volte al secondo in tutto (L1).
3. Film decodificato anche lontano dal cinema (L5).
4. Sfocatura dietro ai tasti e tela trasparente (L9).
5. Radio in rete con 16 casse ricalcolate a ogni fotogramma.
6. Mini app ridotta a icona ma ancora accesa (L8).

---

## Area 4: fisica e regole dei giochi

### 4.1 Flipper (Grand Prix e Binotto GT)

**G2. Pallina ferma per sempre sul cancelletto (solo Grand Prix)** — media, [V] [P]

- **Dove:** `public/flipper/physics.js:57` (il cancelletto in cima alla corsia di lancio è orizzontale), `:248` (anche a forza zero la pallina parte a 1,4 m/s), `public/lobby3d/flipper3d.js:556` (col mouse: cliccando il pomello la leva è «tirata di zero») e `:593` (col dito: trascinando verso l'alto la forza resta zero).
- **Cosa succede:** a 1,4 m/s la pallina supera di poco il cancelletto (arriva a 84 cm, il cancelletto è a 81), non tocca l'arco in alto, ricade dritta e si appoggia sul cancelletto. Lì è in equilibrio perfetto: nessuna spinta di lato, nessun tempo massimo.
- **Prova:** forza 0 → ferma a x = 0,501, y = 0,8245, ancora ferma dopo altri 120 secondi. Già con forza 0,001 entra in gioco; da tastiera o tenendo premuto non succede mai (5-200 ms provati).
- **Quando:** col mouse, un clic sul pomello della leva senza trascinare. Col dito, toccando la zona della leva e scivolando in su. Una scossa la libera, ma dal telefono la scossa non c'è (vedi Area 3): lì bisogna uscire e si perde la partita.
- **Nota:** il Binotto GT non ha il problema, perché il suo cancelletto è inclinato apposta (`public/flipper/physics-gt.js:60-61`, «se ci ricade sopra scivola nel campo»). Basta fare lo stesso nel Grand Prix.

**G7. Multiball: la pallina sulla rampa urta quelle sotto** — bassa, [V] [P]

- **Dove:** `physics.js:606-625` e `:673-674`, `physics-gt.js:689` (`ballsCollide` vale per tutte le coppie, senza guardare se una è sulla rampa).
- **Cosa succede:** la rampa passa 3-10 cm sopra il piano, ma per gli urti tra palline conta solo la posizione vista dall'alto. Una pallina sul piano viene spinta via da una che le passa sopra, e riceve la velocità che quella aveva prima di salire.
- **Prova:** pallina sulla rampa a 7,5 cm di quota sopra una pallina sul piano: quella sotto spostata di 11 mm in un solo passo.
- **Vale anche** per la pallina ferma ai box, che viene spostata dalla buca.

**G8. Tanti oggetti temporanei** — bassa, [V] il codice, [S] quanto pesa

- **Dove:** `physics.js:505-506` e `physics-gt.js:590-591` (per ogni bersaglio in piedi, a ogni passo: una copia del bersaglio e una della velocità), `physics.js:669` e `physics-gt.js:752` (una copia dell'elenco delle palline a ogni passo), `physics.js:681-687` (funzioni create a ogni passo).
- **Cosa succede:** la fisica fa 1.200 passi al secondo; con tre bersagli sono 8-10 mila oggetti al secondo da buttare. Sul telefono il pulitore di memoria può dare piccoli scatti.

**Altro, gravità bassa** [V]

- Il «kickback» non si accende mai: `g.kickback` nasce falso e nessuno lo mette vero (`physics.js:178`, `:586-598`). È codice rimasto da quando c'erano le uscite laterali.
- Con un flipper tenuto alzato la pallina si ferma nella conca vicino al perno (60 partite su 60 nella prova). È il comportamento di un flipper vero («presa»), non un difetto.
- **Cose che reggono [P]:** 156 minuti di partite a caso sui due tavoli (flipper premuti e lasciati a caso, scosse): nessun numero non valido, nessuna pallina fuori dal piano, nessuna pallina bloccata, velocità mai sopra i 7 m/s, punteggi sempre interi. Il passo fisso di 1/1200 di secondo fa il suo lavoro, anche a 20 fotogrammi al secondo.

### 4.2 Calcio balilla

**G3. Palla ferma davanti a chi non gioca** — media-bassa, [V] [P]

- **Dove:** `public/lobby3d/balilla-rules.js:445-448` (la palla si rimette solo se è ferma da 1,5 secondi **e** nessuna figura può arrivarci), `:153-165` (`reachable`).
- **Cosa succede:** se la palla si ferma dove arriva una sola squadra, tocca a quella squadra muoverla. Non c'è un tempo massimo di possesso.
- **Prova:** palla ferma a 5 cm dal portiere, aste ferme: dopo 600 secondi è ancora lì.
- **Quando:** un giocatore tiene la palla ferma sotto il piede per far passare il tempo, oppure l'avversario si è distratto. Con il commit «balilla in pausa se uno tace» il caso dell'assente è coperto sul server; resta chi è presente e non tira. Il regolamento ITSF dà 10 secondi (15 a centrocampo).

**G4. Un settimo del campo è irraggiungibile** — media-bassa, [V] [P]

- **Dove:** `balilla-rules.js:64-67` (corsa delle aste: il portiere copre la porta «e poco più»), `:157` (ogni asta arriva a 7,2 cm davanti e dietro), `:40-44` (i rialzi negli angoli sono lunghi solo 12 cm).
- **Cosa succede:** ai lati di ogni porta c'è una zona di circa 15 × 21 cm dove non arriva né il portiere (troppo di lato) né la difesa (troppo indietro). Sono quattro zone, circa il 12% del campo; il resto sono strisce di mezzo centimetro tra un'asta e l'altra. Una palla che si ferma lì viene rimessa dal foro di centrocampo.
- **Prova:** 14,5% del campo. In 180 minuti di partite a caso: 337 rimesse per palla irraggiungibile contro 161 gol (le partite a caso esagerano, ma dà l'idea).
- **Sul tavolo vero** quelle zone hanno un rialzo che riporta la palla verso la difesa. Qui il rialzo copre solo l'angolo.

**G5. Palla lenta oltre la riga: non è gol** — bassa, [V] [P]

- **Dove:** `balilla-rules.js:331-332` (è gol solo quando la palla ha superato la riga di tutto il suo raggio, cioè 1,7 cm oltre).
- **Cosa succede:** tra la riga e quel punto non c'è niente che tiri dentro la palla. Se si ferma lì, il portiere non ci arriva più e viene rimessa dal foro, senza gol.
- **Prova:** con la palla che arriva a 14,5-17 cm/s (misurati a 4 cm dalla riga) il centro supera la riga, la palla si ferma e viene rimessa: 18 casi su 351. Sopra i 17,5 cm/s è sempre gol.

**Altro, gravità bassa** [V]

- Dentro la bocca della porta il rimbalzo sui lati inverte la velocità senza guardare da che parte sta andando la palla (`balilla-rules.js:365-368`). In pratica la palla perde la velocità di lato invece di rimbalzare; nelle prove non ha mai bloccato niente.
- La rimessa per palla irraggiungibile la fa sempre chi aveva rimesso per ultimo (`:448`), non chi ha subito o chi è più lontano: può favorire sempre lo stesso.
- **Cose che reggono [P]:** 180 minuti di partite a caso senza numeri non validi né palla fuori dal campo; velocità massima 5,1 m/s (il limite è 9). Un tiro dritto contro una figura ferma non la attraversa mai, nemmeno con passi di simulazione da un decimo di secondo (85 casi per passo), perché la simulazione si divide sempre in passi da 1/600 di secondo (`:420-421`).

### 4.3 Biliardo

**G1. Snooker: bianca rimessa sopra un'altra bilia** — media, [V] [P]

- **Dove:** `public/biliardo/engine.js:542` (bianca in buca: va a un punto fisso della D, senza controllare se è libero) e `:550` (lo stesso dopo la parità sulla nera). Palla 8 e palla 9 invece cercano un punto libero (`:384`, `:439`, `freeSpot`).
- **Cosa succede:** se vicino a quel punto c'è una bilia, la bianca viene messa dentro di lei. Chi entra ha la bianca in mano e può spostarla; ma se tira da lì, o se tira il pilota automatico (che non sposta mai la bianca, `:750-764`), al primo istante la fisica separa le due bilie di colpo (`public/biliardo/physics.js:136-146`) spostando anche l'altra bilia, senza che risulti un contatto.
- **Prova:** 34 volte in 32.500 colpi a caso (120 partite), con sovrapposizioni fino a 35 mm su bilie da 52,5. Con marrone, gialla, nera e rosse. In palla 8 e palla 9: zero su 21.000 colpi.

**G6. Colpo esattamente di traverso** — bassa, [V] [P], oggi non raggiungibile dal gioco

- **Dove:** `engine.js:319` (`+s.dx || 1`: lo zero viene preso per «mancante» e diventa 1).
- **Prova:** direzione (0, 1) → la bilia parte a (1,414, 1,414), cioè a 45 gradi. Con (0,000000000001, 1) parte giusta.
- **Perché oggi non succede:** il gioco calcola la direzione dall'angolo e non esce mai uno zero esatto; il pilota automatico non l'ha mai prodotto in 10.694 tiri. Resta un errore pronto a scattare se un giorno la mira si calcolasse in un altro modo.

**G9. Nera senza buca chiamata** — bassa, [V]

- **Dove:** `engine.js:388` (la nera è vincente se la buca è quella chiamata **oppure se non è stata chiamata nessuna buca**), `biliardo-server.js` (`cleanShot`: la buca è facoltativa).
- **Cosa succede:** il gioco fa toccare la buca prima di tirare, ma un colpo mandato senza la buca vale in qualunque buca. Anche il pilota automatico tira senza chiamare.

**G10. 5 birilli: da confrontare con il regolamento** — bassa, [S]

- `engine.js:608`: se la propria bilia abbatte i birilli prima di toccare l'avversaria la penalità è fissa a 2 punti, senza il valore dei birilli abbattuti.
- `engine.js:623`: i birilli abbattuti dal pallino contano solo se il pallino l'ha mosso la bilia avversaria; se l'ha mosso la propria bilia (dopo aver colpito l'avversaria) non contano per nessuno.
- `docs/biliardo.md` non entra in questi due casi: non so dire se sono scelte o sviste.

**Altro, gravità bassa** [V]

- La mescolata del triangolo fa un conto che supera la precisione dei numeri (`engine.js:159`, `:180`: il prodotto passa 2^53). Dà lo stesso risultato su ogni telefono e sul server, quindi non crea differenze; la mescolata è solo un po' meno casuale.
- Il colpo è fermato a 30 secondi sul server (`physics.js:216`) e a 40 nell'animazione (`public/biliardo/main.js:877`). Nelle prove il colpo più lungo è durato 12 secondi, quindi oggi non conta.
- `freeSpot` ha un'ultima uscita che non controlla niente (`engine.js:300`). Non l'ho mai vista scattare.
- **Cose che reggono [P]:** circa 110.000 colpi a caso in tutte le specialità (palla 8, palla 9, snooker con 6 e 15 rosse, 5 birilli, boccette, carambola libera e a tre sponde). Nessun numero non valido, nessuna bilia ferma fuori dal tavolo, nessuna bilia uscita dal tavolo durante il colpo, nessun colpo fermato dal limite di tempo, tutte le partite finite. Tolto G1, nessuna sovrapposizione a fine colpo. La scelta di usare solo le quattro operazioni e la radice quadrata nella fisica (`physics.js:6-7`) è rispettata in tutto il file: è quello che garantisce lo stesso tavolo su ogni telefono.

### 4.4 Le prove fatte

| Gioco | Prova | Quanto | Esito |
|---|---|---|---|
| Flipper GP e GT | partite a caso | 156 minuti di gioco | nessun problema |
| Flipper GP | lancio con ogni forza da 0 a 0,3 | 301 lanci | ferma solo a forza 0 (G2) |
| Flipper GT | lancio con ogni forza da 0 a 1 | 101 lanci | nessun problema |
| Flipper GP | pallina sulla rampa sopra un'altra | 1 caso costruito | urto che non dovrebbe esserci (G7) |
| Calcio balilla | partite a caso, due squadre | 180 minuti | nessun numero non valido, palla mai fuori |
| Calcio balilla | palla lenta verso la porta | 351 tiri | 18 oltre la riga senza gol (G5) |
| Calcio balilla | palla ferma in ogni punto del campo | griglia da 1 cm | 14,5% irraggiungibile (G4) |
| Calcio balilla | palla ferma davanti a un'asta ferma | 600 secondi | resta lì (G3) |
| Biliardo | partite a caso, tutte le specialità | circa 110.000 colpi | solo G1 |
| Biliardo | direzione (0, 1) | 1 caso | parte in diagonale (G6) |

I programmi di prova sono rimasti fuori dal repo. Sono piccoli e ripetibili (stesso seme, stesso risultato): si possono trasformare in prove automatiche (proposta 4.9).

---

## Area 5: qualità del codice

### 5.1 File e funzioni troppo grandi

**Q1. La Lobby 3D è una sola funzione** — media, [V]

- **Dove:** `public/lobby3d/lobby3d.js:72` (`createLobby3D`: 2.026 righe, 137 KB su un file da 145 KB).
- **Cosa c'è dentro, tutto insieme:** le cinque sale, la bacheca con la chat, il cinema e il suo audio, il mixer dei volumi, gli sgabelli, i cabinati, i personaggi degli altri, i comandi da tastiera, mouse e telefono, il ciclo di disegno, le luci per sala. Condividono decine di variabili dichiarate qua e là (`pos`, `cam`, `seating`, `monitor`, `carrying`, `active`…), alcune usate centinaia di righe prima di dove sono dichiarate (`seating` e `monitor` nascono a riga 1909 e servono già nel ciclo di disegno, che sta prima).
- **Perché pesa:** non si può provare un pezzo da solo, ogni modifica rischia di toccarne un altro, e chi legge deve tenere in testa tutto il file. È anche il motivo per cui le proposte 3.4 e 3.5 dell'Area 3 (sale e oggetti) sono difficili.
- **Altre funzioni molto lunghe:** `buildBalilla` (`public/lobby3d/balilla.js:26`, 745 righe), `Room.fetch` (`worker.js:308`, 391 righe: tutti i percorsi dei tavoli in una catena di `if`), `LobbyHub.lobby` (`lobby-hub.js:257`, 333 righe), `createCinemaLobby` (`public/cinema-lobby.js:5`, 398 righe), `createArcadeLink` (`public/arcade-link.js:8`, 362 righe).
- **I file più grandi:** `lobby3d.js` 145 KB, `public/gara/scene3d.js` 129 KB, `public/simulator/app.js` 96 KB, `public/app.js` 65 KB (832 righe, quindi righe molto fitte), `public/app.css` 82 KB in 4.205 righe, `public/index.html` 43 KB in 104 righe.
- **Un oggetto che fa dodici mestieri:** la classe `Room` (`worker.js:65`) è insieme tavolo da gioco, Lobby, cinema, lavagna, backup, coda degli avvisi, simulatore e ogni sala arcade. Per capire di chi è una sveglia prova una chiave dopo l'altra (`worker.js`, funzione `alarm`). Funziona, ma ogni cosa nuova allunga le stesse due funzioni.

### 5.2 Duplicazioni

**Q2. Due flipper, due copie della fisica** — media, [V]

- **Dove:** `public/flipper/physics.js` (685 righe) e `public/flipper/physics-gt.js` (784 righe).
- **Misura:** il 77% delle righe del GT è identico al Grand Prix: urti, flipper, pistone, palline, scossa, fine pallina. Cambiano il tracciato, le rampe e i punti.
- **La prova che fa danni:** il cancelletto inclinato che evita la pallina bloccata c'è solo nel GT (G2 dell'Area 4). I difetti G7 e G8 sono in tutti e due e vanno corretti due volte. Anche il kickback morto è copiato in tutti e due.
- **Simile:** `public/lobby3d/flipper-art.js` e `gt-art.js` (27% uguale); `public/flipper/main.js` ripete pezzi di `public/lobby3d/flipper3d.js`.

**Q3. Collegamenti dei giochi copiati** — media, [V]

- **Sul telefono:** `public/biliardo-link.js` è al 75% identico a `public/f1-link.js` (apri, chiudi, chiedi lo stato, orologio, margini, vibrazione, conferma di chiusura). `golf-link.js`, `moto-link.js` e `labyrinth-link.js` rifanno le stesse cose con parole diverse.
- **Sul server:** `f1-server.js`, `biliardo-server.js` e `golf-server.js` hanno lo stesso scheletro (`lobby`, `save`, `update`, `remove`, `fetch`, `alarm`, attesa di 30 minuti, partita finita tenuta 5 minuti, un minuto a mossa).
- **La prova che fa danni:** il problema A dell'Area 2 (vittorie che non arrivavano alla Lobby) era lo stesso errore in tre file, ed è stato corretto in tre file. Lo stesso per «giocatore assente» (B) e «collegamento perso» (J).

**Q8. Piccoli pezzi ripetuti** — bassa, [V]

| Pezzo | Quante volte | In quanti file |
|---|---|---|
| lettura dell'utente dall'intestazione (`JSON.parse(req.headers.get('X-Checkmate-User')…`) | 26 | 12 (in `worker.js` anche sei volte nella stessa richiesta) |
| nome dell'oggetto Lobby (`idFromName('checkmate-lobby-v1')`) | 14 | 10 (esiste già `lobbyHub` in `worker-shared.js`, usato poco) |
| risposta JSON (`const json = (`) | 11 | 11 (con intestazioni leggermente diverse: solo quella di `worker-shared.js` ha `nosniff`) |
| memoria del telefono dentro `try`/`catch` | 76 | 30 (esiste già `public/prefs.js`, importato da 4 file) |
| `$ = id => document.getElementById(id)` | 32 | 32 |
| `clamp` | 8 | 8 |
| «è un telefono?» (`pointer: coarse` o `ontouchstart`) | 5 | 5 (tutti con lo stesso difetto sui portatili tattili, vedi Area 3) |
| vibrazione di Telegram a richiesta di un gioco | 4 copie uguali | `f1-link.js`, `biliardo-link.js`, `arcade-link.js`, `app.js` |

### 5.3 Codice morto e provvisorio

**Q5. Cosa c'è che non serve più** — media-bassa, [V]

- **Computer del calcio balilla sul server:** `balilla-hub.js:27` (`practiceAI`, una cinquantina di righe), `:79` (`PRACTICE_AI = false`) e `:375-377` (il ramo che non scatta mai).
- **Computer del calcio balilla sul telefono:** tutto `public/lobby3d/balilla-ai.js` (127 righe). Nessun file lo importa, nemmeno le prove.
- **Pannello del balilla nascosto:** `public/lobby3d/balilla.js:234` (`noPanel = true`). Il pannello con Difesa, Attacco, Butta la pallina, Azzera, Sensibilità ed Esci viene costruito ma non si mostra mai; resta vivo solo il cursore della sensibilità, usato di nascosto dai tasti + e −.
- **Taratura provvisoria:** `balilla.js:263-316` (ingranaggio e quattro cursori sul telefono, dichiarati «provvisori»). È ancora attiva per tutti.
- **Kickback dei flipper:** `public/flipper/physics.js:180` e `physics-gt.js:230` più i blocchi che lo usano: la luce non si accende mai.
- **Pagine e file che nessuno apre:** `public/flipper/index.html` con `public/flipper/main.js` (15 KB, un flipper a pagina intera a cui l'app non porta), `public/telegram-setup.html` (vuoto), `staging-worker.js` (il file di prova «pagina bianca»: `wrangler.jsonc` usa `worker.js` anche per staging).
- **Nella Lobby 3D:** il tasto «Audio cinema» creato e nascosto per sempre con i suoi gestori (`lobby3d.js:861`), l'avviso dei comandi nascosto per sempre (`:93`).
- **Sagome provvisorie:** divani, divanetti del cinema, radio, tavolo e omini del balilla, sgabelli vengono prima costruiti a scatole e poi sostituiti dal modello di Blender (`lobby3d.js:799`, `:1020`; `balilla.js:63`, `:157`, commenti «finché non arriva»). I modelli sono arrivati: le sagome si costruiscono a ogni avvio e si buttano.
- **Compatibilità con cose che non esistono più:** Cluedo (`worker.js:386`), giocatori senza Telegram con il vecchio gettone (`worker.js:478-486`, `:523-525`), il vecchio protocollo della lavagna (`blackboard-server.js`, 14 punti con `legacy`), il vecchio formato delle mosse di F1 «per le gare cominciate prima» (`public/gara/main.js:847`).
- **Esportazioni mai usate (19):** tra le altre `nearPair` in `balilla-rules.js`, `cloneBalls` e `clonePins` in `public/biliardo/physics.js`, `CUSH_NAMES` in `engine.js`, `rotorWall` in `public/golf/courses.js`, `normalizeStyle` in `public/appearance.js`, `SINGLETONS` in `backup.js`, `RAMP_MOUTHS` in `physics-gt.js`.

**Q6. Labyrinth: ritirato ma tutto presente** — media-bassa, [V]

- **Dove:** `public/labyrinth/` (190 KB), `labyrinth-server.js` ed `expedition-model.js` (22 KB), sei file di prove (92 KB), più `public/labyrinth-link.js`.
- **Stato:** il codice lo chiama «the retired Labyrinth» (`lobby-hub.js:542`) e si apre solo in modalità sviluppo (`public/settings.js:111`). Però cinque delle 42 prove di `npm test` sono sue. **Correzione (Area 7):** avevo scritto che il passo della CI `test:multiplayer-runtime` provava solo Labyrinth. Era sbagliato: quel file (`tests/expedition-runtime.test.js`) ha il nome vecchio di Labyrinth ma prova tutti i giochi in diretta (tavoli, Pong, Moto Trial, Golf, Cinema); di Labyrinth aveva solo una trentina di righe.
- **Cosa decidere:** o torna un gioco vero, o esce dal repo (resta nella storia di git). Tenerlo a metà costa tempo a ogni controllo prima di `main`.

### 5.4 Coerenza tra moduli

**Q7. Due modi di scrivere** — media-bassa, [V]

- **Misura:** `format:check` controlla 54 file di codice su 184 (866 KB su 2.584 KB). L'elenco è scritto a mano in `package.json` e i file nuovi non ci entrano: sono fuori tutta la Lobby 3D, il Biliardo, F1, `public/app.js`.
- **Codice fitto:** 22 file (circa 280 KB) hanno righe lunghissime: `table-ai.js` arriva a 4.292 caratteri in una riga, `public/sea-cards-ui.js` a 3.121, `public/simulator/app.js` a 2.332, `public/app.js` a 861. In questi file un cambiamento di una parola diventa una riga intera diversa: le differenze tra versioni non si leggono.
- **Nello stesso file:** `lobby3d.js` alterna righe formattate e righe fitte secondo quando sono state scritte.

**Q10. Piccole incoerenze** — bassa, [V]

- **Lingua dei commenti:** 39 file in italiano, 39 in inglese, 8 misti (tra cui `worker.js`, `lobby-hub.js`, `public/app.js`, `api.js`).
- **Codici d'errore:** i tavoli rispondono 409 per quasi tutto (15 volte in `worker.js`) e 400 per ogni eccezione; F1, Biliardo e Golf 409 per ogni eccezione; altri moduli usano 400, 403, 404, 429 con più cura. Il telefono non può distinguere «non tocca a te» da «richiesta sbagliata».
- **Commenti rimasti indietro:** `.github/workflows/tests.yml:6` dice che staging «è una pagina bianca senza prove», ma oggi staging è l'app intera; `staging-worker.js` racconta la stessa cosa.
- **Controlli doppi:** nella CI `release:check` gira due volte (da solo e in fondo a `npm test`).
- **`npm test` è una riga sola** con 42 comandi in fila: la prima prova che fallisce nasconde le altre, e aggiungerne una vuol dire ritoccare quella riga.
- **Aggancio di prova acceso:** `public/gara/main.js:938` mette sempre `window.__gara` (regole, gara, avvio) a disposizione della pagina. In Acquedotto lo stesso aggancio c'è solo con `?dev` (`public/arcade/acquedotto.js:784`).
- **Nomi globali:** otto nomi appesi a `window` per far parlare i moduli tra loro (`binottolandClubRadio`, `binottolandLobbyLoading`, `binottolandRadioLevels`, `cabinetMonitor`…) invece di passarseli.

### 5.5 Gestione degli errori

**Q4. Errori veri mascherati sul server** — media, [V]

- **Dove:** `biliardo-server.js:345-346`, `f1-server.js:430-431`, `golf-server.js`, `labyrinth-server.js`, `simulator/server.js` (ogni eccezione → risposta 409 o simile con `error.message`), `worker.js:694-695` (ogni eccezione → 400 con `e.message`).
- **Cosa succede:** questi blocchi servono per i messaggi voluti («Non tocca a te»). Ma prendono anche gli errori di programmazione: un «Cannot read properties of undefined» dentro le regole diventa una risposta 409 con quel testo in inglese mostrato al giocatore. Non viene scritto niente nei log, perché `api.js:52` registra solo quello che arriva fino a lui.
- **Quando:** un difetto nelle regole del biliardo che scatta in una posizione rara. Il giocatore vede un messaggio strano e la partita si ferma; nei log di Cloudflare non resta traccia.
- **Rimedio:** un tipo di errore per i messaggi voluti (per esempio `class GameError extends Error`); tutto il resto si registra e risponde 500 con un testo generico.

**Q9. Errori che non si vedono sul telefono** — bassa, [V]

- **Dove:** `public/debug-log.js:48-57` (la cattura degli errori è solo sulla pagina principale).
- **Cosa succede:** Lobby 3D, flipper e balilla girano nella pagina principale e sono coperti. Biliardo, F1, Golf, Moto Trial, Pong, Acquedotto, Lunar Lander e gli altri giochi girano in un riquadro con la loro pagina: lì gli errori non vengono né mostrati nel registro né mandati al server.
- **Errori di rete ignorati:** `public/app.js:520` e `:643` (`try { render(await api('state')) } catch {}`): se l'aggiornamento del tavolo fallisce non succede niente e non si dice niente.
- **Catch vuoti:** sono 175 (più 36 `.catch(() => {})`). La gran parte è giusta: 61 proteggono la memoria del telefono, 32 un collegamento che può essere già chiuso, 26 le chiamate a Telegram, 14 puntatore e schermo intero, 10 l'audio. Ne restano una ventina su rete e altro, da guardare uno per uno.

### 5.6 Cose fatte bene

- **Le prove sono tante e girano tutte:** 65 file, 467 KB, quasi quanto tutto il codice del server. Nessun file di prova è rimasto fuori dagli script.
- **Una sola versione delle regole:** il server importa le regole dal telefono (`balilla-rules.js`, `public/biliardo/engine.js`, `public/gara/rules.js`, `public/golf/match.js`, `public/arcade/pong-physics.js`). È la scelta giusta e spiega perché l'Area 4 ha trovato poco.
- **Versione e timbri controllati da un programma** (`scripts/release.mjs`): niente file vecchi in memoria sul telefono.
- **Registro degli errori con i segreti oscurati** (`public/debug-log.js:4-8`) e invio al server limitato.
- **Nessun «da fare» dimenticato:** nel codice non ci sono TODO o FIXME.
- **Commenti che spiegano il perché**, spesso con il difetto che c'era prima.

---

## Area 6: staging contro main

### 6.1 Lo stato dei due rami

- **`main`:** commit `a615b09`, «1.0.60: pulizia e ordine del codice (analisi di Fable, area 5)». Cartella pulita, niente fuori da git.
- **`staging`:** commit `a7a56b9`, «Ordine (analisi Fable, area 5, gruppo 3)». Il numero di versione scritto nei file è ancora 1.0.51.
- **Storia:** i due rami si sono separati alla 1.0.46 (`c8d60d2`). Da allora staging ha 133 commit suoi e `main` 12. È giusto così: le modifiche si riportano a mano e i rami non si uniscono mai. Vuol dire però che git non può dire «cosa manca»: conta solo il confronto dei file, che è quello fatto qui.
- **Il confronto:** 22 file diversi. 2 esistono solo su staging, 0 solo su `main`, 20 hanno contenuto diverso. Tutto il resto, cioè server, Lobby 3D, flipper, biliardo, cinema, Ruggine, prove, è identico.

### 6.2 File per file

**Solo su staging**

| File | Cos'è | Proposta |
|---|---|---|
| `public/gara/sprint.js` (195 righe) | la modalità Sprint di F1: corsa in tempo reale contro l'IA | **togliere da staging** |
| `blender/auto.blend` (276 KB) | il sorgente di Blender dell'auto di F1. Il modello che ne esce, `public/gara/models/auto.glb`, è già su `main` | **portare su `main`**: è l'unico modello pubblicato il cui sorgente non è su `main` |

**Diversi per lo Sprint** (tutti da riportare uguali a `main`)

| File | Righe in più su staging | Cosa c'è |
|---|---|---|
| `public/gara/main.js` | +144, −7 | tutta la guida dello Sprint (vedi 6.3) |
| `public/gara/sound.js` | +60 | motore continuo e colpo del cambio |
| `public/gara/tutorial.js` | +10 | il fumetto «Sprint: si guida!» |
| `public/gara/gara.css` | +10 | i quattro tasti di modalità e i due pad per sterzare |
| `public/gara/index.html` | +5, −4 | tasto «Sprint», pad, tasti di zoom, timbri |
| `public/gara/scene3d.js` | +1 | l'aggancio che fa avanzare lo Sprint a ogni fotogramma |

**Diversi per il calcio balilla**

| File | Differenza | Proposta |
|---|---|---|
| `balilla-hub.js` | +17 righe (`:168-184`): chi si ricollega con una connessione nuova mentre quella vecchia, morta, tiene ancora il posto, si riprende subito il suo posto | **portare su `main`**. Su `main` oggi quella persona resta spettatrice finché il posto vecchio non si libera da solo, cioè fino a 30 secondi (`SEAT_GRACE`, `balilla-hub.js:22`), con la partita in pausa |
| `tests/balilla-bar.test.mjs` | +26 righe: la prova di quel caso | **portare su `main`** insieme |
| `public/lobby3d/balilla-rules.js` | 2 righe (`:139` un commento, `:441` la chiamata): in allenamento la palla ferma si rimette da sola se non ci arrivano le aste **di chi gioca**; su `main` si guardano tutte le aste, anche quelle ferme del lato vuoto | **portare su `main`**. Su `main` oggi, da soli, una palla ferma davanti alle aste del lato vuoto resta lì finché non premi Spazio |
| `public/lobby3d/balilla.js`, `public/lobby3d/lobby3d.js` | 1 riga l'uno: solo il timbro `?v=` | **lasciare**: si sistemano da soli con `npm run stamp` quando i due file sopra sono uguali |

**Diversi per l'ambiente di prova** (voluti)

| File | Differenza | Proposta |
|---|---|---|
| `.github/workflows/tests.yml` | su staging le prove di GitHub partono solo per `main`; su `main` per ogni ramo | **portare su `main`**: per `main` non cambia niente e il file diventa uguale |
| `scripts/deploy-gate.mjs` | +5 righe: su staging si pubblica senza aspettare le prove | **portare su `main`**: lì la riga non scatta mai (il ramo non è `staging`) |
| `wrangler.jsonc` | +1 riga di commento | **portare su `main`** |
| `docs/ambiente-di-prova.md` | spiega che staging pubblica senza prove; dice «Prove in corso su staging: Lobby 3D, F1 Sprint, Ruggine 89» (`:12`) | **aggiornare, poi portare su `main`**: quella riga non è più vera (Lobby 3D e Ruggine sono su `main`, lo Sprint va tolto) |

**Diversi per il numero di versione**

| File | Differenza | Proposta |
|---|---|---|
| `package.json`, `package-lock.json`, `api.js`, `public/app.js`, `public/index.html` | 1.0.51 su staging, 1.0.60 su `main`; in `app.js` e `index.html` anche i timbri che seguono | **allineare staging**: dopo ogni rilascio dare a staging lo stesso numero di `main` (`npm run release -- 1.0.60`). Non serve a chi usa l'app; serve a tenere il confronto pulito, così una differenza vera si vede subito |

### 6.3 Lo Sprint di F1: dove si trova

Va tolto del tutto. È solo su staging, in questi punti (numeri di riga di staging):

- **`public/gara/sprint.js`**: tutto il file (fisica, cambio a 7 marce, guida dell'IA).
- **`public/gara/main.js`:**
  - `:9` l'importazione di `sprint.js`;
  - `:77-78` `SPRINT_MAX` e il numero massimo di auto;
  - `:90` la modalità `'sprint'` tra quelle ricordate sul telefono;
  - `:134-135` il testo di spiegazione in «Nuova gara»;
  - `:274-275` `stopSprint()` e il salto a `startSprint` dentro `startRace`;
  - `:529` il tasto «Centra», che ha un ramo per lo Sprint;
  - `:537` `stopSprint()` dentro «Nuova pista»;
  - `:562-690` il blocco «Sprint: corsa in tempo reale»: zoom, motori, `startSprint`, `sprintInput`, `sprintFrame`, `sprintHud`, `sprintEnd`, i pad, i tasti della tastiera;
  - `:929` `get sprint()` nell'aggancio di prova.
- **`public/gara/index.html`:** `:36` il pad (`id="pad"`), `:38` i tasti di zoom `zOutR` e `zInR`, `:47` il tasto «Sprint» e la classe `modes`.
- **`public/gara/gara.css`:** `:85-94` (`.row.modes` e `.pad`).
- **`public/gara/sound.js`:** `:80-137` (`makeEngine` e `shift`), usati solo dallo Sprint.
- **`public/gara/tutorial.js`:** `:28-37` (il passo `sprint`).
- **`public/gara/scene3d.js`:** `:2082` (`onFrame`).
- **`docs/ambiente-di-prova.md`:** `:12`.

**Non c'entrano:** la parola `sprint` in `public/lobby3d/lobby3d.js` è il tasto per correre nella Lobby 3D (c'è anche su `main`). Non ci sono prove dello Sprint, né niente sul server.

**Il modo più sicuro per toglierlo:** dato che in quei sei file le differenze con `main` sono solo lo Sprint e i timbri, basta prendere da `main` le loro versioni, cancellare `sprint.js` e lanciare `npm run stamp`. Dopo, tutta la cartella `public/gara/` è identica a `main`.

**Cosa resta sui telefoni di chi l'ha provato:** due valori in memoria (`gara.sprintZoom` e la modalità `sprint` dentro `binotto-f1-setup`). Non danno fastidio: la modalità sconosciuta viene ignorata e si riparte da «Contro l'IA».

### 6.4 Solo su main

- **Nessun file.**
- **Nel contenuto:** il numero di versione 1.0.60; le prove di GitHub che partono per ogni ramo; la versione vecchia del documento sull'ambiente di prova; nel balilla la rimessa che guarda tutte le aste. Sono le stesse differenze di 6.2 viste dall'altra parte: `main` non ha niente che manchi a staging.

### 6.5 Fuori da git, nella cartella di staging

- **`blender/binotto-gt.blend`:** modificato e non salvato in un commit. Non so se il modello pubblicato (`public/lobby3d/models/binotto-gt.glb`) corrisponde alla versione modificata o a quella salvata.
- **Nove copie di sicurezza di Blender** (`.blend1`): `binotto-gt`, `divanetto`, `divano_lobby`, `drone`, `flipper`, `personaggio`, `sgabello`, `tavolo-balilla`, `tende`. Non sono in git e non sono ignorate, quindi compaiono a ogni controllo.
- **`blender/drone.blend1`:** è la copia di un file che in git non c'è più (il drone è stato tolto con il commit `70b731b`).
- **Le cartelle di Blender non vengono pubblicate:** Cloudflare serve solo `public/`. I sorgenti pesano circa 10 MB nel repo, ma non arrivano ai telefoni.

### 6.6 Rischi nel portare su main quello che resta

**R1. Ripresa del posto: stessa persona su due dispositivi** — media

- **Dove:** `balilla-hub.js:170-184`.
- **Cosa succede:** il blocco toglie dal tavolo ogni altra connessione della stessa persona, anche se è viva. Se la stessa persona ha la Lobby 3D aperta sul telefono e sul computer e tutti e due sono al tavolo, il telefono chiede il posto ogni 3 secondi quando non è seduto: i due dispositivi si rubano il posto a vicenda.
- **Quanto è probabile:** poco, ma chi prova l'app (telefono più Telegram Desktop) ci può cadere.
- **Rimedio possibile:** prendere il posto solo se la connessione vecchia tace da qualche secondo (c'è già `seenAt`).

**R2. Ripresa del posto: lato diverso** — bassa

- Se la connessione nuova chiede l'altro lato, quella vecchia viene tolta senza passare da `leave` (`:174-175`): non si fermano le sue aste e non si avvisa nessuno fino al passo dopo. Subito dopo la persona si siede dall'altra parte, quindi di solito non si nota.

**R3. Rimessa in allenamento** — bassa

- La riga nuova si fida del fatto che in allenamento «chi rimette» sia il lato di chi gioca. È così (`balilla-hub.js:289-290`), e quel codice è già uguale su `main`. Le regole girano anche sul server: va pubblicata insieme, telefono e server, come sempre.

**R4. Il metodo: file con versione e timbri** — media

- `public/app.js`, `public/index.html`, `public/lobby3d/balilla.js` e `public/lobby3d/lobby3d.js` contengono il numero di versione o timbri `?v=` diversi tra i rami. Copiandoli interi da staging si porta su `main` la versione 1.0.51 o un timbro sbagliato.
- **Regola:** copiare interi solo i file senza versione (`balilla-hub.js`, `balilla-rules.js`, la prova, i file dell'ambiente di prova), poi su `main` `npm run stamp` e `npm run release:check`. Il controllo ferma l'errore, ma solo se lo si lancia.

**R5. Togliere lo Sprint a metà** — media, vale per staging

- `main.js` aggancia i tasti dello Sprint appena parte (`$('pad')`, `$('zOutR')`, `$('zInR')`). Se si toglie il tasto dalla pagina ma non il codice, o si cancella `sprint.js` lasciando l'importazione, F1 non parte più per niente. I sette punti vanno tolti insieme.

**R6. Ruggine 89 è già pubblico** — da decidere

- Su `main` il cabinato «Ruggine 89» è sempre presente nella sala giochi della Lobby 3D (`public/lobby3d/lobby3d.js:1010`) e apre il gioco a tutto schermo (`:1119-1125`). Non è nell'elenco dei giochi della Lobby classica (`public/index.html` e `public/games-catalog.js` non lo nominano).
- Se era inteso come prova, oggi lo vedono tutti. Se va bene così, basta correggere il documento che lo dà ancora «in prova su staging».

**R7. Le prove su staging non girano su GitHub** — bassa

- È voluto, ma vuol dire che quello che si porta su `main` viene provato da GitHub solo dopo il commit su `main`. Prima di portare conviene lanciare a mano tutti i passi su `main`, come già fai.

---

## Area 7: prove

### 7.1 Cosa coprono gli 8 passi della CI

Tempi misurati su questo computer; tutti passano.

| # | Passo | Cosa controlla | File | Tempo |
|---|---|---|---|---|
| 1 | `release:check` | lo stesso numero di versione in sei punti e i timbri `?v=` aggiornati | — | 1 s |
| 2 | `format:check` | la formattazione di 54 file scelti a mano (un terzo del codice, vedi Area 5) | — | 2 s |
| 3 | `npm test` | regole di tutti i giochi da tavolo con partite complete; limiti e controlli del server (accessi, collegamenti, grandezza delle richieste, risultati, errori); calcio balilla, flipper, biliardo, F1, golf, Moto Trial; avvisi dei turni; radio; piccoli moduli della pagina | 36 | 49 s |
| 4 | `test:ui` | la pagina principale dentro un browser finto: Scopa, tutorial, avvio di Moto Trial e Golf, classifica | 1 (320 controlli) | 5 s |
| 5 | `test:simulator` | Binotto Simulator: fisica, sessioni, campionato, sponsor, avvisi, interfaccia | 17 | 32 s |
| 6 | `test:access` | 13 percorsi rifiutano accessi falsi, sessioni scadute, chi non è del gruppo | 1 | 1 s |
| 7 | `test:table-runtime` | dentro il server vero impacchettato: tavoli contro il computer, orologio dei turni, backup, F1, Biliardo | 5 | 46 s |
| 8 | `test:multiplayer-runtime` | dentro il server vero: spettatori, Forza 4, UNO, Scarabeo, navale, Briscola, Moto Trial, Pong, Number Connect, Cinema, Golf | 1 (253 controlli) | 8 s |

In tutto 61 file di prove e circa 2.280 controlli, in poco meno di due minuti e mezzo.

**Cosa non coprono per costruzione:** niente gira in un browser vero né dentro Telegram; niente guarda cosa si vede sullo schermo; su `staging` la CI non parte (voluto).

### 7.2 Prove fragili

**T1. Una prova fallisce a caso** — media, [V] [P]

- **Dove:** `tests/table-rules.test.js:24` (`assert.equal(own.uno.hand.length, 7)`).
- **Cosa succede:** la prova crea un tavolo di UNO contro il computer e si aspetta 7 carte in mano. Ma il mazzo è mescolato a caso: se la prima carta scoperta è un «+2», il primo giocatore ne pesca due e ne ha 9.
- **Prova:** 150 esecuzioni di fila, 3 fallite, tutte con «actual: 9». È fallita anche una volta durante le mie prove sui fusi orari.
- **Quando pesa:** è nel passo «Test principali». Circa una pubblicazione su 50 verso `main` trova la croce rossa su GitHub, e il cancello di pubblicazione di Cloudflare si ferma, senza che ci sia niente di rotto.
- **Aggiornamento del 25 novembre 2026: corretta su `staging`** (non ancora in un commit). Le cause erano due:
  - le carte di UNO: la prova ora accetta 7 carte, o 9 dopo un «+2» d'apertura, e controlla che la mano mostrata sia quella del server;
  - una seconda, più rara (2 volte su 400), scoperta ripetendo la prova: `table-rules.js` leggeva l'orologio due volte per «creato» e «scade», e se in mezzo scattava il millisecondo la scadenza non era a 7 giorni esatti (`tests/table-rules.test.js:10`). Ora l'orologio si legge una volta sola.
  - Dopo: 1000 esecuzioni di fila, nessun fallimento.

**T7. Prove che aspettano tempi veri** — bassa, [V] [P]

- `tests/lobby-presence.test.mjs`: aspetta 210 e 260 millisecondi un invio che parte dopo 200. Dieci millisecondi di margine.
- `tests/simulator-runtime.test.js`: quattro attese da 1,6 a 3,5 secondi. `tests/ui-scopa.test.mjs`: 22 attese fino a 1,2 secondi. `tests/simulator-ui.test.js`: 20 attese fino a 0,55 secondi. `tests/table-ai-runtime.test.js` e `tests/turn-clock-runtime.test.js`: orologio dei turni accorciato ma vero.
- **Prova:** fatte girare tre volte, dodici alla volta (computer molto occupato): 165 esecuzioni, nessun fallimento. Oggi reggono; il rischio è su una macchina di CI più lenta.

**T8. Prove a copione unico** — bassa, [V]

- `tests/expedition-runtime.test.js` (253 controlli) e `tests/ui-scopa.test.mjs` (320) sono un solo copione ciascuna, con un solo server finto o una sola pagina che passa da una parte all'altra. Se un controllo all'inizio fallisce, tutto il resto non gira e non si sa se è rotto.
- `expedition-runtime` ha ancora il nome di Labyrinth e, senza argomento, cerca il server in `/tmp/labyrinth-…`, un percorso che su Windows non esiste.

**T9. Partite complete con il caso vero** — bassa, [V]

- Scopa (90 partite), UNO (72), Forza 4 (600), battaglia navale (60), Briscola (240) vengono giocate fino in fondo con mescolate casuali vere. È un ottimo controllo, ma se un giorno una fallisce non c'è un seme da cui rifarla uguale. È la stessa radice di T1.

**Cosa ho provato per cercare fragilità [P]**

| Prova | Quanto | Esito |
|---|---|---|
| Tutte le prove, 25 volte l'una | 1.331 esecuzioni | nessun fallimento |
| `table-rules.test.js` da sola | 150 esecuzioni | 3 fallimenti (T1) |
| Tre fusi orari (Pacifico +14, Los Angeles, UTC) | 165 esecuzioni | un solo fallimento, quello a caso di T1 |
| Computer occupato: 12 prove insieme, 3 giri | 165 esecuzioni | nessun fallimento; la più lenta 34 s (`biliardo.test.js`) |
| Orologio spostato su 5 date (cambio dell'ora di marzo e ottobre, Capodanno, domenica notte, 29 febbraio) | 275 esecuzioni | 53 file su 55 passano sempre |

Le due che non passano con l'orologio spostato (`access-runtime`, `simulator-runtime`) non sono fragili: usano il server vero, che tiene l'orologio giusto mentre la prova lo aveva spostato. Con questo metodo non si possono giudicare.

**Dipendenza dal sistema:** non ne ho trovate di attive. Gli a capo di Windows sono gestiti dove servono (`tests/simulator-layout.test.js:15`). I passi 7 e 8 hanno bisogno di `wrangler` per impacchettare il server: **[S]** senza rete potrebbero non partire.

### 7.3 Zone importanti senza prove

**T2. Numerazione di tavoli e sale** — media, [V]

- **Dove:** `lobby-hub.js:497-499` (il primo numero libero) e `:586` (il numero resta quando la sala si aggiorna).
- **Cosa c'era:** nella parte di Labyrinth di `expedition-runtime.test.js`, tolta con il commit `49bfc59`, c'erano i controlli «la prima sala è la 1, la seconda la 2; cancellata la 1, due sale create nello stesso istante prendono 1 e 3; la 2 resta 2». Era l'unico punto che provava due creazioni contemporanee e il riuso dei numeri.
- **Oggi:** nessuna prova. Se la numerazione si rompe (due sale con lo stesso numero, numeri che crescono senza fine) non se ne accorge nessuno.

**T3. Il 40% del codice del telefono** — media, [V]

- 53 file sorgenti su 165 non sono toccati da nessuna prova: 923 KB su 2.337.
- **I più grandi:** `public/lobby3d/lobby3d.js` (143 KB), `public/gara/scene3d.js` (127), `public/biliardo/scene3d.js` (49), `public/arcade/acquedotto.js` (48), `public/biliardo/main.js` (46), `public/gara/main.js` (40), `public/lobby3d/flipper3d.js` (36), `public/radio.js` (35), `public/lobby3d/balilla.js` (29).
- **Tutta la Lobby 3D** è qui: scena, comandi, sgabelli, cinema, mixer, flipper e balilla visti dal telefono.
- **Anche pezzi piccoli ma delicati:** i collegamenti dei giochi (`f1-link.js`, `biliardo-link.js`, `golf-link.js`, `moto-link.js`), `public/games-catalog.js`, `public/settings.js`, `public/splash/intro.js`, e i due moduli nuovi `public/frame-errors.js` e `public/haptic.js`.
- **Perché è così:** il 3D non gira senza scheda grafica, e la Lobby 3D è una funzione sola (Area 5, Q1): non c'è niente di piccolo da provare.

**T4. Collegamento della Lobby** — media, [V]

- **Sul server:** la risposta al «ping» (`worker.js:710-712`) non è provata da nessuna prova. Sono provati il tetto di 3 collegamenti a persona e l'invio delle presenze.
- **Sul telefono:** la logica «riapri solo se chiuso o muto», il ping ogni 25 secondi e la coda dei messaggi del flipper stanno dentro `public/app.js` e non si possono provare da soli.
- **Quando pesa:** è il pezzo che ha causato i problemi C, D ed E dell'Area 2. Una modifica che lo rompe si vede solo dentro Telegram.

**T5. Calcio balilla a più giocatori** — media-bassa, [V]

- **Cosa c'è:** tre file (`balilla-bar`, `balilla-serve`, `seat-grace`), 61 controlli, con collegamenti finti dentro `BalillaHub`. Coprono: ingresso, due posti per lato, lato pieno, rimessa, pausa se uno tace, posto ripreso, posti fantasma.
- **Cosa manca:** i comandi di ognuno sulla propria coppia di aste quando c'è un compagno; il ripristino dei posti dopo una pausa del server (`restore`); tutto il giro vero, cioè i messaggi `balilla` che passano da `worker.js`, l'obbligo di essere nel club, l'app nascosta per 30 secondi.

**T6. Altre zone** — media-bassa, [V]

- **Lavagna:** `blackboard-server.js` (22 KB) ha prove solo su chi può cancellare e sui limiti. Entrare, disegnare, cancellare, indovinare a Pictionary: niente.
- **Flipper Binotto GT:** `public/flipper/physics-gt.js` non è importato da nessuna prova. `tests/physics-edges.test.mjs` prova solo il Grand Prix.
- **Sgabelli e classifica del flipper:** provati come moduli, mai attraverso i messaggi veri del collegamento.
- **Solo dentro il server impacchettato**, senza prove dirette: `worker.js`, `backup.js`, `pong-server.js`, `moto-trial-server.js`, `table-strategy.js`, `telegram-bot.js`. Va bene così, ma un errore lì si legge male.

### 7.4 Cose fatte bene

- Ogni gioco da tavolo viene giocato fino in fondo centinaia di volte.
- Il server vero impacchettato viene acceso nelle prove: non solo i pezzi, anche l'insieme.
- Le correzioni delle aree 1-6 hanno ognuna la sua prova (`absent-players`, `seat-grace`, `server-failure`, `physics-edges`, `arcade-result`, `abuse-limits`…).
- `npm test` ora trova da solo i file e li elenca tutti se falliscono.
- Nessuna dipendenza dal fuso orario o dalla data, nemmeno nei giorni del cambio dell'ora.

---

## Area 8: esperienza d'uso

### 8.1 Telefono e computer insieme

**U1. Calcio balilla senza scritte di stato** — media, [V]

- **Dove:** `public/lobby3d/balilla.js` (funzione `receive`: quando arriva lo stato dal server non scrive più niente; il pannello che lo faceva è stato tolto con la pulizia dell'Area 5), `:409` (l'unica scritta rimasta, «ATTACCO» o «DIFESA», è dentro il pad del telefono).
- **Cosa non viene detto:** se sei seduto o stai solo guardando; se il lato è pieno; se la partita è in pausa perché un giocatore non si fa sentire; a chi tocca far uscire la pallina; il punteggio, che si legge solo sulle palline del segnapunti.
- **Quando:** ti avvicini al tavolo con due persone già dal tuo lato e premi «Gioca». La vista va sul tavolo, le aste non rispondono e niente ti dice perché.
- **Su computer in più:** non c'è scritto nemmeno quale coppia di aste comandi. Lo dice solo il colore ottone delle manopole.

**U2. Messaggi d'errore sotto la Lobby 3D** — media, [V]

- **Dove:** `public/app.js:143` (`err` scrive nel riquadro `#error` della pagina classica), il foglio di stile in testa a `public/lobby3d/lobby3d.js` (la 3D copre tutta la pagina), `public/app.js:74` e `:123` (se la Lobby classica è libera, dopo due controlli a 0,7 secondi la 3D si riapre da sola; il controllo non guarda se c'è un errore mostrato).
- **Quando:** dalla 3D apri un tavolo di scacchi ma ne hai già uno aperto. La 3D si chiude, compare «Hai già un tavolo aperto di questo gioco: lo trovi nella campanella», e dopo un secondo e mezzo la 3D torna e lo copre. Lo stesso per «Troppe connessioni», «Hai aperto troppi tavoli di fila» e ogni errore di apertura.
- **Collegamento perso:** la scritta «● In diretta / Riconnessione…» è solo nella Lobby classica. Nella 3D, se il collegamento cade, gli altri personaggi si fermano e niente lo dice.

**U6. Nomi diversi per la stessa cosa** — media-bassa, [V]

- **Settings e Impostazioni:** la scheda e i tasti «‹ Settings» nell'app; «Impostazioni» sull'avviso della lavagna nella 3D; «⚙ Settings» disegnato sulla lavagna (`public/lobby3d/textures.js`).
- **Blackboard e Lavagna:** «Sale Blackboard», «Blackboard spazio libero» nell'app; «Lavagna» nella 3D e nei messaggi.
- **Tavolo, sala, stanza, partita, gara:** «Stanza inesistente o scaduta.», «La sala Pong è stata chiusa.», «Partita chiusa.», «Gara chiusa.», «Questa sala è stata chiusa.» per dire la stessa cosa.
- **Il turno:** «Non tocca a te.», «Non è il tuo turno.», «Non è il tuo turno di tiro.».
- **L'accesso:** cinque frasi diverse per «riapri l'app da Telegram».

**U9. Inglese rimasto e messaggi poco chiari** — bassa, [V]

- **Inglese nell'app:** «Settings», «Debug», «Live», «Blackboard», «Mini App». Nei flipper il gergo è voluto (Pit stop, Safety car, Jackpot, Multiball, Tilt). I nomi dei giochi in inglese sono nomi.
- **Un messaggio in inglese:** «DNS unavailable» (`radio-dns.js:12`).
- **Tecnici:** «WebSocket richiesto.» in quattro file; «BOT_TOKEN mancante.» (lo vede solo chi amministra).
- **Generici:** «Richiesta non valida.» e «Operazione non disponibile.», 11 volte in tutto: non dicono cosa è andato storto né cosa fare.
- **Il resto è buono:** su 353 messaggi d'errore, 267 diversi, quasi tutti in italiano semplice e con il motivo.

**U10. Caratteri piccoli e un testo vecchio** — bassa, [V]

- 288 punti con caratteri sotto i 12 px: 128 nel cruscotto del Simulator (fino a 7 px), 55 nel resto del Simulator, 47 in `public/app.css` (fino a 9,5 px), 19 nel Cinema, 18 in Giulio Simulator. Nella 3D le barre dei flipper sono a 11 px.
- C'è la scelta «Dimensione del testo» in Settings, che ingrandisce tutta la pagina (`public/settings.js:15`), 3D compresa: bene. Ma arriva al massimo a 1,25 volte: 7 px diventano 9.
- **Testo di Informazioni non più vero:** «La Lobby mostra nome, username e foto forniti da Telegram» (`public/index.html:62`). Dopo le correzioni dell'Area 1 lo username non viene più mandato agli altri.

### 8.2 Telefono (Android e iPhone dentro Telegram)

**U4. Scritte da tastiera sul telefono** — media, [V]

- **Flipper:** il display dice «PREMI E PER GIOCARE» (`public/lobby3d/flipper3d.js:145`), «E PER GIOCARE · 5 PALLINE» (`:818`, `:829`), «E per giocare» (`:793`) e a fine partita «S per ricominciare» (`:785`). Sul telefono non ci sono né E né S: si gioca con il tasto d'azione e si ricomincia toccando.
- **Sgabello:** i tasti sul telefono si chiamano «Prendi · G», «Posa · G», «↑ W», «↓ S» (`public/lobby3d/lobby3d.js:570-571`, `:604`). Le lettere sono i tasti della tastiera.
- **Fatto bene altrove:** il tasto d'azione aggiunge «(E)» solo su computer (`lobby3d.js:1734-1736`), e «Vista dagli occhi (V)» perde la lettera sul telefono (`:1283-1284`).

**U5. Comandi senza nome o spiegazione** — media-bassa, [V]

- **Balilla:** i due pad per inclinare la vista e per lo zoom mostrano solo «↕» e «🔍» (`balilla.js:248`, `:251`) e non hanno un nome per chi usa la lettura dello schermo. L'ingranaggio apre una «Taratura» con numeri grezzi («Pad: scorrimento 1.00», `:263` e seguenti).
- **Flipper:** la leva si tira tenendo premuto in basso al centro, ma la zona non è disegnata: ci sono solo tre barre con le scritte. La scossa non c'è (Area 3).
- **Spiegazioni invisibili:** 28 punti del codice mettono la spiegazione nel `title`, che compare passando il mouse. Sul telefono non compare mai.
- **Barra in alto:** sotto i 520 punti di larghezza i tasti si restringono e il testo viene tagliato con i puntini (regola `@media (max-width:520px)` nel foglio di stile di `lobby3d.js`): «✕ Lobby classica» e «Vista dagli occhi» possono non leggersi per intero. **[S]** Da guardare su un telefono stretto.

**Android e iPhone:** nelle scritte non c'è differenza. Le differenze note sono tecniche e stanno nell'Area 3: volumi su iPhone, tasto del silenzioso, tastiera sopra la chat della bacheca, voce del flipper assente su Android.

### 8.3 Computer (Telegram Desktop)

**U3. Comandi che non si possono scoprire** — media, [V]

- **Dove sono spiegati:** solo in Settings → Personaggio e pallina → «Comandi della Lobby 3D» (`public/index.html:62`): camminare, guardarsi intorno, aprire, abbassarsi, colpo, parata, sedersi. Sullo schermo della 3D non c'è niente (l'avviso iniziale è stato tolto).
- **Cosa manca del tutto, anche in Settings:**
  - **Flipper:** Z e M (o Maiuscole, o frecce) per i flipper; S, freccia giù o Invio per la leva; Spazio per la scossa. La riga d'aiuto sotto il flipper (`flipper3d.js:446`) parla di «tocco breve» e di «Spazio scossa», ma non dice quali tasti muovono i flipper.
  - **Calcio balilla:** Q cambia coppia, 1 e 2 la scelgono, Spazio fa uscire la pallina, E lascia il tavolo, + e − cambiano la sensibilità.
  - **Sgabello:** G lo prende e lo posa, W e S lo alzano e abbassano, Spazio molleggia. (G compare nel tasto d'azione, il resto no.)
  - **Pong del cabinato:** I e K (compare solo dopo averlo acceso).
  - **Bacheca:** Esc per tornare a camminare.
- **Mouse agganciato:** il primo clic nella 3D aggancia il mouse alla vista (`lobby3d.js:1546-1548`). Per liberarlo serve Esc, ma non è scritto da nessuna parte. Finché è agganciato non si possono toccare i cursori del volume né i tasti in alto.

**U7. Al balilla Esc ti fa alzare** — media-bassa, [V]

- **Dove:** `balilla.js:378-385`: quando il mouse si sgancia mentre la finestra è attiva, il tavolo si chiude.
- **Quando:** stai giocando, premi Esc per liberare il mouse (per esempio per abbassare il volume): perdi il posto.

**U8. Tab finisce sotto la 3D** — bassa, [V]

- La 3D copre la pagina classica ma non la spegne (nessun `inert`). Con Tab il fuoco passa ai tasti della pagina sotto, che non si vedono; Invio li preme.
- **Lettura dello schermo:** la 3D è un disegno, senza descrizioni. L'uscita però c'è ed è il primo tasto: «✕ Lobby classica», con il suo nome.

### 8.4 Cose fatte bene

- Quasi tutto è in italiano semplice: su 1.092 scritte raccolte, le sospette in inglese sono 11, quasi tutte nomi.
- Gli errori del server dicono quasi sempre il motivo e spesso cosa fare.
- Tutte le pagine hanno la lingua dichiarata; nessun tasto delle pagine è senza nome; gli errori della pagina classica sono annunciati (`role="alert"`).
- Il fuoco da tastiera si vede (21 regole `:focus-visible`), e chi ha chiesto meno animazioni viene rispettato in 10 punti.
- I tasti del telefono nella 3D sono grandi (46-58 punti) e rispettano i margini sicuri.
- La pagina dei comandi in Settings esiste ed è scritta bene: va solo completata.

---

## Proposte di miglioramento

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 1 | Posizione nella Lobby 3D: mandare un messaggio piccolo con le sole persone, non tutta la Lobby. Raccogliere i cambi e spedire al massimo ogni 200 ms. Freno sul server per collegamento. Tenere le classifiche in memoria e ricalcolarle solo quando arriva un risultato | 1, parte di 8 | medio |
| 2 | Togliere le chiamate tra oggetti da dentro `blockConcurrencyWhile`: il tavolo avvisa la Lobby dopo il blocco (o con `waitUntil`), la classifica non interroga più i tavoli | 2 | medio |
| 3 | Controllo del gruppo sui collegamenti: `null` vuol dire "non so", non "fuori". Una sola domanda a Telegram alla volta per persona. Controllo a tempo (per esempio ogni minuto) e non a ogni messaggio | 3 | piccolo |
| 4 | Tetto di collegamenti per persona (per esempio 3) su Lobby, tavoli, Cinema e lavagna. Posti riservati ai giocatori del tavolo | 4 | piccolo |
| 5 | Una funzione unica che legge la richiesta fermandosi al limite, usata ovunque al posto di `req.text()` e `req.json()` | 6 | piccolo |
| 6 | Lavagna: elimina solo chi l'ha aperta (la colonna c'è già), lavagna 1 non eliminabile, tetto di lavagne per persona e di tratti per lavagna, freno sui tratti | 7 | piccolo |
| 7 | Un freno generico per persona, in memoria, da usare su creazione di sale, sale Cinema, lavagne e sui messaggi in diretta. Tetto ai tavoli archiviati per persona, e mandarli solo ai loro giocatori | 8 | medio |
| 8 | Flipper: comando di amministrazione per togliere un punteggio, subito. Poi: il telefono annuncia l'inizio della partita e il server rifiuta punteggi impossibili per la durata | 5 | piccolo, poi medio |
| 9 | Classifiche: chiudere una partita in corso vale come abbandono (vittoria all'altro) oppure richiede l'accordo. Eliminare solo prima dell'inizio. Number Connect: non fidarsi del ritardo dichiarato | 9 | medio |
| 10 | Mandare ai telefoni solo nome, foto e un identificativo. Togliere nome utente e scadenza. Cifrare il backup prima di mandarlo a Telegram. Comando per cancellare i dati di una persona | 10 | piccolo, medio per il backup |
| 11 | Chiave segreta interna (o metodi separati) per i percorsi interni: ripristino, risultati, coda degli avvisi | 1.1 | medio |
| 12 | Sessione: durata massima dal primo accesso (per esempio 7 giorni) e ambiente scritto nel gettone. Bot separato per staging | 1.1 | piccolo |
| 13 | Pulizie: togliere `staging-worker.js`, correggere l'eliminazione di Labyrinth, messaggi di errore generici, scadenza per le chiavi `chatlimit:` e `migrated:`, non scrivere quando si legge un tavolo finito | 1.4, 1.5, 1.6 | piccolo |
| 14 | Calcio balilla: scadenza sul segnale "gioco sul telefono", fermare il timer dopo qualche minuto senza comandi | 1.3 | piccolo |
| 15 | Avvisi: togliere dalla coda solo dopo l'invio riuscito; il webhook risponde sempre "ok" a Telegram | 1.9 | piccolo |
| 16 | Prove automatiche per i punti 1-4: molti collegati che camminano, classifica e mossa insieme, Telegram che non risponde, collegamenti in eccesso | tutti | medio |

**Ordine consigliato:** 3, 4 e 5 subito (piccoli e chiudono tre problemi alti o medi), poi 1 e 2, poi il resto.

### Proposte per l'Area 2

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 2.1 | Biliardo, F1 e Golf mandano la chiave interna quando scrivono il risultato (come fa già Labyrinth) e controllano la risposta. Una prova automatica: partita finita → riga in classifica | A | piccolo |
| 2.2 | Flipper: tenere l'inizio della partita per persona (in memoria nell'oggetto Lobby, o nello spazio) invece che nel collegamento; il telefono rimanda inizio e punteggio se in quel momento è scollegato | C | piccolo |
| 2.3 | Non aprire un collegamento nuovo a ogni ritorno in primo piano: riaprirlo solo se è chiuso o non risponde. Da solo toglie gran parte di C, D ed E e dimezza gli invii completi della Lobby | C, D, E | piccolo |
| 2.4 | App nascosta: non far alzare subito dal balilla e dallo sgabello. Tenere il posto per un tempo di grazia (per esempio 20-30 secondi) e liberarlo solo se la persona non torna | D, E | medio |
| 2.5 | Calcio balilla: non azzerare il punteggio quando l'avversario si alza; azzerarlo quando si siede una persona diversa, o dopo il tempo di grazia | D | piccolo |
| 2.6 | Posti e sgabelli: liberarli quando il collegamento tace da troppo (il balilla ha già il segnale ogni 3 secondi, gli sgabelli hanno `seen`). Sgabelli: la stessa persona che torna si riprende la sua prenotazione | F | piccolo |
| 2.7 | Quando il collegamento della Lobby si riapre, il telefono rimette a posto il suo stato: si alza dallo sgabello o richiede la prenotazione, e si risiede subito al balilla senza aspettare il giro dei 3 secondi | D, E | piccolo |
| 2.8 | F1 e Biliardo: segnare quando ogni giocatore ha chiesto lo stato l'ultima volta. Chi non si fa sentire da 15-20 secondi viene guidato subito dal pilota automatico (pochi secondi invece di un minuto). Contare l'assenza per giocatore e non per partita | B | medio |
| 2.9 | F1 e Biliardo: tasto «Abbandona» per chi vuole uscire (da lì in poi pilota automatico immediato). Se il creatore è assente, anche gli altri possono chiudere. Biliardo a due: l'assenza prolungata dell'avversario vale come vittoria per chi resta | B | medio |
| 2.10 | Aprire dalla Lobby una partita in attesa mostra prima la sala d'attesa con un tasto «Entra», invece di farti entrare subito | B | piccolo |
| 2.11 | Calcio balilla: salvare punteggio e partite vinte a ogni gol, e riprenderli dopo un riavvio | G | piccolo |
| 2.12 | Pong: tenere il posto di chi è caduto per 15-20 secondi prima di offrirlo ad altri; mettere in pausa se uno dei due non manda comandi da qualche secondo | H | piccolo |
| 2.13 | Controllo del collegamento sul telefono: se dopo il segnale periodico non arriva niente entro pochi secondi, chiudere e riaprire. Su Cloudflare si può rispondere al segnale senza svegliare l'oggetto (`setWebSocketAutoResponse`) | I | piccolo |
| 2.14 | F1 e Biliardo: dopo alcune richieste di stato fallite mostrare «Collegamento perso, riprovo…»; se la sessione è scaduta dirlo | J | piccolo |
| 2.15 | Cabinati: chi guarda sta in piedi dietro, non sul primo posto; F1 con più di 5 piloti: gli altri in piedi accanto | 2.5 | piccolo |
| 2.16 | Prove automatiche: collegamento sostituito a metà partita (flipper, balilla, sgabello), giocatore assente in F1 e Biliardo, posto di Pong durante il ricollegamento | tutti | medio |

**Ordine consigliato per l'Area 2:** 2.1 e 2.2 prima di portare le correzioni di sicurezza su `main` (sono nati da lì). Poi 2.3, che è piccola e migliora tre problemi insieme. Poi 2.8 e 2.9, che sono il problema più sentito da chi gioca. Il resto dopo.

### Proposte per l'Area 3

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 3.1 | Misurare prima di tutto: un riquadro di prova (acceso da Debug) con fotogrammi al secondo, comandi di disegno, triangoli e texture (`renderer.info`), da guardare su un telefono economico e su uno buono | tutti | piccolo |
| 3.2 | Flipper: ridipingere il tabellone e aggiornare le lampadine solo se sei in sala giochi e vicino; da lontano una volta ogni tanto o mai. Togliere le mipmap dalla texture del tabellone | L1 | piccolo |
| 3.3 | Limite ai fotogrammi: 60 al massimo (30 sui telefoni lenti), e da fermi senza nessuno che si muove scendere a 20-30 o disegnare solo quando cambia qualcosa | L2 | piccolo |
| 3.4 | Un gruppo per sala, e nascondere le sale che non si possono vedere da dove sei (come già si fa per le luci). Dall'atrio restano visibili solo le sale che hanno la porta nell'inquadratura | L3 | medio |
| 3.5 | Unire gli oggetti fermi che hanno lo stesso materiale (muri, cornici, casse, pezzi dei cabinati, cinema) e riusare materiali e geometrie uguali invece di crearne uno a chiamata | L3 | medio |
| 3.6 | Personaggi: tetto a quelli disegnati per intero (per esempio i 12 più vicini), gli altri semplificati o solo con il nome; chi è nella Lobby classica non va disegnato o va disegnato semplice | L3 | medio |
| 3.7 | Luci: mettere le luci dei flipper nell'elenco per sala (rifare l'elenco quando arriva il modello). Biliardo: due faretti invece di quattro, o luce dipinta sul panno. Tetto di 4-5 luci accese | L4 | piccolo |
| 3.8 | Qualità automatica: se i fotogrammi durano troppo, abbassare la risoluzione, togliere l'antialias e i materiali con la vernice. Una scelta a mano in Settings (Alta, Media, Bassa) | L9 | medio |
| 3.9 | Togliere la sfocatura dietro ai tasti sul telefono (basta lo sfondo scuro semitrasparente). Tela trasparente solo quando c'è davvero un film da far vedere sotto | L9 | piccolo |
| 3.10 | Film: farlo partire solo in sala cinema o con lo schermo in vista; fuori, fermarlo e liberarlo. Non prepararlo durante lo splash. Con l'app nascosta metterlo in pausa | L5 | piccolo |
| 3.11 | Volumi di radio e film attraverso Web Audio, o pausa e muto al posto del volume a zero, così funzionano anche su iPhone. Radio spenta davvero in sala cinema | L6 | medio |
| 3.12 | Se la 3D non parte: passare subito alla Lobby classica, ricordarlo per quella sessione, non riprovare da soli e pulire la pagina. Un interruttore «Lobby 3D» anche in Settings | L7 | piccolo |
| 3.13 | Ascoltare `deactivated` e `activated` di Telegram e trattarli come app nascosta e tornata: fermare la 3D, la radio del club e segnare «assente» | L8 | piccolo |
| 3.14 | Memoria: liberare le tele dei disegni che non cambiano più dopo il primo invio alla scheda grafica; pareti a 1024 sui telefoni; tagliare i suoni del balilla in pezzetti corti | L10 | medio |
| 3.15 | Audio: risvegliarlo ogni volta che non è «in funzione» (non solo se «sospeso»); un motore audio solo per radio e Lobby | 3.4 | piccolo, medio per unirli |
| 3.16 | Comandi: joystick che nasce dove appoggi il dito; tasto «Scossa» per il flipper; disposizione da telefono solo se il primo comando è davvero un tocco; vibrazione su gol, colpi e flipper | 3.5 | piccolo ognuno |
| 3.17 | Pulizia del ciclo: non creare oggetti a ogni fotogramma, scrivere gli stili solo quando cambiano, casse della radio aggiornate 10 volte al secondo | 3.1 | piccolo |

**Ordine consigliato per l'Area 3:** 3.1 (misurare), poi 3.2, 3.3, 3.7, 3.9 e 3.10: sono tutti piccoli e insieme tolgono gran parte del consumo. Poi 3.12 e 3.13. Poi i medi: 3.4 e 3.5 (oggetti), 3.8 (qualità), 3.11 (iPhone).

### Proposte per l'Area 4

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 4.1 | Snooker: rimettere la bianca nella D cercando un punto libero, come fanno già palla 8 e palla 9 (`freeSpot`), anche dopo la parità sulla nera | G1 | piccolo |
| 4.2 | Flipper Grand Prix: cancelletto inclinato come nel Binotto GT. In più, per sicurezza su tutti e due: se una pallina resta ferma più di qualche secondo fuori dal pistone e dai box, una piccola spinta automatica | G2 | piccolo |
| 4.3 | Calcio balilla: tempo massimo di possesso (per esempio 10-15 secondi con la palla ferma o quasi vicino alle proprie aste), poi rimessa all'avversario | G3 | piccolo |
| 4.4 | Calcio balilla: rialzi più grandi ai lati delle porte, che riportino la palla verso l'asta della difesa, così non serve rimetterla dal foro | G4 | medio (va riprovato il gioco) |
| 4.5 | Calcio balilla: contare il gol quando il centro della palla supera la riga di poco (per esempio un terzo del raggio), oppure una leggera discesa dentro la porta. Nel rimbalzo dentro la porta, invertire la velocità solo se la palla va verso il lato | G5 | piccolo |
| 4.6 | Biliardo: leggere la direzione del colpo senza scambiare lo zero per «mancante» | G6 | piccolo |
| 4.7 | Flipper: negli urti tra palline saltare quelle sulla rampa (e non spostare quella ferma ai box) | G7 | piccolo |
| 4.8 | Flipper: nella fisica non creare oggetti a ogni passo (bersagli con raggio ed elasticità già pronti, niente copie dell'elenco) | G8 | piccolo |
| 4.9 | Portare nel repo le prove di simulazione come prove automatiche: partite a caso con seme fisso per i tre giochi, più i casi limite trovati (lancio a forza zero, bianca nella D, palla lenta in porta, direzione di traverso) | tutti | medio |
| 4.10 | Palla 8: il server rifiuta il colpo sulla nera senza buca chiamata; il pilota automatico chiama la buca più vicina alla nera | G9 | piccolo |
| 4.11 | 5 birilli: decidere i due casi (birilli prima dell'avversaria, birilli dal pallino mosso dalla propria bilia) e scriverli in `docs/biliardo.md` | G10 | piccolo |
| 4.12 | Togliere il codice del kickback che non si usa più; un solo limite di durata del colpo per server e animazione | 4.1, 4.3 | piccolo |

**Ordine consigliato per l'Area 4:** 4.1 e 4.2 (sono i due casi in cui una partita si rovina o si blocca), poi 4.6, 4.7 e 4.5 che sono righe singole. Poi 4.3. La 4.9 conviene farla insieme alle correzioni, così ogni caso resta controllato. La 4.4 cambia il gioco e va provata con calma.

### Proposte per l'Area 5

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 5.1 | Pulizia del codice morto, in un commit solo: computer del balilla (server e telefono), pannello nascosto, kickback, tasto audio e avviso nascosti della Lobby 3D, `staging-worker.js`, `telegram-setup.html`, le 19 esportazioni mai usate, compatibilità con Cluedo e con il vecchio formato di F1 | Q5 | piccolo |
| 5.2 | Decidere tre cose provvisorie: la taratura del balilla sul telefono (tenerla e toglierle l'etichetta, o toglierla), il flipper a pagina intera (collegarlo o toglierlo), le sagome a scatole (toglierle ora che i modelli ci sono) | Q5 | piccolo |
| 5.3 | Decidere Labyrinth: se resta fuori, togliere gioco, server, prove e il passo della CI | Q6 | piccolo |
| 5.4 | Errori del server: un tipo di errore per i messaggi voluti; ogni altro errore si scrive nei log e risponde 500 con un testo generico. In tutti i giochi e nei tavoli | Q4 | piccolo |
| 5.5 | Fisica dei flipper in un modulo solo (urti, flipper, pistone, palline, scossa, fine pallina) e due file piccoli con tracciato, rampe e punti | Q2 | medio |
| 5.6 | Una base comune per i giochi online a turni: sul server la parte Lobby, salvataggio, sveglia e assenze; sul telefono apri, chiudi, stato, orologio, margini e vibrazione. F1, Biliardo e Golf ci mettono solo le loro regole | Q3 | medio |
| 5.7 | Piccoli aiuti condivisi sul server: `userOf(req)` per leggere l'utente una volta, `lobbyHub(env)` ovunque, una sola `json`. Sul telefono: `prefs.js` ovunque, un solo «è un telefono?», una sola vibrazione | Q8 | piccolo |
| 5.8 | Dividere la Lobby 3D in moduli, uno per volta, cominciando da quelli più staccati: audio e mixer, cinema, bacheca, sgabelli, cabinati, comandi. Ogni modulo riceve quello che gli serve invece di leggere le variabili comuni | Q1 | grande (a tappe piccole) |
| 5.9 | Formattazione: far controllare a prettier tutte le cartelle (non un elenco a mano), con un elenco corto di esclusi. Portare dentro i file fitti un po' per volta, ognuno in un commit di sola formattazione | Q7 | piccolo per la regola, medio per i file |
| 5.10 | Cattura degli errori anche nelle pagine dei giochi: un piccolo modulo che manda l'errore alla pagina principale, che lo registra come gli altri. Messaggio visibile quando l'aggiornamento del tavolo fallisce | Q9 | piccolo |
| 5.11 | `npm test` che esegue tutti i file di `tests/` da solo e riporta tutti i fallimenti (per esempio `node --test`), senza la riga lunga; togliere il controllo doppio dalla CI | Q10 | piccolo |
| 5.12 | Dividere `Room.fetch` e `LobbyHub.lobby` in una tabella percorso → funzione; una chiave «tipo» salvata in ogni oggetto, così la sveglia sa subito di chi è | Q1 | medio |
| 5.13 | Piccole coerenze: `window.__gara` solo con `?dev`, commento di `tests.yml` aggiornato, una lingua sola per i commenti nuovi, codici d'errore distinti (400 richiesta sbagliata, 403 non puoi, 409 la partita è cambiata) | Q10 | piccolo |

**Ordine consigliato per l'Area 5:** 5.1, 5.2 e 5.3 insieme (sono solo togliere, e alleggeriscono tutto il resto). Poi 5.4 e 5.10, che fanno vedere gli errori veri. Poi 5.7 e 5.11. La 5.5 conviene farla insieme alle correzioni dei flipper dell'Area 4. La 5.6 e la 5.8 sono i lavori grossi: vanno fatti a pezzi, quando si tocca comunque quel codice.

### Proposte per l'Area 6

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 6.1 | Togliere lo Sprint da staging: prendere da `main` i sei file di `public/gara/`, cancellare `sprint.js`, `npm run stamp`. Controllare che F1 parta in tutte e tre le modalità | S2, R5 | piccolo |
| 6.2 | Portare su `main` la ripresa del posto al balilla con la sua prova, aggiungendo la condizione «solo se la connessione vecchia tace da qualche secondo» | S3, R1, R2 | piccolo |
| 6.3 | Portare su `main` la rimessa in allenamento che guarda solo le aste di chi gioca | S4 | piccolo |
| 6.4 | Portare su `main` `blender/auto.blend` | S5 | piccolo |
| 6.5 | Portare su `main` i tre file dell'ambiente di prova (`tests.yml`, `deploy-gate.mjs`, `wrangler.jsonc`), che lì non cambiano niente | S7 | piccolo |
| 6.6 | Aggiornare `docs/ambiente-di-prova.md` (togliere la riga «Prove in corso») e portarlo su `main` | S7, R6 | piccolo |
| 6.7 | Dare a staging il numero di versione di `main` dopo ogni rilascio | S8, R4 | piccolo |
| 6.8 | Blender: decidere il modello modificato del Binotto GT (salvarlo o scartarlo), cancellare `drone.blend1`, aggiungere `*.blend1` a `.gitignore` sui due rami | S6 | piccolo |
| 6.9 | Decidere Ruggine 89: lasciarlo pubblico com'è, oppure toglierne il cabinato da `main` finché non è pronto | S1, R6 | piccolo |
| 6.10 | Un controllo ripetibile: un piccolo programma che elenca le differenze tra i due rami lasciando fuori versione e timbri. Dopo 6.1-6.7 deve dire «nessuna differenza»; da lì in poi ogni riga che compare è una modifica ancora da portare | tutti | piccolo |

**Ordine consigliato per l'Area 6:** 6.1 su staging. Poi, in un solo commit su `main` con versione +1, le 6.2, 6.3, 6.4, 6.5 e 6.6. Poi 6.7 su staging. A quel punto i due rami sono uguali, e la 6.10 serve a tenerli così. Le 6.8 e 6.9 sono decisioni tue e non bloccano il resto.

### Proposte per l'Area 7 (prove nuove, in ordine di utilità)

| # | Proposta | Risolve | Sforzo |
|---|---|---|---|
| 7.1 | Rendere certa `table-rules.test.js`: mazzo con seme fisso, oppure accettare 7 o 9 carte spiegando perché. Nelle prove a partite complete usare un seme e stamparlo quando falliscono | T1, T9 | piccolo |
| 7.2 | Numerazione di tavoli e sale, nel server vero: la prima è la 1, la seconda la 2; cancellata la 1, due creazioni nello stesso istante prendono 1 e 3; il numero resta dopo un aggiornamento. Con sale di Pong o Golf al posto di Labyrinth | T2 | piccolo |
| 7.3 | Collegamento della Lobby, lato server: «ping» → «pong», quarto collegamento della stessa persona che chiude il più vecchio, app nascosta e posto tenuto 30 secondi. Nel server vero | T4 | piccolo |
| 7.4 | Collegamento della Lobby, lato telefono: spostare la logica (riapri solo se chiuso o muto, ping ogni 25 secondi, coda dei messaggi) in un modulo piccolo e provarlo con un collegamento finto e un orologio finto | T4 | medio |
| 7.5 | Calcio balilla attraverso il server vero, con quattro telefoni finti: due per lato, ognuno muove solo la sua coppia, pausa se uno tace, posto ripreso da una connessione nuova, server messo in pausa e riacceso con i posti al loro posto | T5 | medio |
| 7.6 | Flipper: i casi limite del Binotto GT (cancelletto, tre rampe, box) e partite a caso con seme fisso su tutti e due i tavoli, dai programmi dell'Area 4 | T6 | piccolo |
| 7.7 | Lavagna nel server vero: entrare, disegnare, cancellare, eliminare solo la propria, indovinare a Pictionary | T6 | medio |
| 7.8 | Collegamenti di F1 e Biliardo sul telefono: richiesta di stato che fallisce → «Collegamento perso», sessione scaduta, ritorno della rete. Con una rete finta | T3 | piccolo |
| 7.9 | Sgabelli e classifica del flipper attraverso i messaggi veri del collegamento (non solo i moduli) | T6 | piccolo |
| 7.10 | Dividere le due prove a copione unico in parti che falliscono da sole; rinominare `expedition-runtime` in `multiplayer-runtime` | T8 | piccolo |
| 7.11 | `lobby-presence`: orologio finto al posto delle attese vere | T7 | piccolo |
| 7.12 | Lobby 3D: man mano che si divide in moduli (proposta 5.8), provare le parti senza grafica: urti con i muri, gradini del cinema, sala e luci, primo posto libero, posa mandata al server. Per il resto una lista di controlli a mano da fare prima di ogni rilascio (camminare in ogni sala, sedersi, flipper, balilla in due, cinema) | T3 | medio |
| 7.13 | Un nono passo facoltativo, non bloccante: partite a caso lunghe di balilla e biliardo con seme fisso (Area 4) | T3 | piccolo |

**Ordine consigliato per l'Area 7:** 7.1 subito (oggi una pubblicazione su 50 si ferma per niente). Poi 7.2 e 7.3, che rimettono le prove perse e coprono il punto più delicato. Poi 7.5 e 7.6. La 7.4 e la 7.12 vanno insieme al riordino del codice dell'Area 5.

### Proposte per l'Area 8

| # | Proposta | Risolve | Dove | Sforzo |
|---|---|---|---|---|
| 8.1 | Calcio balilla: una riga di stato sempre visibile mentre sei al tavolo: «Rossi · attacco», «Lato pieno: stai guardando», «In pausa: aspettiamo Anna», «Tocca a te far uscire la pallina», e il punteggio in cifre | U1 | tutti e due | piccolo |
| 8.2 | Mostrare gli errori dentro la 3D (un avviso in alto che resta qualche secondo), e non riaprire la 3D finché c'è un errore mostrato sotto. Un segno «Riconnessione…» nella 3D quando il collegamento cade | U2 | tutti e due | piccolo |
| 8.3 | Un tasto «?» nella 3D che mostra i comandi di quello che stai facendo (camminare, flipper, balilla, sgabello, Pong), diversi per telefono e computer. Completare la pagina dei comandi in Settings con le stesse righe | U3, U5 | tutti e due | medio |
| 8.4 | Sul computer, al primo clic che aggancia il mouse: un avviso breve «Esc libera il mouse». Al balilla, Esc libera il mouse senza far alzare; ci si alza con E | U3, U7 | computer | piccolo |
| 8.5 | Scritte giuste per il dispositivo: sul telefono il display dei flipper dice «TOCCA PER GIOCARE» e «Tocca per ricominciare»; i tasti dello sgabello senza lettere («Prendi», «Posa», «↑», «↓») | U4 | telefono | piccolo |
| 8.6 | Nome ai due pad del balilla («Vista», «Zoom») e alla zona della leva del flipper; taratura con parole al posto dei numeri, o tolta | U5 | telefono | piccolo |
| 8.7 | Un solo nome per ogni cosa, deciso una volta: Impostazioni o Settings, Lavagna o Blackboard, e «sala» per i giochi arcade e «tavolo» per i giochi da tavolo anche nei messaggi. Una sola frase per «non tocca a te» e una per «riapri l'app da Telegram» | U6, U9 | tutti e due | piccolo |
| 8.8 | Raccogliere i messaggi d'errore in un solo file, così le frasi uguali restano uguali; sostituire «Richiesta non valida.» e «Operazione non disponibile.» con il motivo; tradurre «DNS unavailable» | U9 | tutti e due | medio |
| 8.9 | Spegnere la pagina sotto quando la 3D è aperta (`inert`), così Tab resta nella 3D | U8 | computer | piccolo |
| 8.10 | Caratteri: minimo 12 px fuori dal cruscotto del Simulator; aggiornare il testo di Informazioni sullo username | U10 | tutti e due | piccolo |
| 8.11 | Le spiegazioni messe nei `title` che servono davvero: scriverle anche sullo schermo, perché sul telefono non compaiono | U5 | telefono | piccolo |

**Ordine consigliato per l'Area 8:** 8.1 e 8.2 (sono i due punti in cui chi gioca non capisce cosa succede). Poi 8.5 e 8.4, piccoli e molto visibili. Poi 8.3, che chiude tutti i comandi nascosti. Il resto quando capita.
