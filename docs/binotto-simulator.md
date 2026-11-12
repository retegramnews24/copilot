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

Una proposta sceglie lun–dom, una o due gare al giorno, orari e data iniziale. Almeno 90 minuti tra gli eventi. Il calendario viene approvato con maggioranza assoluta degli iscritti e almeno due voti. La riformulazione annulla i voti della proposta precedente. Alla conferma vengono fissati 13 appuntamenti e la lista dei partecipanti; le iscrizioni alla stagione si chiudono. Ogni membro può comunque creare e gestire la propria scuderia, seguire gare e prepararsi alla stagione successiva.

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
