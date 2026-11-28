# Binottoland Playground: istruzioni per Claude

Mini App Telegram del circolo, su Cloudflare Workers con Durable Objects. Cosa contiene l'app: `README.md`.
Questo file tiene solo le regole di lavoro, che valgono in ogni sessione.

## Prima di cominciare

1. Leggi `docs/stato.md`: cosa è in corso, cosa aspetta una prova, cosa è rimandato, cosa è già deciso.
2. Controlla ramo e file modificati (`git status --short --branch`). GitHub Desktop può essere rimasto su un altro
   ramo e altre sessioni possono lavorare nella stessa cartella: non toccare file che non hai modificato tu.
3. Per un gioco o una funzione, leggi il suo documento in `docs/` (tabella in fondo).

## Dove sta tutto

Tutte le informazioni di lavoro su Binottoland stanno in questo repo: questo file (regole), `docs/stato.md` (cosa è
in corso, rimandato, deciso) e un documento per gioco in `docs/`. Le sessioni si aprono dalla cartella del repo, così
questo file si carica da solo. Non tenere decisioni solo nelle note di Claude: vanno qui.

## Come lavorare

- Rispondi in italiano, con parole semplici. Mentre lavori scrivi poco; il dettaglio va alla fine.
- Consumi: una sessione per ogni lavoro. Nel browser leggi la pagina come testo; screenshot solo quando servono a
  chi guarda. Raggruppa i controlli in pochi comandi.
- Regole di gioco, comandi e nomi li decide il proprietario: proponi con domande a scelta. Le scelte già fatte
  stanno nel documento del gioco e in `docs/stato.md`: non riproporle.
- A fine lavoro aggiorna `docs/stato.md`, e il documento del gioco se è cambiata una regola.
- Una sola sessione alla volta modifica il codice: le analisi (per esempio quelle di Fable) sono in sola lettura
  mentre un'altra sessione lavora.

## Rami e rilascio

- Si lavora su `staging`, in questa cartella. `main` è nella cartella accanto, `..\copilot-main`.
- `staging` non si unisce mai in `main`: le modifiche si portano a mano (`docs/ambiente-di-prova.md`).
- Su `main` si porta solo dopo che la modifica è stata provata su staging e c'è l'ok.
- Rilascio su `main`: versione +1 con `npm run release`, tutti gli 8 passi delle prove, poi `staging` prende lo
  stesso numero (`npm run release -- 1.0.xx`) e `node scripts/branch-diff.mjs` deve dire «Nessuna differenza».
- Prima di `main` ci sono anche i controlli a mano di `docs/controlli-prima-del-rilascio.md`.

## Commit e push

- Commit solo quando viene chiesto, pochi e che raggruppano più passi.
- Push solo con la conferma del proprietario in chat: prima si scrive cosa si carica e su quale ramo, poi si aspetta
  il sì. Una conferma vale per un push solo. Su `main` solo dopo la prova su staging e l'ok (vedi sopra). Mai push
  forzati. L'accesso a GitHub è quello salvato in Windows (Git Credential Manager), il push si fa con il git di
  GitHub Desktop.
- Messaggio in italiano, che dice cosa cambia per chi gioca. Se contiene virgolette: `git commit -F file`.
- Git non è nel PATH. Usa quello di GitHub Desktop, nella cartella `app-*` con il numero più alto:
  `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`.

## Prove

- Su `staging` prove leggere: i file di prova che riguardano i file cambiati, più `npm run release:check` e
  `npm run format:check`.
- Prima di `main` tutti gli 8 passi di `.github/workflows/tests.yml`: `release:check`, `format:check`, `test`,
  `test:ui`, `test:simulator`, `test:access`, `test:table-runtime`, `test:multiplayer-runtime`.
- Dopo una modifica ai file di `public/` senza rilascio: `npm run stamp` aggiorna i timbri `?v=`, altrimenti
  `release:check` fallisce.
- I file elencati in `format:check` si formattano con `npm run format:simulator`.
- Su Windows `test:simulator` fallisce solo in locale se `public/arcade-link.js` ha gli a capo CRLF: portarlo a LF.

