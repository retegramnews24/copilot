# Binottoland — motore a turni 0.1

Prima base per Cloudflare Workers Free: due giocatori, primo avversario che accetta, spettatori in diretta, salvataggio su Durable Object con backend SQLite. L'interfaccia è inclusa nello stesso Worker. Non contiene ancora scacchi né autenticazione Telegram.

## Caricamento su GitHub

1. Estrai lo ZIP.
2. Apri `retegramnews24/copilot` su GitHub.
3. Carica **i file contenuti nella cartella**, direttamente nella radice della repo: `package.json`, `wrangler.jsonc`, `worker.js`, `README.md` e la cartella `public` con entrambi i suoi file. Non caricare lo ZIP e non creare una cartella intermedia.
4. Non sovrascrivere file utili di altri progetti: questo pacchetto è per la repo di test concordata. Vecchi file di configurazione/build nella repo possono richiedere rimozione o adattamento.
5. Salva il commit sul ramo che colleghi a Cloudflare.

## Cloudflare: schermata già aperta

- Project name: `binottoland-motore`
- Build command: vuoto
- Deploy command: `npx wrangler deploy`
- Preview builds: disattivati
- Protect with Cloudflare Access: disattivato
- Root directory, se visibile nelle impostazioni avanzate: radice del repository
- Ramo: quello in cui hai caricato questi file (normalmente `main`)

Poi premi Deploy. Non attivare Workers Paid: la migrazione `new_sqlite_classes` usa le Durable Objects consentite nel piano Free.
Non occorre creare D1, aggiungere un dominio, inserire un token bot o creare manualmente una Durable Object. Binding e classe sono dichiarati nel file di configurazione; le singole stanze nascono alla prima sfida.

Cloudflare fornirà un indirizzo HTTPS `workers.dev`. Gli aggiornamenti del ramo collegato pubblicheranno nuove versioni. Questa consegna non è stata caricata nella repo e non è stata ancora eseguita sul tuo account.

## Cosa provare dopo il deploy

1. Apri l'URL, inserisci il tuo nome e premi Apri una sfida.
2. Copia l'invito e aprilo su un secondo telefono o un altro profilo del browser.
3. Inserisci un altro nome e premi Accetta la sfida.
4. Alterna Passa il turno tra i due giocatori.
5. Apri il link su un terzo browser: potrà assistere senza muovere.
6. Se due persone provano ad accettare, soltanto una deve ottenere il posto.
7. Ricarica: il posto deve restare associato al browser e lo stato al server.

Per simulare persone diverse usa dispositivi o profili browser diversi. Due schede dello stesso browser condividono la memoria locale e quindi rappresentano lo stesso giocatore.

## Architettura

- Worker: crea e instrada le richieste alle stanze.
- Durable Object: serializza le azioni, controlla il turno e la revisione dello stato, salva prima di rispondere. Due accettazioni o due mosse concorrenti non devono occupare lo stesso posto o consumare due turni.
- Storage API: salva lo stato nel backend SQLite della stanza.
- WebSocket Hibernation API: aggiorna i giocatori e gli spettatori quando lo stato cambia, senza polling e senza timer attivi nella stanza.
- Connessioni WebSocket di sola lettura; le azioni passano via HTTP con token del giocatore.

## Limiti intenzionali di questa prova

- Chi ha il link può assistere e, se il posto è libero, accettare. Nessuna verifica di appartenenza a Binottoland.
- Il nickname non prova l'identità. Il token casuale del posto è conservato solo nella memoria locale del browser. Svuotarla fa perdere l'accesso al posto; non esiste ancora recupero tramite account Telegram.
- Le partite scadono dopo 7 giorni, quindi vengono eliminate automaticamente, compresi i risultati. Questo evita accumulo indefinito nel prototipo.
- Massimo 60 connessioni per stanza e 500 passaggi di turno per partita. Le connessioni non equivalgono a persone uniche.
- Nessun bot invia messaggi: si copia e si condivide manualmente l'invito.
- Nessuna protezione completa contro creazione massiva di stanze: usa il prototipo solo per le prove private. Prima dell'apertura al gruppo aggiungeremo autenticazione Telegram e limiti per utente.
- Nessuna dipendenza o servizio a pagamento è attivato dal codice. Si applicano comunque le quote condivise del tuo account Cloudflare.

## Controlli effettuati

Sintassi JavaScript e struttura del pacchetto. Il deploy, il comportamento delle Durable Objects e la partita tra telefoni vanno verificati sul piano Cloudflare reale: non sono ancora stati provati in quel runtime.

## Sviluppo locale facoltativo

Node 22 o successivo, `npm install`, poi `npm run dev`. Pubblicazione manuale facoltativa: `npm run deploy` dopo aver autenticato Wrangler nel proprio account. Non condividere credenziali o token in chat/repository.
