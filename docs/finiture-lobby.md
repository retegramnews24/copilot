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

## Da fare in Blender

Pannello di boiserie con il bordo a cornice, tre cornici per i quadri (cassetta dorata, ottone sottile, neon), la
rastrelliera delle stecche per il biliardo, le applique d'ottone.