## File

- Niente `Set-Content -Encoding utf8` né `Get-Content -Raw` di PowerShell per scrivere file: aggiungono il BOM e
  rovinano le lettere accentate. Usa gli strumenti di modifica, oppure `[IO.File]` con UTF-8 senza BOM.
- A capo LF.
- Struttura del codice e regole per le modifiche: `docs/architecture/README.md`.
- Modelli 3D: sorgenti in `blender/*.blend`, esportati in `.glb` nella cartella `models` del gioco.
- Blender (MCP): dopo `read_homefile` il contesto non ha `.object`, quindi costruire con bmesh pezzo per pezzo e
  pulire la scena da `bpy.data`; smussi con `bmesh.ops.bevel(..., clamp_overlap=True)`; tagli booleani uno per volta
  (due sovrapposti nello stesso taglio si annullano). Esportare in GLB con gli oggetti all'origine, `export_yup=True`;
  il davanti dei modelli guarda verso -Y (diventa +z in three).
- Blender: il proprietario guarda il lavoro direttamente in Blender, quindi niente immagini (`look`) in chat, salvo
  che le chieda.
- Anteprima locale: mai `file://`, sempre il piccolo server `node scripts/anteprima.mjs` sulla cartella `public/`
  (nelle sessioni di Claude: `Anteprima Binottoland` in `.claude/launch.json`, porta 8788).
- Il repo è pubblico: niente token, indirizzi email o dati di persone nei file.

## Dove sta cosa

| Argomento | Documento | Codice |
| --- | --- | --- |
| Stato dei lavori e decisioni | `docs/stato.md` | |
| Accesso e sessioni | `docs/accesso.md` | `auth.js` |
| Lobby classica e pagina Giochi | `README.md` | `public/app.js`, `public/games-catalog.js`, `lobby-hub.js` |
| Lobby 3D | `docs/finiture-lobby.md` | `public/lobby3d/` |
| Calcio balilla | `docs/balilla.md` | `public/lobby3d/balilla*.js`, `balilla-hub.js` |
| Giochi da tavolo | `docs/giochi-da-tavolo.md` | file delle regole nella radice, `table-*.js` |
| Biliardo | `docs/biliardo.md` | `public/biliardo/`, `biliardo-server.js` |
| F1 on paper! | `docs/f1-on-paper.md` | `public/gara/`, `f1-server.js`, `public/f1-link.js` |
| Ruggine 89 | `docs/ruggine-89.md` | `public/ruggine/` |
| Zona Operativa (sparatutto) | `docs/zona-operativa.md` | `public/zona/`, `zona-server.js` (da fare) |
| Golf | `docs/golf.md` | `public/golf/`, `golf-server.js` |
| Moto Trial | `docs/moto-trial.md` | `public/moto-trial/`, `moto-trial-server.js` |
| Acquedotto! e giochi arcade | `docs/acquedotto.md` | `public/arcade/` |
| Cabinati della sala giochi | `docs/cabinati.md` | `blender/cabinati.blend`, `public/lobby3d/lobby3d.js`, `cabinet-art.js` |
| Binotto Simulator | `docs/binotto-simulator.md`, `docs/circuit-pits.md` | `simulator/`, `public/simulator/` |
| Slot machine | `docs/slot.md` | `public/lobby3d/slot.js`, `public/slot-rules.js`, `club-wallet.js` |
| Cinema | `docs/cinema.md` | `public/cinema/`, `cinema-*.js` |
| Radio | `docs/radio.md` | `public/radio.js`, `radio-*.js` |
| Lavagna | | `public/blackboard/`, `blackboard-server.js` |
| Avvisi «tocca a te» | `docs/avvisi-turni.md` | `turn-notices.js` |
| Backup ed errori | `docs/backup-ed-errori.md` | `backup.js`, `scripts/backup.mjs` |
| Ambiente di prova | `docs/ambiente-di-prova.md` | |
| Controlli a mano prima di un rilascio | `docs/controlli-prima-del-rilascio.md` | |
| Analisi area per area (1-11) | `docs/analisi-fable.md` | |
