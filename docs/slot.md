# Slot machine della sala giochi (Lobby 3D)

## Decisioni del proprietario (28 novembre 2026)

- **Tre slot machine** nella sala giochi, sulla parete con la scritta al neon «ARCADE» (x -19), nello spazio vuoto
  tra il quadro di Binottoland (z 3,25) e il flipper Grand Prix (z -3): in fila, contro la parete, girate verso la
  sala.
- **Stile Las Vegas classico**: scocca colorata con le cromature, insegna con le lampadine attorno, candela luminosa
  in cima.
- **Tre uguali, colori diversi: rossa, oro e nera.**
- **In piedi, come i cabinati**, ma abbassate di 15 cm rispetto alla prima prova: nel modello alte 1,79 m, 1,98 con
  la candela. Poi, viste nella sala, **ingrandite del 25%** nella Lobby 3D (`SLOT_SCALE` in `lobby3d.js`): alte
  2,24 m, 2,48 con la candela, larghe 79 cm (91 con la leva). Dal 28 novembre 2026 (scelta del proprietario,
  `docs/cabinati.md`): sulla parete stesso spazio tra tutti, 10 cm dall'angolo al Binotto GT, tra i flipper, tra il
  Grand Prix e la nera e tra una slot e l'altra (1,015 m da centro a centro); il dietro a 10 cm dal muro.
- **Solo la leva** sul fianco destro (niente pulsante).
- **Simboli dei rulli:** frutta classica (ciliegie, limone, arancia, anguria, prugna), BAR e 7, la B con tre aste
  del Binottocoin e il pagliaccio di Binotto Corsa Competizione (jackpot). Li disegna il gioco sulla faccia dei rulli.
- **Vassoio cromato grande** per le vincite, sotto la pancia.
- **Rulli veri, col meccanismo in vista** (richiesta del proprietario): bordi cromati, fianchi con mozzo e sei raggi,
  un ingranaggio d'ottone su ogni rullo e l'asse; tra un rullo e l'altro, dal vetro, si vedono gli ingranaggi girare.

## Regole del gioco (scelte del proprietario, 28 novembre 2026)

- **Puntata: 1, 2 o 3 gettoni** a giro, scelta prima di tirare la leva.
- **Le vincite si pagano in gettoni**, moltiplicate per la puntata; solo il jackpot paga BTN.
- **Le vincite cadono nel vassoio e ci restano**: si accumulano giro dopo giro (anche il jackpot, in monete BTN
  d'oro), solo per te, anche se esci. Si prendono con un tocco sul vassoio o «Prendi» (P); **per rigiocarle vanno
  prese prima** (si gioca col saldo). Vedi «Vassoi» in `docs/gettoni.md`.
- **Generosa: restituisce circa il 110%** (jackpot compreso): alla lunga si guadagnano gettoni.
- **Jackpot che cresce, uno solo per le tre slot**: parte da **5 BTN** e sale di **1 BTN ogni 25 gettoni** giocati da
  chiunque; lo vince **tre pagliacci in fila, con qualsiasi puntata**; esce circa **1 giro su 3.000**. Dopo la
  vincita riparte da 5. Il jackpot è scritto sulle tre insegne.
- **Durata del giro: circa 3,5 secondi**; se i primi due rulli sono uguali (vincita in vista) il terzo gira più a
  lungo, **fino a circa 6 secondi**.
- **Quando la leva scende i tre rulli vanno un po' indietro**, poi partono **sfasati**, ognuno con la sua velocità,
  come nelle slot vere; si fermano uno alla volta con un piccolo rimbalzo.
- **Suoni il più veri possibile, solo registrazioni CC0**: non ne sono state trovate di buone (le slot meccaniche
  vere su Freesound sono CC BY, e le CC0 sono rumori di sala o monete). Per ora sono **sintetizzati** come una slot
  meccanica: cricchetto e colpo della leva, ronzio dei rulli, scatto a ogni simbolo che passa, colpo dello stop,
  campanello d'ottone per le vincite grosse e il jackpot, monete nel vassoio (il suono dei gettoni della
  macchinetta). Si possono sostituire con file veri in `slotSounds` (`public/lobby3d/slot.js`).

### Tabella delle vincite (per 1 gettone puntato, × la puntata)

| Combinazione | Gettoni |
| --- | --- |
| tre pagliacci | **JACKPOT** (BTN) |
| tre BTN (la B del Binottocoin) | 175 |
| tre 7 | 100 |
| tre BAR BAR | 40 |
| tre BAR | 25 |
| tre BAR qualsiasi (BAR e BAR BAR mischiati) | 10 |
| tre angurie | 20 |
| tre prugne | 15 |
| tre arance | 12 |
| tre limoni | 10 |
| tre ciliegie | 20 |
| due ciliegie (dove vuoi) | 5 |
| una ciliegia | 2 |

Ogni rullo ha 10 simboli, che escono con pesi diversi (su 144: ciliegia 14, limone 22, arancia 20, prugna 18,
anguria 16, BAR 14, BAR BAR 11, 7 10, BTN 9, pagliaccio 10). Si vince qualcosa circa 1 giro su 3,6. Le tabelle sono
in `public/slot-rules.js` (`slotOdds()` calcola quanto restituisce: 90% di vincite + 20% che va nel jackpot).

