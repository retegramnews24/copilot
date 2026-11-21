# Biliardo

Sala giochi 3D con quattro specialità: **Palla 8**, **Snooker**, **Biliardo all'italiana (5 birilli)** e **Boccette**.
Si gioca contro il computer (Facile/Medio/Difficile), in due sullo stesso telefono, oppure **online** con un altro giocatore di Binottoland.

Pubblicato in Binottoland Playground dalla versione 1.0.35: scheda nel catalogo, Lobby, avvisi, classifiche (pagina `/biliardo/`).

## Regolamenti di riferimento

| Specialità | Regolamento | Cosa è semplificato |
|---|---|---|
| Palla 8 | [WPA World Standardized Rules](https://wpapool.com/rules-of-play/) | si chiama solo la buca della nera; dopo uno spacco non valido si rifà sempre il triangolo (niente scelta dell'avversario) |
| Snooker | [WPBSA Official Rules](https://wpbsa.com/rules/) | niente "free ball", "miss" e richiesta di far rigiocare; 6, 10 o 15 rosse |
| 5 birilli | regole UMB/FIBiS della specialità ([sintesi](https://en.wikipedia.org/wiki/Five-pin_billiards)) | il rosso da solo vale 10 (regola professionistica dal 2013); niente salti e bilie fuori dal tavolo |
| Boccette | [Regolamento tecnico FIBiS «Boccette 5 birilli» (2017)](https://www.fibisromagna.it/doc/15995Doc_10266.pdf) | niente acchito alla sponda per scegliere chi comincia (sorteggio); "friso" e "traversino" non riconosciuti; partita a 50/80/100 punti |

Punti chiave applicati: misure dei tavoli (9 piedi, 12 piedi, 2,84 × 1,42 m), delle bilie (57,15 / 52,5 / 61,5 mm, pallino 59 mm) e dei birilli (25 mm, croce da 66 mm);
spacco valido WPA (una bilia in buca o 4 alla sponda); bianca in mano dietro la linea dopo un fallo sullo spacco;
penali dello snooker (minimo 4, valore più alto in gioco); 5 birilli: casin 3, carambola 4 (conta solo la prima), birilli 2/4/10, falli con bilia in mano + 2;
boccette: bocciata d'acchito sul pallino, si boccia solo oltre la mezzeria, accosto 2/3/5/8, birilli 2/4/8 con tiro indiretto doppio,
birilli abbattuti con le proprie bilie all'avversario, tiri irregolari annullati con la situazione rimessa com'era, chi fa l'accosto rimette il pallino.

## File

| File | Cosa fa |
|---|---|
| `public/biliardo/index.html`, `biliardo.css`, `icon-192.png`, `icon-512.png` | Pagina, menu, impostazioni, HUD, icona |
| `public/biliardo/main.js` | Comandi (mira col dito, barra della forza col pallino, vista), turni, computer, online (messaggi `bil:` con l'app) |
| `public/biliardo/scene3d.js` | Sala giochi (neon, luci colorate, bloom), tavoli, bilie, birilli, stecca, telecamera libera |
| `public/biliardo/physics.js` | Fisica (strisciamento/rotolamento, effetti, sponde, buche, birilli). **Deterministica**: solo + − × ÷ e `Math.sqrt` |
| `public/biliardo/engine.js` | Regole delle quattro specialità, codice puro (gioco, computer e server) |
| `public/biliardo/ai.js` | Il computer: prova i colpi con la fisica vera e sceglie il migliore |
| `public/biliardo/sound.js` | Suoni sintetizzati (stecca, bilie, sponde, buche, rotolamento, eco della sala) |
| `biliardo-server.js` | Stanza online (`BiliardoRoom`), stesso schema di `f1-server.js` |
| `public/biliardo-link.js` | Il gioco visto dall'app (iframe, rete, Telegram), stesso schema di `f1-link.js` |
| `tests/biliardo.test.js` | Online, regolamenti (spacco, nera chiamata, casin, falli, acchito, accosto) e 4 specialità fino in fondo |
| `tests/biliardo-runtime.test.js` (nel patch) | Worker vero: creazione, avviso, ingresso, turni, colpo rifatto uguale, chiusura |

## Online

- Chi crea sceglie la specialità e preme **Apri la partita online**: il gioco manda `bil:create`, l'app chiama
  `POST /api/create {game:'biliardo', variant, points, reds}` (`points`, non `target`: `target` è il formato torneo degli altri giochi).
- L'avviso nella campanella dice "… ha aperto Biliardo · sala N · 5 birilli · cerca 1 giocatore"; la partita è anche nella Lobby (Entra / Riprendi / Guarda) e nelle partite fissate.
- Con 2 giocatori parte da sola. Ogni colpo `{dx, dz, speed, sy, sx, px?, pz?, qx?, qz?, call?}` va a `/api/biliardo/<sala>/play`:
  il server lo rifà con `engine.playShot` e salva tavolo prima, colpo e tavolo dopo; gli altri telefoni rifanno il colpo e ottengono lo stesso tavolo.
- 1 minuto a colpo, poi tira il pilota automatico; 6 colpi automatici di fila chiudono la partita. Il vincitore va nelle classifiche.

## Dove è collegato nell'app

Server in `biliardo-server.js` (stanza in `worker.js`, rotte in `api.js`), Lobby e avvisi in `lobby-hub.js`, riassunto in `table-rules.js`,
titolo in `game-info.js`, partite in `my-games.js`, backup in `backup.js`, scheda del catalogo con icona e overlay in `index.html`/`app.css`,
collegamento in `app.js` (`createBiliardoLink`), voce nei regolamenti (Informazioni), test in `package.json` (`tests/biliardo.test.js`;
`tests/biliardo-runtime.test.js` in `test:table-runtime`).

## Comandi

- **Mira**: tocco su un punto = mira lì; trascinare = ruota la mira (sensibilità nel menu, 10–200%).
- **Tiro**: dito sulla barra della forza a destra, si trascina giù il pallino e si lascia. Riportarlo in cima o uscire di lato annulla. Spazio da tastiera.
- **Palla 8**: quando tocca alla nera si tocca la buca da chiamare.
- **Boccette**: nella bocciata d'acchito si trascina il pallino blu oltre la mezzeria.
- **Vista**: rotella o pizzico = zoom; tasto destro, oppure 🎥 e un dito = gira attorno; tasto centrale/Maiusc o due dita = sposta.
