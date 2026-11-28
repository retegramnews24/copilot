# Cabinati della sala giochi (Lobby 3D)

Cabinati dei giochi arcade nella sala giochi della Lobby 3D, rifatti in Blender. Oggi sono fatti nel codice
(`cabinet` in `public/lobby3d/lobby3d.js`, «SALA ARCADE»). Ogni partita costa 1 gettone (`docs/gettoni.md`).

## Giochi e posti

| Gioco | Giocatori | Posti al cabinato |
| --- | --- | --- |
| Pong | 1 contro il computer, o 2 online | 2 |
| Moto Trial | da solo, o fino a 8 online | 4 |
| F1 on paper! | contro l'IA, a turno sullo stesso telefono, o fino a 8 online | 4 |
| Golf | da solo, o fino a 8 online | 4 |
| Acquedotto!, Lunar Lander 3D, Number Connect, Giulio Simulator, Ruggine 89 | da soli | 1 |
| Binotto Simulator | gestionale online, ognuno la sua scuderia | postazione a parte |

## Scelte del proprietario (28 novembre 2026)

- **Un cabinato per gioco**, tranne **Binotto Simulator**, che ha una postazione diversa: un **bancone da muretto
  dei box di Formula 1** con i monitor (tempi, pista, meteo) e la cuffia appoggiata.
- **Stile anni '80 con neon:** forma classica dei cabinati anni '80, laccata nera, con i bordi luminosi del colore
  del gioco.
- **Schermo a tubo curvo:** vetro un po' bombato e inclinato all'indietro.
- **Giochi fino a 8 (Moto Trial, F1 on paper!, Golf): cabinati a 4 posti**, dal quinto in poi si sta in piedi
  dietro a guardare.
- **Niente sgabelli:** si gioca in piedi.
- **Schermo:** dentro si vede il tubo vero, più bombato, e davanti c'è un vetro esterno piatto.
- **Vincite dei cabinati:** i gettoni vinti ai cabinati non escono dal cabinato: arrivano direttamente al vassoio
  della macchinetta del cambio e solo chi li ha vinti li può prendere. Per questo la porta delle monete ha solo la
  fessura e il tasto per riavere il gettone, niente bocca del resto. Fatto nel codice: il premio sono 5 gettoni nel
  vassoio della macchinetta, per tutti i giochi (`docs/gettoni.md`).
- **Posto come oggi:** parete nord Moto Trial, F1 e Golf, tra l'ingresso e la porta della Zona; parete sud Pong, i
  cinque giochi da soli e la postazione di Binotto Simulator.

## Modelli

`blender/cabinati.blend` → `public/lobby3d/models/cabinati.glb`. Lo script che li costruisce è dentro il file (testo
`cabinati_build.py`). Davanti verso -Y in Blender (+z in three), base a terra (z = 0), centro in x e y. Un modello per
tipo, usato per tutti i giochi con quel numero di posti: nome, colori e disegni li stampa il gioco.

- `cabinato_1` (approvato): largo 66 cm, alto 1,92 m, profondo 95 cm. Pannello dei comandi a 1 m, schermo 4:3
  (54 × 40 cm di foro).
- `cabinato_2`, Pong (approvato): **grande quanto il singolo**, con 2 pulsantiere (rossa e blu) e 2 fessure.
- `cabinato_4`, Moto Trial, F1 on paper!, Golf (approvato): **alto come gli altri, largo 1,5 m**, schermo più
  largo (90 × 44 cm di foro), 4 pulsantiere (rossa, blu, gialla, verde) e 4 fessure.
- `muretto`, Binotto Simulator (approvato): bancone grigio carbonio largo 1,4 m, piano a 1 m (si sta in piedi),
  tastiera e `cuffia` sul piano, portale di alluminio con tre monitor, tettuccio a 1,92 m, profondo 70 cm (78 col
  tettuccio). Pezzi: `corpo_muretto`, `neon_muretto` (bordo davanti al piano e al tettuccio), `fessura_muretto`
  (una fessura, a destra sul davanti), da stampare `insegna_muretto` (davanti al tettuccio), `pannello_muretto`
  (davanti al mobile, materiale `fianco`), `schermo_tempi`, `schermo_pista`, `schermo_meteo` (UV da 0 a 1, nelle
  loro cornici `monitor_*`).

Nel GLB i quattro vuoti (`cabinato_1`, `cabinato_2`, `cabinato_4`, `muretto`) stanno tutti all'origine, uno sopra
l'altro: il gioco prende quello che gli serve per nome. Nel .blend sono in fila per guardarli. Circa 1,3 MB e 24.000
triangoli in tutto.

Pezzi di ogni cabinato (suffisso `_1`, `_2`, `_4`):

- fermi: `corpo`, `cornice_insegna`, `cornice_schermo` (lastra nera col foro e il tunnel dietro), `vetro_schermo`
  (vetro esterno piatto, materiale `vetro` trasparente), `ghiere`, `porta_monete` (fessura e tasto per riavere il
  gettone, niente bocca del resto);
