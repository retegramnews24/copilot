# Analisi di Binottoland Playground

Analisi in sola lettura, fatta il 24 novembre 2026 sul ramo `staging`.

- **Area 1: sicurezza e server**, letta sul commit `33ef835`.
- **Area 2: multigiocatore**, letta sul commit `005b97d`, cioè dopo i tre commit «Sicurezza (analisi Fable, gruppo 1, 2 e 3)».

- **Area 3: Lobby 3D su telefono**, letta sul commit `dcbc5e6` (dopo i quattro commit «Multigiocatore (analisi Fable, area 2)»).
- **Area 4: fisica e regole dei giochi**, letta sul commit `dbb8d06` (dopo i commit «Lobby 3D (analisi Fable, area 3…)»).

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
