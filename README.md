# Binottoland

Mini App Telegram del circolo. Si apre dal bot **@checkmategame_bot** ed è riservata ai membri del gruppo Telegram configurato: chi non ne fa parte non può entrare.

Gira su Cloudflare Workers (Worker `binottoland-motore`, Durable Objects con SQLite). Il ramo `main` viene pubblicato in automatico a ogni push.

## Cosa contiene

| Area | Documentazione |
| --- | --- |
| Accesso, sessioni, pubblicazione e conservazione dello stato | [docs/accesso.md](docs/accesso.md) |
| Giochi da tavolo: scacchi, Dama italiana, Forza 4, UNO, Scarabeo, Battaglia navale, Briscola, Scopa; avversari AI, tornei e classifica | [docs/giochi-da-tavolo.md](docs/giochi-da-tavolo.md) |
| Labyrinth · spedizioni multiplayer in prima persona | [docs/labyrinth.md](docs/labyrinth.md) |
| Golf with your gay friends | [docs/golf.md](docs/golf.md) |
| Moto Trial · platform 2D | [docs/moto-trial.md](docs/moto-trial.md) |
| Binotto Simulator · manager di scuderia | [docs/binotto-simulator.md](docs/binotto-simulator.md), [docs/circuit-pits.md](docs/circuit-pits.md) |
| Cinema Streamer | [docs/cinema.md](docs/cinema.md) |
| Radio | [docs/radio.md](docs/radio.md) |
| Struttura del codice e regole per le modifiche | [docs/architecture/README.md](docs/architecture/README.md) |

## Interfaccia

- Lobby: tavoli, presenti e ultimi 100 messaggi della chat comune.
- Giochi: il pulsante per creare tavoli è nella pagina Giochi. La Lobby conserva elenco, presenti e chat.
- Settings: palette indipendenti per interfaccia, scacchiera e pezzi. Il pulsante Debug apre stato, archivio, replay e registro diagnostico.
- Radio: controllo compatto con stazioni, preferiti e volume personali. L'audio resta nello stesso documento durante la navigazione; gli stream sono caricati direttamente dal dispositivo. La selezione radio viene caricata su richiesta da Radio Browser, con host alternativi, riprendendo il funzionamento del progetto DABradio.

## Sviluppo

```bash
npm ci          # installa le dipendenze bloccate in package-lock.json
npm run dev     # Worker locale con wrangler
npm test        # motori dei giochi, rendering, radio, cinema, simulatore
```

Altri controlli: `npm run test:simulator`, `npm run test:access`, `npm run test:table-runtime`, `npm run test:multiplayer-runtime`, `npm run test:ui`. Formattazione: `npm run format:simulator` e `npm run format:check`.

Controlli locali eseguiti con API Durable Object e DOM simulati: identità firmata, autorizzazioni, partite, patta, archivio/replay, presenza/chat, accesso automatico con Telegram e navigazione/radio. La verifica degli stream e della resa audio nel client Telegram richiede dispositivi reali.

## Progetti distinti

Binottoland è il circolo. DABradio e binottoland_hub rimangono progetti separati; il secondo mantiene il ruolo di Hub pubblico con TV, radio e giochi single player.