- `neon`: il bordo a T, materiale `neon`, il colore lo mette il gioco;
- da stampare, faccia con UV da 0 a 1: `insegna` (davanti), `fianco_sx` e `fianco_dx` (faccia fuori, materiale
  `fianco`, il davanti del cabinato a sinistra guardando da `dx` e a destra guardando da `sx`, così il disegno non
  è specchiato), `pannello` (piano dei comandi, faccia in su), `schermo` (il tubo);
- `schermo`: il tubo vero, bombato, **inclinato 18° più indietro del vetro** e più piccolo del foro, così si vede
  intero (scelte del proprietario); origine al centro del vetro;
- `joystick_N`: origine nel perno sul piano dei comandi, z locale = perpendicolare al piano; si inclina attorno
  alle sue x e y locali. Pallina del colore del posto (`giocatore_N`);
- `tasto_Na`, `tasto_Nb`: origine sotto, si premono lungo -z locale (bianco e colore del posto);
- `fessure`: le luci delle fessure delle monete (materiale `fessura_luce`).

## Nella Lobby 3D (28 novembre 2026, su richiesta del proprietario)

- `buildCabinets` in `public/lobby3d/cabinets.js` (chiamato da `lobby3d.js`, «SALA ARCADE») carica `models/cabinati.glb` e mette il modello giusto per
  ogni gioco (`SEATS`: Pong 2, Moto Trial, F1 e Golf 4; Binotto Simulator il muretto). Posti, ingombri e tasti ci
  sono subito, i pezzi arrivano col modello. Le UV del modello si girano al caricamento (v dal basso), così tele e
  Pong sul monitor stanno dritti.
- **File e spazi** (scelte del proprietario): le due file partono dall'angolo verso l'atrio (x -7,2), con **25 cm**
  tra un cabinato e l'altro, così si vedono i fianchi disegnati. Parete nord Moto Trial, F1 e Golf (com'era); parete
  sud, dall'angolo: prima i giochi da 1 (Acquedotto!, Lunar Lander, Number Connect, Giulio Simulator, Ruggine 89), poi
  Pong da 2, in fondo il muretto.
- **Stessa distanza dal muro per tutti: 10 cm** (scelta del proprietario): cabinati e muretto (`WALL_GAP`, il
  dietro del cabinato contro il muro), slot (erano già così) e i due flipper (`FLIPPER_AT`, `GT_AT` in
  `flipper3d.js`: il Grand Prix sporge 0,766 m dietro il centro, il GT 0,807). Prima i cabinati entravano di 2 cm
  nel muro e i flipper stavano a 18 e 14 cm.
- **Parete dell'ARCADE, stesso spazio tra tutti** (scelta del proprietario): 10 cm dall'angolo (parete nord) al
  Binotto GT, tra i due flipper, tra il Grand Prix e la slot nera e tra una slot e l'altra (`SPACING` in `slot.js`,
  `SLOT_STEP` e `SLOTS` in `lobby3d.js`; `WALL_GAP` in `cabinets.js`). Larghezze misurate dai modelli: GT 1,004 m, Grand Prix 0,844, slot con la
  leva 0,915 (ingrandita del 25%). Così flipper e slot sono più verso l'angolo: le slot non stanno più sotto la
  scritta ARCADE, ma accanto.
- **Disegni a tema per ogni gioco** (`public/lobby3d/cabinet-art.js`, richiesta del proprietario: scritte adatte a
  ogni gioco, più colori e disegni): insegna, fianchi e pannello dei comandi col tema del gioco: Pong bianco e nero
  con la rete, Moto Trial al tramonto con la moto che salta, Acquedotto! coi tubi e le gocce d'oro, Lunar Lander con
  la Luna, la Terra e il modulo, Number Connect con le tessere dei numeri, F1 on paper! su carta a quadretti con la
  pista a matita, Golf col prato, la bandierina e l'arcobaleno, Giulio Simulator come un cartello di stazione col
  treno tra laghi e monti, Binotto Simulator giallo su carbonio con la bandiera a scacchi, Ruggine 89 arrugginito al
  tramonto con l'auto corazzata. Sul muretto i monitor «tempi» e «meteo» sono disegnati, quello in mezzo è lo schermo
  del gioco.
- **Luci più basse** (il proprietario le trovava troppo forti): il bordo luminoso è a metà, la luce sul pavimento
  davanti ai cabinati quasi tolta (i cabinati vicini si sommavano), schermo e insegna meno accesi; **joystick e tasti
  colorati ma non accesi** (anche nel modello).
- Provato nell'anteprima locale (`_prova-lobby.html`): modelli, schermi dritti, INSERT COIN, disegni, nessun errore.
  Da provare nell'app: Pong sul monitor del cabinato, persone alle pulsantiere (4 posti invece di 5 per F1 e Moto),
  telefono.
