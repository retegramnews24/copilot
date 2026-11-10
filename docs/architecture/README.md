# Struttura del codice

Questa guida descrive dove intervenire quando lavoriamo su una singola funzione di Binottoland e come continuare a separare il progetto senza cambiare il comportamento delle parti non coinvolte.

## Struttura presente

```text
worker.js                  ingresso Worker, routing API e Durable Object
cinema-*.js                server e integrazioni del Cinema
*-server.js                runtime dei giochi multiplayer
*.(js)                     regole e modelli condivisi dei giochi da tavolo
public/
  app.js                   lobby e collegamenti fra le funzioni
  cinema/                  interfaccia Cinema, catalogo e condivisione schermo
  blackboard/              lavagna
  arcade/                  giochi arcade
  golf/                    Golf
  labyrinth/               Labyrinth
  moto-trial/              Moto Trial
tests/                     verifiche dei moduli e dei runtime
```

Le cartelle sotto `public/` sono già il confine principale per l’interfaccia di ciascun gioco. Alcuni motori server e regole dei giochi sono ancora alla radice: gli spostamenti vanno fatti per gruppi piccoli, aggiornando insieme tutti gli import e mantenendo invariati i nomi degli endpoint e lo stato salvato.

## Regole per le modifiche

- Per un gioco, partire dalla sua cartella `public/<gioco>/` e dal relativo modulo server o regole.
- Per il Cinema, mantenere separati interfaccia (`public/cinema/`), coordinamento del Worker (`worker.js`) e moduli server `cinema-*.js`.
- Lasciare a `worker.js` il ruolo di ingresso e instradamento; non accorpare lì logica di interfaccia o regole di gioco.
- Modificare i file condivisi solo quando la funzione li richiede davvero. La lobby in `public/app.js` deve contenere solo i collegamenti necessari fra lobby e moduli.
- Quando una funzione ha più responsabilità, estrarla in un modulo dedicato vicino alla funzione che la usa, evitando una riscrittura generale.
- Ogni riorganizzazione dei moduli deve essere un cambiamento separato dal lavoro funzionale: prima si spostano i file e si aggiornano gli import, poi si modifica il comportamento.

## Struttura server da adottare gradualmente

La direzione per i prossimi spostamenti è:

```text
server/
  cinema/       Cinema, inoltri Telegram e media
  games/
    board/      scacchi, dama e giochi da tavolo
    arcade/     Pong e altri giochi arcade
    3d/         Labyrinth, Golf e Moto Trial
  radio/        catalogo e metadati radio
  blackboard/   backend della lavagna
```

Questa è la destinazione delle migrazioni future, non un inventario dei percorsi già spostati. Si migra una cartella alla volta, con una modifica neutra e verificabile; `worker.js` resta l’ingresso e importa i moduli dai nuovi percorsi. Non si spostano tutti i giochi in un’unica modifica.

## Cinema: confine fra le sorgenti

- **Guarda insieme** apre link HTTPS a stream o YouTube.
- **Condividi finestra** usa il modulo WebRTC del Cinema.
- **Invia al Cinema** riceve video, immagini e audio inviati o inoltrati al bot Telegram.
- La riproduzione dei media della coda Telegram rimane nel Cinema anche se viene rimossa una funzione di upload diretto dal dispositivo.

Le sorgenti hanno percorsi distinti. Una modifica a una sorgente non deve rimuovere o cambiare le altre.
