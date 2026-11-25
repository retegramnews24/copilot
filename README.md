# Binottoland

Mini App Telegram del circolo. Si apre dal bot **@checkmategame_bot** ed è riservata ai membri del gruppo Telegram configurato: chi non ne fa parte non può entrare.

Gira su Cloudflare Workers (Worker `binottoland-motore`, Durable Objects con SQLite). Il ramo `main` viene pubblicato in automatico a ogni push.

## Cosa contiene

| Area | Documentazione |
| --- | --- |
| Accesso, sessioni, pubblicazione e conservazione dello stato | [docs/accesso.md](docs/accesso.md) |
| Giochi da tavolo: scacchi, Dama italiana, Forza 4, UNO, Scarabeo, Battaglia navale, Briscola, Scopa; avversari AI, tornei e classifica | [docs/giochi-da-tavolo.md](docs/giochi-da-tavolo.md) |
| Golf with your gay friends | [docs/golf.md](docs/golf.md) |
| Moto Trial · platform 2D | [docs/moto-trial.md](docs/moto-trial.md) |
| Acquedotto! · puzzle 3D con l'acqua | [docs/acquedotto.md](docs/acquedotto.md) |
| F1 on paper! · gara a quadretti, da soli o online | [docs/f1-on-paper.md](docs/f1-on-paper.md) |
| Ruggine 89 · corsa con i colpi | [docs/ruggine-89.md](docs/ruggine-89.md) |
| Binotto Simulator · manager di scuderia | [docs/binotto-simulator.md](docs/binotto-simulator.md), [docs/circuit-pits.md](docs/circuit-pits.md) |
| Cinema Streamer | [docs/cinema.md](docs/cinema.md) |
| Radio | [docs/radio.md](docs/radio.md) |
| Struttura del codice e regole per le modifiche | [docs/architecture/README.md](docs/architecture/README.md) |

## Interfaccia

- Lobby: in cima "Adesso" (tocca a te, chi ti aspetta, sale Cinema/Blackboard attive), poi tavoli, chat comune (ultimi 100 messaggi) e persone online in una riga di avatar. Le sezioni Cinema e Blackboard compaiono solo con sale aperte.
- Giochi: "I tuoi giochi" (preferiti ☆ e recenti, salvati sul dispositivo), classifica storica, poi Giochi da tavolo, Arcade e sport, Simulatori e sfide, Guarda e crea insieme. Ogni gioco ha un colore proprio (`public/games-catalog.js`).
- Settings: Aspetto con anteprima dal vivo di interfaccia, scacchiera e pezzi; Profilo (personaggio e pallina); Preferenze (suoni nei giochi, vibrazione quando tocca a te, dimensione del testo); Le mie partite archiviate; Informazioni (privacy e regolamenti); Segnala un problema (condivide in Telegram il registro degli ultimi eventi, senza token).
- Modalità sviluppatore: cinque tocchi sulla versione in Informazioni. Mostra la pagina Debug (stato, storico, terminale eventi).
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
