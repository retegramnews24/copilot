# Analisi di Binottoland Playground

Analisi in sola lettura, fatta il 24 novembre 2026 sul ramo `staging` (commit `33ef835`).
Per ora copre solo l'**Area 1: sicurezza e server**. Le altre aree verranno aggiunte in fondo.

**Vale anche per la produzione.** Il codice del server su `main` (`d2c9a02`, versione 1.0.57) è uguale a quello di `staging`, tranne quattro differenze piccole: il numero di versione in `api.js`, 17 righe in `balilla-hub.js`, un commento in `wrangler.jsonc` e il file `staging-worker.js`.

**Legenda**

- **[V]** verificato leggendo il codice.
- **[S]** sospetto: il meccanismo è nel codice, ma l'effetto reale va confermato con una prova.
- Gravità: alta, media, bassa.

**Cosa ho letto per intero:** `worker.js`, `api.js`, `auth.js`, `worker-shared.js`, `lobby-hub.js`, `balilla-hub.js`, `club-pinball.js`, `club-stools.js`, `leaderboard.js`, `match-series.js`, `table-rules.js`, `cinema-server.js`, `cinema-routes.js`, `cinema-telegram.js`, `cinema-media.js`, `cinema-youtube.js`, `blackboard-server.js`, `turn-notices.js`, `telegram-bot.js`, `backup.js`, `radio-metadata.js`, `pong-server.js`, `golf-server.js`, `f1-server.js`, `biliardo-server.js`, `moto-trial-server.js`, `labyrinth-server.js`, `simulator/server.js`, `staging-worker.js`, `wrangler.jsonc`, `scripts/deploy-gate.mjs`.

**Cosa ho letto solo in parte** (ricerche mirate): le regole dei giochi di carte (solo la parte che decide cosa vede ogni giocatore), `public/lobby3d/balilla-rules.js`, `public/arcade/number-connect-rules.js`, `public/app.js` e `public/lobby3d/lobby3d.js` (solo quanto spesso scrivono al server).

**Cosa non ho letto:** `simulator/engine.js` e il resto del simulatore, `expedition-model.js`, `table-ai.js`, `table-strategy.js`.

---

## I 10 problemi più importanti

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
