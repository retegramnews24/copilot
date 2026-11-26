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
