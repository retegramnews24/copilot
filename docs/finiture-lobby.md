# Finiture della Lobby 3D · stile «Circolo italiano anni '60»

[← Binottoland](../README.md)

Scelto il 26/11/2026 tra tre proposte (circolo anni '60, paddock Binotto, grand hotel déco). Noce, ottone, velluto e
pelle: gli stessi materiali di bancone, sgabelli, divani e radio vintage. Ogni stanza ha un colore che segue quello che
ci si fa, con lo stesso legno sotto; la sala giochi è l'eccezione voluta, con i neon.

| Stanza | Parete | Parte bassa (fino al battisedia) | Battisedia | Zoccolo | Cornice sotto il soffitto |
|---|---|---|---|---|---|
| Atrio | crema `#e6d7bc` | boiserie di noce `#5a3a28`, 1 m | ottone `#b8925a` | noce scuro `#2e1d14` | avorio `#f2e8d5` |
| Sala tavoli | verde bottiglia `#2f4a3a` | boiserie di noce `#583828`, 1 m | ottone `#c3a064` | noce scuro | noce |
| Sala biliardo | rosso pompeiano `#6e2a26` | boiserie scura `#3e2519`, 1,2 m (le stecche) | oro brunito `#8a6a3a` | `#22140d` | oro brunito |
| Sala giochi | blu notte `#141634` (con il murale al tramonto) | una riga di neon azzurro a 1 m | — | neon magenta | quasi nero |
| Cinema | antracite blu `#1b1e2a` | pannelli in velluto `#6f2033`, 1 m | `#a5535f` | scuro, con lucine di cortesia | scura |

## Dove sta nel codice

- `public/lobby3d/lobby3d.js`, `trimWall`: lungo ogni parete, saltando le porte, zoccoletto (14 cm), parte bassa con un
  montante ogni 0,9 m circa, battisedia e cornice. I pezzi dello stesso materiale si uniscono in un solo oggetto
  (`mergeGeometries`): pochi oggetti da disegnare anche sul telefono. I colori per stanza sono nella tabella `TRIM`.
- `public/lobby3d/textures.js`, `wallFinish`: le pareti lunghe di atrio e biliardo hanno solo il colore; la boiserie non
  è più dipinta sulla texture.

## Fatto in Blender

- Mobile della radio: credenza di noce anni '60, ante a doghe, pomelli e filo d'ottone, gambe affusolate con i puntali (`blender/credenza_radio.blend` → `public/lobby3d/models/credenza_radio.glb`, circa 4.100 triangoli). Stesse misure del bancone di prima: la radio resta alla stessa altezza.
- Cornici dei quadri (`blender/cornici.blend` → `public/lobby3d/models/cornici.glb`, una per misura): cassetta dorata a gradini con la perla per il panorama dell'atrio e il poster del biliardo (alzato a 2,15 m, sopra il battisedia a 1,2 m), ottone sottile per sala tavoli e cinema, neon magenta per la sala giochi. `frameFor` in `lobby3d.js` le mette al posto della cornice semplice quando sono arrivate.

- Pannello di boiserie, rastrelliera delle stecche e applique d'ottone (`blender/arredi_lobby.blend` → `public/lobby3d/models/finiture.glb`, 140 KB). I pannelli (cornice e specchiatura in rilievo) sono tutti in un oggetto a istanze, ognuno alla misura del suo riquadro e con il legno della sua stanza; quelli piatti di `trimWall` restano finché il modello non arriva. Rastrelliera sulla parete di fondo del biliardo (8 stecche, mensola a coppette); applique: 4 nell'atrio, 2 nella sala tavoli, 2 nel biliardo.
- Sala tavoli, tavoli e sedie moderni (`blender/sala_tavoli.blend` → `public/lobby3d/models/sala_tavoli.glb`, 80 KB): tavolo con il piano di noce dagli angoli arrotondati su una colonna centrale scura con il disco a terra; sedia girevole a quattro razze con seduta e schienale imbottiti in pelle, lo schienale staccato su un montante di metallo. Stesse misure di prima (piano a 80,5 cm, seduta a 48,5 cm): pedine e posti a sedere non cambiano. A istanze, un oggetto per materiale.
- Applique dell'atrio spostate dove non coprono quadri e lavagna.
- Carrello dei popcorn e della Binotto Cola (`blender/popcorn.blend` → `public/lobby3d/models/popcorn.glb`, circa
  1 MB): nell'atrio a sinistra della porta del cinema, tra la pianta e il divano. Funzionamento e scelte in
  `docs/macchinetta.md`.
- Macchinetta automatica degli hot dog (`blender/hotdog.blend` → `public/lobby3d/models/hotdog.glb`, circa 740 KB):
  solo il modello, per la parete della sala giochi verso l'angolo dei popcorn. Scelte in `docs/macchinetta.md`.
- Zona operativa (`public/lobby3d/corridor.js`): porta blindata industriale sulla parete nord della sala giochi
  (centro x -15,95, vano 1,2 × 2,3 m, insegna rossa «ZONA OPERATIVA»; il quadro «INSERT COIN» è stato spostato a
  x -17,85 per farle posto). Si apre scorrendo avvicinandosi. Dietro, un tunnel di cemento di 12 m (z -6,3…-18,3,
  largo 1,6 m) con tubi, striscia gialla e nera, un neon ogni 2 m e una luce sola che segue il neon acceso davanti
  a te. I neon alle spalle si spengono con un clic, il nero sale verso il fondo; in fondo (z < -17,2) la Lobby 3D
  si spegne davvero (`destroy` in `lobby3d.js`: ascoltatori e intervalli annotati mentre si costruisce, collegamenti,
  film, audio, geometrie, materiali, texture, contesto WebGL) e parte la pagina del gioco (`public/zona/index.html`,
  per ora un segnaposto con «Esci») nell'overlay `#zona-overlay` di `app.js`. Uscendo, `app.js` costruisce una Lobby
  nuova, aspetta che sia pronta e ti rimette in fondo al corridoio rivolto verso la porta; i neon si riaccendono dal
  fondo. Nell'anteprima: 312 geometrie e 28 texture prima, 2 e 1 subito dopo, poi il contesto grafico chiuso.
  Prova locale: `public/_prova-zona.html` (fuori da git).
- Partita vera sui tavoli (per ora solo Forza 4; `public/lobby3d/table-live.js`, prova `tests/table-live.test.mjs`).
  Quale partita: la tua, se ne stai giocando una; se no quella con l'ultima mossa. Le partite degli altri contro
  l'AI o in tutorial non si mostrano; senza partite il gioco è in posizione iniziale (griglia vuota). In diretta,
  ma collegati solo con la 3D visibile e tu nella sala tavoli o davanti alla porta (z < -4,5). Il collegamento è
  `/api/room/<stanza>/ws?look=1`: il server manda la vista da spettatore (niente mani o flotte, nemmeno le tue) e
  non lo conta come giocatore presente, così una partita finita non resta in vita per lui. Prossimi giochi uno per
  volta: Scacchi, Dama, poi carte, Scarabeo e Battaglia navale (sempre con le parti nascoste coperte).
- Carte sui tavoli di UNO, Scopa, Briscola e Briscola in cinque (`blender/carte.blend` → `public/lobby3d/models/carte.glb`, 17 KB): una carta (7,5 × 12 cm, 1,5 mm, angoli arrotondati; faccia e retro con materiali e UV separati) e un mazzo (2,5 cm, bordo a righe come carte impilate). Codice in `public/lobby3d/table-cards.js`: le carte sul tavolo sono dati (`CARD_LAYOUTS`: carta, posizione, rotazione, coperta/scoperta), le facce vengono da `sicilianSVG` (napoletane) e da un disegno nello stile di `.uno-card`; per tavolo un atlante delle facce e tre oggetti (facce, retri, bordi dei mazzi). Retro napoletane bordeaux a rombi, retro UNO scuro con l'ovale rosso.
- Scarabeo sul suo tavolo (`blender/scarabeo.blend` → `public/lobby3d/models/scarabeo.glb`, 27 KB): plancia di 72 cm con cornice bordeaux e griglia 17 × 17 (caselle e premi disegnati con `premium` di `scarabeo-data.js`), tessera di 3,7 cm smussata (lettera e punti da un atlante), leggio di noce con la parete inclinata di 15 gradi e sacchetto di tela col laccio. Codice in `public/lobby3d/table-scarabeo.js`: tessere come dati (`SCARABEO_LAYOUT`: sulla plancia PAROLA e SALE, 8 lettere per leggio), pezzi uguali uniti in un oggetto per materiale.
- Battaglia navale sul suo tavolo (`blender/navale.blend` → `public/lobby3d/models/navale.glb`, 41 KB): due valigette di plastica classica, una blu e una rossa, aperte davanti a ciascun giocatore con i coperchi in piedi schiena contro schiena a fare da paravento. Base 26 × 25 cm, coperchio con maniglia sul dorso, piastra con griglia 10 × 10 da 1,9 cm (fori, lettere A-J e numeri 1-10 disegnati in codice); navi grigie da 2 a 5 caselle (la portaerei col ponte piatto), piolo. Codice in `public/lobby3d/table-navale.js`: partita a metà come dati (`NAVALE_LAYOUT`: flotta e colpi ricevuti per giocatore); sulla base i colpi ricevuti, sul coperchio quelli sparati, rossi se hanno preso una nave. Sei oggetti in tutto, uno per materiale.
- Scacchi e Dama sui loro tavoli (`blender/scacchi.blend` → `public/lobby3d/models/scacchi.glb`, 145 KB): scacchiera di legno intarsiato da 50 cm (caselle da 5,5 cm di acero e noce, cornice scura con filetto dorato; il piano si disegna in codice, con lettere e numeri solo per gli scacchi), pezzi Staunton torniti (re 10 cm con la croce, torre con i merli, cavallo con la testa di profilo) in bosso ed ebano, pedina della dama col bordo a righe, bianca e nera. Il Bianco siede a x positivo. Codice in `public/lobby3d/table-scacchi.js`: due partite a metà come dati (`CHESS_LAYOUT`: Partita Italiana dopo l'arrocco, pezzi mangiati in fila accanto alla scacchiera; `DAMA_LAYOUT`: pedine sulle caselle scure come nell'app, una dama bianca di due pedine impilate, pedine mangiate in pila). Quattro oggetti per tavolo, uno per materiale. I pedoni e i dischetti disegnati in codice di prima non ci sono più.