## Codice (28 novembre 2026)

- **Server** (`club-wallet.js`): messaggio `wallet-slot` (`bet` 1 · 2 · 3, `m` rossa, oro o nera). Toglie la
  puntata, aggiorna il jackpot (`slot:jackpot` nello spazio della Lobby: `btn` e `resto`, i gettoni verso il
  prossimo BTN), estrae i tre simboli con numeri a caso crittografici, paga gettoni o jackpot e risponde con il
  saldo e `slot: {r, bet, gettoni, btn, combo, jackpot}`. Un giro rimandato (stesso `ref`) non si rifà: torna lo
  stesso risultato. Il jackpot va nella posa della Lobby (`slotJackpot`), che si manda a tutti quando cambia.
  Prova: `tests/club-slot.test.mjs`.
- **Lobby 3D** (`public/lobby3d/slot.js`, `createSlots`; in `lobby3d.js` `SLOTS` col dietro contro la parete
  (x -18,9), z -0,3, girate verso +x, ingrandite di `SLOT_SCALE` 1,25; rossa z 0,76, oro -0,3, nera -1,36): «Usa · Slot oro (E)», la visuale va davanti. Tasti «Punta 1 · 2 · 3»
  (sul computer 1, 2, 3) e «Tira la leva» (Spazio), o un tocco sulla leva. I rulli girano finché arriva il
  risultato dal server, poi si fermano sui simboli giusti; il saldo nuovo si vede quando i rulli sono fermi. Le
  monete cadono nel vassoio (al massimo 60 a vincita), le lampadine corrono, la candela lampeggia al jackpot e
  compare «JACKPOT! +N BTN». Senza gettoni il display dice «INSERT COIN». Una persona alla volta per macchina; gli
  altri vedono girare la stessa macchina con gli stessi simboli.
- Prova locale: `public/_prova-slot.html` (fuori da git, portafoglio finto; `force = ['pagliaccio', …]` decide i
  rulli). Provato nell'anteprima: giro, tre pagliacci → jackpot, saldo, insegna.

## Modello

`blender/slot.blend` → `public/lobby3d/models/slot.glb` (circa 580 KB, solo la rossa: le altre due sono copie
ricolorate dal gioco). Lo script che lo costruisce è dentro il file (testo `slot_build.py`); in Blender ci sono
tutte e tre. Z in alto, davanti verso -Y in Blender (+z in three), base sul pavimento. Ogni macchina è un vuoto
`slot_rossa`, `slot_oro`, `slot_nera` (x -0,85, 0, +0,85: 85 cm da centro a centro, l'insieme è largo 2,33 m).
Misure di una macchina: larga 63 cm (68 con la leva), profonda 55 (63 col vassoio).

Pezzi di ogni macchina (`<colore>` = rossa, oro o nera), già al loro posto, con l'origine dove si muovono:

- `corpo_<colore>`: fermo (zoccolo, mobile con la fascia cromata, testata, pancia, mensola con la bocca dei gettoni e
  la fessura a destra, cornice della finestra, vassoio con la bocca nera, scatola dell'insegna, scatola della leva).
  Il colore è il materiale `vernice_<colore>`;
- `rullo_1_<colore>`, `rullo_2_<colore>`, `rullo_3_<colore>`: tamburo di raggio 10 cm, largo 10, con bordi, raggi
  e ingranaggio (l'asse è nel corpo); girano attorno a X, origine al centro. La faccia dei simboli (materiale
  `rullo`) ha UV da 0 a 1: u da sinistra a destra, v lungo il giro (in Blender v sale guardando la faccia davanti;
  v = 0 è al centro della finestra, sulla linea rossa; nel glTF v è capovolta);
- `leva_<colore>`: origine sul perno (fianco destro, 1,18 m da terra); si tira girando attorno a X, col pomello che
  viene avanti e giù;
- `insegna_<colore>`, `display_<colore>` (crediti e vincita, sopra la finestra), `pannello_<colore>` (le vincite,
  sulla pancia), `pannello_basso_<colore>` (davanti al mobile): faccia davanti con UV da 0 a 1 (materiale `stampa`)
  per l'immagine che disegna il gioco;
- `lampadine_a_<colore>`, `lampadine_b_<colore>`: 34 lampadine attorno all'insegna, materiali a parte
  (`lampadina_a_<colore>`, `lampadina_b_<colore>`) per farle rincorrere;
- `candela_<colore>`: la luce a due colori in cima (bianca sotto, rossa o arancio sopra), da far lampeggiare alla
  vincita; `base_candela_<colore>` ferma;
- `vetro_<colore>`: vetro trasparente davanti ai rulli con la linea rossa della vincita; `cornice_display_<colore>`.

## Da fare

- Provare nell'app di prova (server vero), anche con due persone alla stessa sala.
- Suoni registrati veri, se si trovano CC0 buoni (o se il proprietario fornisce i file).
