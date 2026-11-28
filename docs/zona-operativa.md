# Zona Operativa (sparatutto)

Il gioco che parte in fondo al corridoio della Zona operativa della Lobby 3D (`docs/finiture-lobby.md`, voce «Zona
operativa»): la Lobby si spegne davvero e si apre `public/zona/index.html`. È uno sparatutto in prima persona
originale, dello stesso genere di Counter-Strike, ma con nome, mappe, armi, grafica e suoni nostri.

Stato: **tappa 1 (poligono di tiro) e tappa 2 (online sul deserto) scritte, da provare nell'app di staging**.
Modelli in `blender/zona_*.blend`, esportati in `public/zona/models/` (`armi.glb`: armi, braccia con 17 azioni, cassa
medica; `poligono.glb`; `deserto.glb`; `soldati.glb`).

## Cosa non si fa (vale per tutte le tappe)

- Niente di Counter-Strike: nomi, loghi, schermate, modelli, suoni, nomi delle armi e piante delle mappe. Il repo è
  pubblico. In particolare la prima mappa **non** è la pianta di una mappa famosa del deserto (il proprietario ne
  ha mandato una foto come esempio del genere): si prende solo l'idea generale (due partenze opposte, tre strade,
  un centro conteso, angoli per nascondersi) e la pianta si disegna da zero.
- Scartati: decompilare o rifare Counter-Strike, collegarsi a giochi online esterni, convertire motori a codice
  aperto.

## Scelte del proprietario (27 novembre 2026)

| Argomento | Scelta |
| --- | --- |
| Nome | **Zona Operativa**, come l'insegna sulla porta |
| Modalità | Due: **Tutti contro tutti** (ognuno per sé) e **A squadre**, squadra **Rossa** contro squadra **Blu** |
| Giocatori | Al massimo **8 persone vere**; se sono meno, i posti vuoti li riempiono i **bot** (a squadre: fino a 4 contro 4) |
| Fine partita | **A tempo**: 5 minuti, si rinasce dopo 3 secondi, vince chi (o la squadra che) ha più eliminazioni |
| Armi | Niente soldi né negozio: le armi stanno **a terra in punti fissi** e ricompaiono dopo un po' |
| Quali armi | **5 + coltello**: **Baretta** pistola 10 colpi (sempre in mano), **Calabrone** mitraglietta 20 colpi, **Tuono** fucile a pompa 5 colpi, **Ruggito** fucile d'assalto 25 colpi, **Falco** fucile da cecchino a colpo singolo |
| Prima mappa | **Deserto**: case di pietra e fango, torri di pietra, muretti; pianta nostra |
| Grafica | **Low-poly come la Lobby 3D**: forme semplici, colori pieni, modelli Blender leggeri |
| Telefono | **Due levette, mira libera** (nessun aiuto): levetta a sinistra per camminare, trascinare a destra per girarsi, tasto Spara |
| Computer | **WASD e mouse**: si cammina, **Maiusc tenuto corre** (come nella Lobby 3D; scelta del 28 novembre), mouse bloccato per guardare, clic sinistro spara, R ricarica, 1-4 armi, Spazio salta, Tab classifica, Esc menù |
| Velocità | (28 novembre) **camminata 5,2 m/s** (la corsa di prima), **corsa 7 m/s**, mirando 2,6 m/s, accucciati 2 m/s. Sul telefono si corre con la levetta spinta fino in fondo. I bot camminano |
| Arma in mano | (28 novembre) Senza mirare la canna punta al mirino a 15 m; mirando l'arma si raddrizza lungo lo sguardo con la tacca (o il punto rosso) al centro, così si vede il punto di mira attraverso l'arma (`viewmodel.js`, rotazioni misurate dalla posa `tiene_` di ogni arma) |
| Salto | Circa 1 m. **Si sale saltando su pietre, casse e ostacoli bassi** fino a circa 1,4 m: se durante il salto i piedi arrivano a mezzo metro dalla cima, si sale sopra (`PLAYER.climb` in `rules.js`). I muri più alti no |
| Menù | **Struttura come nei giochi del genere, grafica nostra**: scelta squadra, impostazioni dell'ospite (modalità, tempo, bot), classifica con Tab, menù di pausa; disegni, colori e scritte di Binottoland |

Aggiornamento del 28 novembre (scelte del proprietario): la partita sul deserto è **sempre a squadre**, Rossa contro
Blu, 4 contro 4, al massimo 8 persone; i posti vuoti li prendono i **bot**, livello **medi**; **all'inizio si
sceglie la squadra** (Rossa, Blu o automatica). Si mira **tenendo premuto il tasto destro** con tutte le armi, e
mirando **si cammina soltanto**. Il poligono di tiro è condiviso (ci si vede, niente fuoco amico).

### Ancora da decidere (domande a scelta al proprietario, quando serve)

- Il nome della prima mappa e dei suoi posti (per ora nel gioco si chiama «Deserto»).
- Personaggi: aspetto dei soldati Rossi e Blu (prima della tappa 2).
- Se più avanti aggiungere altre modalità (era stata proposta anche «Ordigno», piazza e disinnesca: non scelta).

## La prima mappa: il borgo nel deserto (bozza)

Pianta nostra, quadrata, **128 × 128 m** (scelta del proprietario: 4 volte la superficie della prima bozza): a
piedi si attraversa in 30-40 secondi. Bozza a blocchi in `blender/zona_deserto.blend`, guidata passo passo dal
proprietario. Partenze opposte in diagonale.
Tre strade tra le due partenze, collegate in due punti, e un centro alto conteso:

```
  [Partenza Blu: il pozzo e le palme]  ───── strada alta: tetti e muretti ─────┐
        │                                                                       │
        │                  ┌──── TORRE GRANDE (centro, si sale) ────┐           │
        ├── vicoli ────────┤        cortile con i muretti           ├── vicoli ─┤
        │                  └────────────────────────────────────────┘           │
        │                                                                       │
        └───── strada bassa: letto del fiume asciutto, sotto il ponte ── [Partenza Rossa: la cava]
```

- Fatto finora in Blender: cielo limpido (solo in Blender; nel gioco si rifà in three.js), dune e rocce
  lontane all'orizzonte, terreno sconnesso a triangoli con strade battute, pietre piccole, medie e massi, mura di
  pietra con pilastri, torrioni d'angolo e 5 tratti crollati. Case: 5 tipi scelti dal proprietario (tutti), vuoti
  dentro con porte e finestre vere: A fango con parapetto, B due piani a gradoni con scala esterna, C bianca con
  cupola, D casa-torre di pietra, E casa con cortile e pozzo. Gli esempi stanno fuori dal muro nord (raccolta
  `esempi_case`); nel villaggio 18 copie (raccolta `case`) che usano la stessa mesh degli esempi.
- Torre centrale (`torre_centrale`): pietra, 8 × 8 m, tre piani da 4 m più la terrazza a 12 m con i merli; porte a
  sud e a nord, feritoie su ogni piano, scale di legno interne a rampe (est, ovest, est) con i buchi nei solai.
- Ripari (`massi`, `casse`): rocce lunghe e basse ai lati della strada ad anello, massi grossi e gruppi di massi
  nei punti aperti, cataste di casse accanto alle case. Mai sulle strade, nelle partenze o davanti alle porte.
- Altri 4 tipi di casette (scelta del proprietario): F casetta di fango con giare, G rimessa con tetto a una falda,
  H due volumi uniti con passaggio interno, I bottega con portico e tenda blu. Gli esempi dei 9 tipi stanno nella
  scena `Esempi` del file (non nella scena della mappa).
- Mappa più fitta, perché non ci si veda da lontano: 44 case dentro le mura, messe a caso ma dove chiudono più
  viste lunghe, con vicoli di almeno 3,5 m; 8 muri alti 3,2 m (`muri_alti`) di traverso sulla strada ad anello,
  sfalsati, così la strada non è più dritta per 128 m. Misura con i raggi a 1,6 m d'altezza: le viste libere oltre
  50 m sono scese dal 16% al 2%, oltre 80 m dall'8% allo 0%; dalle partenze la vista più lunga è circa 85 m.
- Muretti a secco (`muretti`): pietre una per una, alte 0,85-1,15 m, qualche pietra mancante e qualche copertina;
  30 tratti, alcuni a L.
- Tutta l'isola ha lo stesso terreno sconnesso, anche fuori dalle mura (fino a circa 110 m dal centro, poi si
  unisce alle dune). Fuori dalle mura: 40 case sparse a caso con angoli qualsiasi (raccolta `case_fuori`), sassi e
  massi. Solo paesaggio: da dentro non si esce.
- Ridotta per il telefono: da 82.000 a 47.000 triangoli. Terreno fuori dalle mura separato (`terreno_fuori`) e
  semplificato; sassi e massi semplificati; tolte le facce di sotto appoggiate a terra; le case fuori usano versioni
  semplici senza interni (`lontana_A`…`lontana_I`). Nel gioco le case uguali vanno disegnate a istanze
  (`InstancedMesh`), una per tipo.
- Muretti bassi (ci si ripara accucciati) e alti (si gira intorno), case con due porte e una finestra, tre torri di
  pietra: una grande al centro con la scala, due piccole sui lati da cui si vede una strada sola.
- Nessuna stanza chiusa senza seconda uscita; nessun punto da cui si vede una partenza.
- In Tutti contro tutti si rinasce in 12 punti sparsi, lontano da chi è vivo; a squadre ogni squadra ha 4 punti
  alla sua partenza.
- Armi a terra: mitraglietta nei vicoli (2), fucile a pompa nelle case (2), fucile di precisione in cima alle torri
  piccole (2). Ricompaiono dopo 20 secondi.
- Colori: sabbia e pietra chiara, ombre azzurrine, porte di legno colorate, teli rossi e blu sulle due partenze.
- Si costruisce in Blender (`blender/zona_deserto.blend` → `public/zona/models/deserto.glb`), più una pianta
  semplice per gli urti (scatole e rampe) scritta come dati in `public/zona/map-deserto.js`, la stessa che usa il
  server.

### Punti della mappa

Nella raccolta `punti` di `blender/zona_deserto.blend`, come oggetti vuoti con la proprietà `tipo` (nel GLB
arrivano come nodi con i loro `extras`: il gioco li legge da lì). Le coppie sono simmetriche rispetto al centro
(x, y → -x, -y), così nessuna squadra è avvantaggiata; ogni punto a terra ha 1,2 m liberi intorno.

- `raccolta_falco_1/2`: sulle terrazze delle due case a gradoni a nord e a sud della torre (si sale dalla scala
  esterna; nel parapetto est della casa B c'è ora un varco dove arriva la scala).
- `raccolta_tuono_1/2`: dentro le due case di fango a ovest e a est del centro.
- `raccolta_calabrone_1/2`: nei vicoli a nord-ovest e a sud-est.
- `raccolta_ruggito_1/2`: vicino al cortile centrale.
- `cassa_medica_1…4`: due verso ovest/est e due verso nord/sud. Modello `cassa_medica` in `zona_armi.blend`:
  valigetta bianca con croce verde, maniglia e chiusure (580 triangoli; croce verde, non rossa).
- `rinascita_01…12`: rinascita in Tutti contro tutti, a coppie simmetriche, almeno 20 m l'una dall'altra, rivolte
  verso il centro.
- `partenza_blu_1…4`, `partenza_rossa_1…4`: le partenze a squadre sulle due piazzole d'angolo.

## Personaggi

Scelte del proprietario: **due divise diverse** (non solo il colore), **viso coperto**, in prima persona si vedono
**braccia e arma** (modello a parte, da fare con le armi).

In `blender/zona_soldato.blend`, low-poly, circa 750 triangoli ciascuno, a pezzi rigidi (ogni pezzo segue un osso
solo), davanti verso -Y, alti 1,8 m in posa a T:

- **Rossi** (`soldato_rossi`): tunica chiara, gilet marrone aperto, fascia rossa in vita, cartucciera di traverso,
  pantaloni larghi con le fasce alle caviglie, turbante chiaro con banda rossa e coda dietro, fazzoletto rosso sul
  viso con la fessura per gli occhi.
- **Blu** (`soldato_blu`): divisa sabbia, giubbotto tattico grigio con tasche e toppa blu, zainetto, cintura,
  ginocchiere, fascia blu sulle braccia, elmetto con fascia blu e occhiali, passamontagna scuro.
- Scheletro uguale per tutti e due (`scheletro_rossi`, `scheletro_blu`, 19 ossa con nomi italiani: bacino,
  schiena, petto, collo, testa, spalla, braccio, avambraccio, mano, coscia, stinco, piede), così le animazioni si
  fanno una volta sola.
- Animazioni (azioni di Blender, 30 al secondo, tutte con l'arma imbracciata: mano destra all'impugnatura davanti
  al petto, sinistra avanti sotto la canna): `fermo` (respiro, 60 fotogrammi, in ciclo), `cammina` (32, ciclo),
  `corre` (20, ciclo, busto in avanti), `accucciato` (40, ciclo, un ginocchio quasi a terra), `spara` (8, rinculo),
  `ricarica` (44, la mano sinistra va al caricatore e alla cintura), `colpito` (12, scatto all'indietro), `cade`
  (40, si piega e cade di schiena, braccia aperte). Fatte con un calcolo di posizioni (piedi a terra, mani sull'arma),
  non a mano.
- Nel gioco: l'arma si attacca all'osso `mano.R`; la mira in alto e in basso si fa ruotando `petto` dal codice;
  le gambe usano `cammina`/`corre` e il busto può fare `spara`/`ricarica` sopra (miscelando le azioni). Da fare più
  avanti, se serve: camminare accucciati.

## Regole delle armi e della salute (scelte del proprietario)

Bilanciamento **«Duro, la testa conta»**: salute 100 per tutti, colpo in **testa ×4**, gambe ×0,75, corpo ×1.
Munizioni di riserva **infinite** (conta solo il tempo di ricarica). La salute si recupera solo con le **casse
mediche a terra**: punti fissi come le armi, +50 salute (non oltre 100), ricompaiono dopo 30 secondi.

| Arma | Danno a colpo | Cadenza | Caricatore | Ricarica | Distanza buona |
| --- | --- | --- | --- | --- | --- |
| Baretta | 25 | 5 al secondo, un colpo per clic | 10 | 1,4 s | fino a 25 m |
| Calabrone | 18 | 12 al secondo, automatica | 20 | 2,0 s | fino a 20 m |
| Tuono | 14 per pallino, 8 pallini | 1 ogni 0,9 s | 5 | 0,5 s per cartuccia | fino a 10 m |
| Ruggito | 28 | 9 al secondo, automatica | 25 | 2,3 s | fino a 40 m |
| Falco | 110 | 1 ogni 1,6 s | 1 | 2,6 s | ovunque, con mirino ×4 |
| Coltello | 50 (alle spalle 100) | 2 al secondo | | | a contatto |

Oltre la distanza buona il danno cala fino al 60% (il Tuono oltre 15 m quasi niente). Colpi per eliminare: in testa
1 con Baretta, Ruggito, Falco; 2 con Calabrone; al corpo 4 Baretta e Ruggito, 6 Calabrone, 1 Falco, 1 Tuono da
vicino. I numeri vanno in `public/zona/rules.js` e si ritoccano dopo le prove.

## Armi (modelli)

In `blender/zona_armi.blend`, low-poly a colori sui vertici, misure vere, l'origine di ogni arma è il punto
dell'impugnatura (lì va l'osso `mano.R`) e la canna guarda verso -Y. Il caricatore è un oggetto figlio a parte, così
nella ricarica si può togliere.

Seconda versione, più curata (spigoli smussati, sagome vere invece di scatole, più dettagli), 1.600-2.400
triangoli per arma: vanno bene in prima persona; per le armi in mano agli altri, se il telefono soffre, si fa una
versione semplice.

- **Baretta** (`baretta`): carrello sabbia con zigrinature davanti e dietro, finestra di espulsione, fusto nero con
  slitta, ponticello, cane, sicura, guancette di legno zigrinate, mire con i puntini bianchi.
- **Calabrone** (`calabrone`): castello con leva d'armamento, manicotto forato con anelli gialli, slitta lunga,
  mire, impugnatura e impugnatura davanti in gomma, calcio a telaio, caricatore a strisce gialle e nere.
- **Tuono** (`tuono`): castello con finestre, canna con bindella e mirino d'ottone, serbatoio a tubo, pompa di legno
  a scanalature, calcio a pistola di legno con zigrinatura e calciolo di gomma, 5 cartucce rosse col fondello
  d'ottone sul fianco.
- **Ruggito** (`ruggito`): castello sabbia in due parti, paramano ottagonale con feritoie, blocco del gas e mirino,
  spegnifiamma a punte, slitta, mirino a punto rosso con lente, calcio sabbia su tubo, caricatore curvo a pezzi.
- **Falco** (`falco`): canna scanalata con freno di bocca, calcio di legno scuro con appoggio guancia e calciolo,
  cannocchiale con torrette e anelli, otturatore a pomello, grilletto d'ottone, bipiede chiuso.
- **Coltello** (`coltello`): lama con filo e dorso, guardia, manico di legno con anelli di gomma, pomolo.

### Braccia in prima persona

Nello stesso file: scheletro `braccia` (ossa `radice`, `arma`, `braccio`, `avambraccio`, `mano` destra e sinistra),
occhio (camera `occhio`) all'origine che guarda verso -Y, campo visivo 75°. Due versioni: `braccia_blu` (maniche
sabbia con fascia blu, guanti neri) e `braccia_rossi` (maniche chiare col risvolto, polsini rossi, mani fasciate),
circa 1.400 triangoli. Le mani sono pugni chiusi che impugnano.

- L'arma si attacca all'osso `arma` (oggetto figlio dell'osso, posizione (0, -0,1, 0)); dove sta l'arma e dove
  stanno le mani lo decidono le azioni, calcolate con le posizioni vere dell'impugnatura e dell'appoggio di ogni arma.
- Azioni per ogni arma (`baretta`, `calabrone`, `tuono`, `ruggito`, `falco`, `coltello`): `tiene_<arma>` (leggero
  dondolio, in ciclo), `spara_<arma>` (rinculo; il Tuono tira indietro la pompa; il coltello affonda) e
  `ricarica_<arma>` (arma inclinata, mano sinistra al caricatore, giù a prenderne un altro e di nuovo su; il Tuono
  mette le cartucce una alla volta, il Falco tira l'otturatore).
- La Baretta si tiene a due mani; mitraglietta con l'impugnatura davanti; Tuono, Ruggito e Falco con la sinistra
  sotto la canna; il coltello con la destra sola.
- Nel file c'è una vetrina (raccolta `vetrina_fp`, sotto le braccia principali) con tutte e sei le armi in mano.

Si gioca soprattutto dal computer (indicazione del proprietario): armi e braccia possono restare dettagliate;
il telefono resta possibile ma non è la misura di tutto.

## Come funziona (per tutte le tappe)

- Pagina a sé, `public/zona/index.html`, con three.js come la Lobby; si apre nell'overlay `#zona-overlay` di
  `app.js`, con la Lobby spenta. «Esci» (dal menù Esc) manda `zona-exit` all'app, come oggi.
- Il server decide colpi e salute: il telefono manda solo i tasti premuti e la direzione dello sguardo; il server
  muove tutti, controlla i colpi e manda a tutti posizioni, salute ed eliminazioni. Così nessuno bara e tutti vedono
  la stessa partita.
- Il proprio movimento si vede subito (il telefono prevede e poi si corregge sul server); gli altri si vedono un
  attimo nel passato, scorrevoli. Per i colpi il server «torna indietro» di quanto è in ritardo chi spara (al massimo
  0,2 s), così si colpisce quello che si vedeva.
- Le regole (movimento, urti con la mappa, danni delle armi, raggio del colpo) stanno in un file solo,
  `public/zona/rules.js`, usato sia dal telefono sia dal server, con calcoli uguali su ogni dispositivo (niente
  `Math.random` nelle regole: numeri casuali con un seme, come nel biliardo).
- Il server è una parte della Durable Object `Room` come il balilla (`balilla-hub.js`) e il golf: una classe
  `ZonaRoom` in `zona-server.js`, creata in `worker.js`, collegata con WebSocket. Gira a 20 passi al secondo solo
  finché c'è qualcuno collegato.

## Le tappe

Si fa una tappa per volta, e si passa alla successiva solo dopo che il proprietario l'ha provata nell'app.

### Tappa 1: poligono di tiro, da soli

**Cosa si vede.** Dal corridoio si entra in un poligono di tiro di cemento (continua il tunnel): corsie con sagome
che si alzano e cadono, un tavolo con le 4 armi e il coltello. Si cammina, si salta, si raccolgono le armi, si
spara, si ricarica. Mirino, munizioni, colpi sulle sagome (punteggio e tempo), suoni nostri (fatti nel codice con
Web Audio, come nei giochi arcade). Levette sul telefono, WASD e mouse sul computer. Menù con Esc: sensibilità,
volume, Esci. Niente server.

**Modello del poligono** (`blender/zona_poligono.blend`, fatto): niente corridoio (tolto su richiesta del
proprietario), si parte già nella sala (punto `partenza` davanti alla parete dell'ingresso, guardando il bancone),
una sala 14 × 8 m con armadietti, panca, casse di munizioni, mobiletto con la
cassa medica, pannello forato e scritta «POLIGONO» sopra la porta; al centro il **bancone delle armi** con i punti
`tavolo_<arma>` per le sei armi. Linea di tiro gialla e nera a y 0, mensola a 1 m (non si passa oltre), 5
postazioni con i separatori e il numero della corsia (punti `postazione_1…5`). Poligono lungo 52 m: righe tra le
corsie, cartelli e righe a 10, 20, 35 e 50 m, travi para-colpi a strisce, tubi sul soffitto, neon (materiale
`neon`, luminoso), in fondo il terrapieno di sabbia a gradoni sotto la scritta «ZONA OPERATIVA». Soffitto a 4 m.
**Sagome** (`sagoma`, 630 triangoli): cartone a forma di busto con testa, anelli stampati su petto e testa, su un
paletto; l'origine è la cerniera, così il gioco le fa cadere ruotandole all'indietro e le rialza; stanno sulla base
`sagoma_base`. 16 sagome: in ogni corsia a 10, 20 e 35 m (un po' sfalsate), nella corsia 3 anche a 50 m per il
Falco; ognuna ha le proprietà `corsia` e `distanza`. Circa 8.000 triangoli in tutto.

**Fatto (codice).** `public/zona/index.html` e `zona.css` (pagina, mirino, conti, menù), `zona.js` (scena, ciclo,
colpi, sagome che cadono e si rialzano dopo 2,5 s, buchi sui muri, rinculo, mirino del Falco ×4 con il
cannocchiale, sfida di 60 secondi con il risultato nel menù), `rules.js` (movimento con urti a scatole, salto,
accucciato, gradini; armi con cadenza, ricarica, dispersione; danni con testa ×4), `map-poligono.js` (scatole del
poligono), `controls.js` (computer e telefono), `viewmodel.js` (braccia e arma con le azioni di Blender, fiammata),
`audio.js` (spari, ricariche, colpi sulle sagome, passi, tutti fatti nel codice). Si parte con Baretta e coltello;
al bancone E (o PRENDI) prende un'arma: Calabrone, Tuono, Ruggito e Falco vanno nel posto 1 (una alla volta).
Punti: busto 1, testa 3. Prove: `tests/zona-rules.test.mjs`. Nell'anteprima locale c'è `zonaStato()` per leggere
lo stato e, solo su localhost, `zonaProvaSparo(true/false)`.

Da sapere: lo scheletro delle braccia in Blender ha la mano destra a +x, che dalla camera «occhio» appare a
sinistra; nel gioco `viewmodel.js` lo specchia (z → -z). Se si rifanno le braccia, meglio metterle giuste in
Blender (destra a -x) e togliere lo specchio.

**File previsti all'inizio.** `public/zona/index.html` (pagina e interfaccia), `public/zona/zona.js` (scena, ciclo di gioco),
`public/zona/rules.js` (movimento, urti, armi: già pensato per il server), `public/zona/controls.js` (levette,
tastiera e mouse), `public/zona/weapons.js` (modelli e animazioni in mano), `public/zona/audio.js`,
`public/zona/models/armi.glb` (da `blender/zona_armi.blend`), `public/zona/models/poligono.glb`.

**Prove.** `tests/zona-rules.test.mjs`: movimento e urti con muri e rampe, danni e cadenza di ogni arma,
ricarica, raggio del colpo che si ferma sul muro. A mano nell'anteprima (`Anteprima Binottoland`): telefono e
computer, 60 immagini al secondo, il telefono non scalda; uscendo la Lobby torna.

### Tappa 2: uno contro uno online

**Cosa si vede.** Dal menù «Gioca online»: si entra in una partita Tutti contro tutti sulla mappa del deserto con
un'altra persona. Si vede l'altro soldato muoversi e sparare, la salute, chi ha eliminato chi, la rinascita dopo 3
secondi, il conto alla rovescia dei 5 minuti e la classifica finale. Le armi a terra spariscono quando qualcuno le
prende e tornano dopo 20 secondi.

**Fatto (codice).** Nel menù del poligono «Gioca online» ricarica la pagina con `?online` (`main.js` sceglie
`zona.js` o `online.js`: in memoria c'è una mappa sola); dal menù online «Poligono di tiro» torna indietro.

- **Una partita sola per tutto il circolo** (Durable Object `zona-deserto-v1`, `/api/zona/ws` e `/api/zona/state`),
  fino a 8 persone, Tutti contro tutti. Da soli si gira per la mappa «in attesa»; quando entra il secondo parte la
  partita di 5 minuti (punteggi a zero, tutti rinascono). A tempo scaduto 10 secondi di classifica (vince chi ha più
  eliminazioni, a parità meno morti, se no pareggio), poi se ne comincia un'altra. Se si resta in uno, si torna in
  attesa; se escono tutti si riparte da capo. Niente si salva: la partita vive in memoria.
- **Server** (`zona-server.js`, classe `ZonaRoom` creata in `worker.js` solo quando serve): 20 passi al secondo con
  `setInterval` solo con qualcuno collegato. Il telefono manda comandi di 1/60 s (avanti, lato, tasti a bit, sguardo,
  arma in mano) a gruppi ogni 50 ms; il server li rifà con `rules.js` e scarta quelli in più rispetto al tempo
  passato (niente corse troppo veloci). Colpi: il telefono dice quale momento sta guardando, il server rimette gli
  altri dov'erano allora (storia delle posizioni di 0,6 s, ma mai oltre 0,2 s indietro) e tira i raggi: testa, busto e
  gambe (`playerHit` in `rules.js`); il coltello alle spalle fa 100. Rinascita dopo 3 s nel punto `rinascita_*` più
  lontano da chi è vivo, con Baretta e coltello. Armi a terra: E le prende (va nel posto 1), tornano dopo 20 s; casse
  mediche prese passandoci sopra se la salute non è piena, +50, tornano dopo 30 s. Se la Durable Object si spegne, al
  primo messaggio rifà i giocatori dai collegamenti aperti.
- **Collegamento**: come gli altri giochi, il WebSocket autenticato resta nell'app (`public/zona-link.js`, aperto da
  `app.js`); la pagina del gioco manda e riceve con postMessage (`zona:connect`, `zona:send`, `zona:packet`).
- **Telefono** (`public/zona/net.js`, `online.js`): il proprio movimento si calcola subito con le stesse regole e si
  corregge quando arriva la posizione vera (rifacendo i comandi non ancora confermati, la differenza si smaltisce in
  un decimo di secondo); gli altri si disegnano 100 ms nel passato, a metà tra due fotografie del server. Sparo,
  rinculo, suono e buco sul muro si vedono subito; il danno arriva dal server (segno sul mirino, numeri, schermo
  rosso quando si è colpiti). Soldati degli altri con le animazioni (gambe: fermo, cammina, corre, accucciato, cade;
  busto: spara, colpito), il petto si piega per la mira, l'arma in mano, il nome sopra la testa; i colori pari sono
  Blu e i dispari Rossi. Tempo in alto, eliminazioni a destra, classifica con Tab (sul telefono toccando la salute),
  schermata «Eliminato da…» con il conto alla rovescia. La partita continua anche con il menù aperto.
- **Mappa**: `deserto.glb` (tutta la scena «Scene», senza la scena `Esempi`; le case uguali usano la stessa mesh e
  nel gioco diventano `InstancedMesh`, una per tipo), `soldati.glb` (i due soldati con i due scheletri e le 8
  azioni, come tracce NLA dello scheletro Rossi; nel gioco servono a tutti e due). `public/zona/map-deserto.js` è
  **generato** da `scripts/zona-deserto-urti.py` dentro Blender: 2.523 scatole (le isole di case, mura, muretti,
  muri alti, torre, massi e casse; massi e casse un po' più strette), 4 confini invisibili che i colpi attraversano,
  l'altezza del terreno a griglia di 1 m (133 × 133, letta con raggi, interpolata tra quattro punti) e i punti della
  raccolta `punti`. `rules.js` ha `makeWorld` (scatole divise in celle di 4 m, terreno, raggio cella per cella) e
  `moveStep` accetta il mondo al posto dell'elenco di scatole: si cammina sul terreno e, scendendo a piedi, si resta
  attaccati.

- **Poligono condiviso** (richiesta del proprietario: «ci si veda nel poligono tra giocatori, no fuoco amico li
  dentro»): una stanza a parte, `zona-poligono-v1` (`/api/zona/poligono/ws`), con la stessa `ZonaRoom` in modalità
  «poligono». Lì ognuno si muove da sé con le regole di sempre e manda 20 volte al secondo dove sta (posizione,
  sguardo, accucciato, arma in mano) e quando spara; il server lo passa agli altri, tenendo le posizioni dentro il
  poligono. Gli altri si vedono come soldati in terza persona (stesso `soldiers.js` della partita, 100 ms nel
  passato), si sentono e si vede la fiammata. Niente fuoco amico: i colpi attraversano i giocatori e valgono solo
  per sagome e muri. Le sagome sono di ognuno (scelta più semplice): chi spara le vede cadere solo da sé, così punti
  e sfida dei 60 secondi restano personali.

- **Grafica del deserto** (28 novembre, su richiesta del proprietario): cielo vero (`Sky` di three) con il sole
  basso del pomeriggio da sud-ovest, ombre morbide del sole in un riquadro di 96 m che segue il giocatore a passi
  interi (così non tremano; 4096 punti sul computer, 2048 sul telefono), foschia color sabbia, materiali opachi.
  Paesaggio lontano senza ombre proiettate.
- **Sfarfallio** nelle intersezioni e su alcuni muri: nei modelli c'erano facce sovrapposte sullo stesso piano con
  colori diversi (case, mura, muri alti, torre; nel poligono dettagli, righe e anelli delle sagome). Corrette in
  Blender staccando di 3-4 mm la faccia più piccola di ogni coppia; piazzole delle partenze alzate a 9 cm.
- **Spigoli arrotondati**: in `zona_deserto.blend` case, mura, muretti, muri alti, torre e casse hanno uno smusso di
  3 cm (2 cm muretti e casse) in 2 passaggi. Le mesh uniche passano da 15.000 a 115.000 triangoli e `deserto.glb` da
  3 a 11 MB: sul computer va bene, sul telefono il primo caricamento è più lento.
- **Torre centrale**: la scala ora arriva davvero ai piani (mancavano 2 gradini alla prima rampa e 4 alla seconda) e
  le tre fasce esterne, che erano lastre piene sopra il buco della scala, sono anelli intorno ai muri. Nel
  movimento (`rules.js`) se dopo un gradino se ne tocca subito un altro basso si sale anche su quello (al massimo 3,
  65 cm in tutto, ognuno al massimo 40 cm): le scale strette si prendono di lato con il corpo su due gradini. Provato
  con una simulazione: dalla porta sud si arriva alla terrazza a 12 m.

Da sapere: il terreno non ferma i colpi (sale e scende al massimo di un metro e mezzo). Le scatole sono dritte: le
rocce sono un poco più strette del loro ingombro. Le armi in mano agli altri seguono la mano destra e lo sguardo,
non l'osso della mano. Nell'anteprima locale la pagina online si apre ma non trova il server («si gioca dall'app»).

**Prove.** `tests/zona-server.test.mjs`: due giocatori finti; colpo al corpo e in testa, colpo a vuoto, il muro ferma
il colpo, eliminazione e rinascita dopo 3 s, ritorno indietro che colpisce dove si vedeva ma non oltre 0,2 s, 600
comandi in un colpo solo scartati, numeri strani senza danni, correre contro un muro non lo attraversa, armi a terra
che spariscono e tornano, cambio solo verso armi possedute, cassa medica, fine partita con vincitore e nuova
partita, uscite, stessa persona da un'altra finestra, risveglio della Durable Object. `tests/zona-net.test.mjs`:
`net.js` contro il server vero con 60 ms di ritardo per parte, corsa a zig-zag con salti: il telefono finisce dove
lo mette il server, senza scatti. A mano: due persone su staging, telefono contro computer.

### Tappa 3: fino a 8, squadre e bot

**Fatto (codice, 28 novembre).** Senza ospite né impostazioni per ora (scelte del proprietario: sempre a squadre,
bot medi).

- **Squadre** (`zona-server.js`): al collegamento si va nella squadra con meno persone; dal menù «Rossa», «Blu» o
  «Automatica» (la prima volta si entra scegliendo; si può cambiare, si rinasce alla nuova partenza). Al massimo 4
  persone per squadra. Si rinasce alla partenza della propria squadra (`partenza_blu_1…4`, `partenza_rossa_1…4`), in
  un punto libero. Niente fuoco amico: i compagni non si colpiscono e i colpi li attraversano. Vince la squadra con
  più eliminazioni (a parità, pareggio). Si gioca appena c'è una persona (con i bot); a 0 persone si ferma tutto.
- **Bot** (`zona-bots.js`): ogni squadra si riempie fino a 4; quando entra una persona esce un bot (prima uno già
  eliminato), quando esce torna. Nomi «Bot Aldo», «Bot Bruna»… Si muovono con gli stessi comandi dei giocatori
  (stesse regole e muri). Mappa dei passaggi a celle di mezzo metro (libera dove un giocatore sta in piedi), strada
  con A* accorciata nei tratti dritti; restano a terra (niente torri). Vista: fino a 70 m, 130° davanti, 9 m anche
  alle spalle, raggio dagli occhi al petto e alla testa che si ferma ai muri. «Medi»: sparano dopo circa mezzo
  secondo (0,45 s ± 0,2) da quando vedono un nemico, si girano al massimo di 6 rad/s, mirano al petto con un errore
  di 0,025 rad più 0,0011 per metro, che cambia ogni 0,35 s; da vicino si spostano di lato. Senza nemici vanno dove
  hanno visto qualcuno (per 4 s), se no verso un punto a caso (armi, casse, rinascite, partenze, centro); se restano
  fermi saltano e rifanno la strada. Non raccolgono armi: partono con Calabrone, Ruggito o Tuono a caso.
- **Pagina** (`online.js`): scelta della squadra nel menù, in alto «BLU n · tempo · n ROSSA», classifica con Tab
  divisa per squadra (i bot segnati), nome sopra la testa solo per i compagni, braccia del colore della propria
  squadra (`viewmodel.js`, `setTeam`). I soldati hanno il modello della squadra (Blu o Rossi).

**Prove.** `tests/zona-bots.test.mjs`: strada tra le due partenze tutta libera, il muro nasconde e alle spalle non si
vede, da soli 7 bot e 4 contro 4, in due 6 bot, scelta della squadra con un bot che esce, al massimo 4 persone per
squadra, niente fuoco amico; 90 secondi di partita con 6 bot: girano, sparano e colpiscono, nessuno dentro un muro,
un passo del server sotto i 200 ms (circa 15 ms).

**Mani e mira (28 novembre).** In `zona_armi.blend` i pugni chiusi sono diventati mani con le dita (palmo sul lato
esterno, tre dita in tre falangi che girano attorno all'impugnatura, indice destro sul grilletto, pollice dietro),
costruite attorno al punto dove passano impugnatura e canna in ogni azione `tiene_`; guanti neri (Blu) e mani
fasciate (Rossi). Ai soldati visti dagli altri le armi lunghe vanno dalla mano destra verso la sinistra (seguono le
animazioni). Mira con il tasto destro tenuto (telefono: MIRA): vista ×1,35 (Falco: cannocchiale ×4), arma al centro
con il punto di mira (`SIGHT` in `viewmodel.js`) sulla linea dello sguardo, dispersione a metà (`AIM_SPREAD` in
`rules.js`), e si cammina soltanto (il server mette il passo lento quando arriva il bit della mira). Col Ruggito si
vede il punto rosso nella lente.

**Mouse libero con due monitor (28 novembre).** Dove Telegram non lascia bloccare il puntatore (Telegram Web, e
forse alcune versioni per computer) si gioca a «mouse libero» e il cursore poteva uscire sull'altro monitor: la vista
si fermava e non si girava a 360°. In `controls.js`: vicino al bordo sinistro o destro della finestra (15% per lato)
la vista continua a girare, più in fretta più si è vicini al bordo (fino a circa un giro in 2 secondi), con una
freccia sul bordo; se il mouse esce dalla finestra si ferma; a ogni clic (al massimo ogni 3 s) si riprova a bloccare
il puntatore.

**Da fare ancora, se il proprietario vuole:** impostazioni dell'ospite (tempo, livello dei bot), annuncio sulla
bacheca della Lobby, bot che salgono sulle torri o raccolgono armi.

Progetto iniziale della tappa:

**Cosa si vede.** Il menù della partita: chi la apre è l'ospite e sceglie modalità (Tutti contro tutti o A
squadre), tempo e bot. Gli altri scelgono Rossa o Blu (o «automatica»). Fino a 8 persone; i posti vuoti li
prendono i bot, che girano per la mappa e sparano (sul server). Classifica con Tab, divisa per squadra; fuoco
amico spento. La partita si annuncia sulla bacheca della Lobby come gli altri giochi.

**File.** `zona-server.js` (squadre, bot, impostazioni dell'ospite), `public/zona/bots.js` o dentro
`rules.js` se serve anche al telefono, `public/zona/menu.js`, eventualmente un avviso in `turn-notices.js`.

**Prove.** `tests/zona-server.test.mjs` allargato: squadre equilibrate, i bot escono quando entra una persona e
rientrano quando esce, niente danni tra compagni, punteggio di squadra; `tests/zona-bots.test.mjs`: un bot non
attraversa i muri e non vede attraverso i muri. A mano: il gruppo intero una sera.

### Tappa 4: rifiniture

Da decidere con il proprietario dopo la tappa 3. Idee: personaggi e animazioni migliori, suoni di passi e di
ambiente, mappa seconda, coltello con animazione, statistiche della serata, mirino e sensibilità salvati per
persona, altre modalità.

**Mappa e ambiente più belli** (scelte del proprietario, 28 novembre). Si comincia dalla mappa in Blender, guardata
dal proprietario in Blender; poi l'ambiente nel codice.
- Mappa (Blender, `zona_deserto.blend`): **vita del borgo** (bancarelle con teli, carretti, giare, panni stesi,
  tappeti, lanterne); **piante e acqua** (palme, cespugli secchi, fichi d'India, oasi col pozzo vicino alla partenza
  Blu, erba secca ai bordi delle strade); **rovine e ripari nuovi** (case diroccate, carcasse di camion e jeep, sacchi
  di sabbia, con le scatole per gli urti); **dettagli sui muri** (crepe, intonaco caduto, pietre a vista, scritte e
  manifesti nostri, tende alle porte).
- Ambiente (codice): **vento e polvere** (folate di sabbia, polvere dai passi e dai colpi, teli e bandiere che si
  muovono); **suoni d'ambiente** (vento, uccelli, cane lontano, passi diversi su sabbia, pietra e legno); **luce più
  bella** (ombre nei vicoli, interni più scuri, luce calda «cotta» in Blender). L'ora della partita non è stata
  scelta: resta il pomeriggio.
- **Qualità prima del peso** (28 novembre): i ripari fatti a scatole sono stati scartati («sembra un gioco da 20
  centesimi»). Gli oggetti nuovi si fanno curati (spigoli smussati, ruote rotonde, pezzi veri); il limite dei
  triangoli non è più 60.000 ma quanto regge un telefono moderno (le copie uguali a istanze), da provare sul telefono.
  Al server i triangoli non pesano: usa solo le scatole degli urti.
- Fatto: **rovine e ripari** (raccolta `ripari`, con gli urti): un camion nell'angolo nord-est vuoto (cabina, cassone
  a tavole con una sponda rotta, una ruota mancante), 2 jeep vicino alle mura est e ovest, 6 postazioni di sacchi di
  sabbia a C alte circa 1 m su una montagnola, 2 case diroccate a L con porta e architrave, pietre a vista e travi;
  stile ruggine e sabbia. Tutto a coppie simmetriche (il camion sulla diagonale, a uguale distanza dalle due
  partenze), almeno 2,2 m liberi intorno. Macerie e trave caduta nella raccolta `arredi`, senza urti. Le scatole
  degli urti di questi oggetti stanno in mesh a parte (`<nome>_urti`, proprietà `urti` della mesh), non nel GLB.
  Circa 11.700 triangoli contando le copie.
- Fatto: **vita del borgo** (colori caldi e sbiaditi, tanti oggetti): mercato di 6 bancarelle sulla diagonale verso
  (-22, -30), altre 4 bancarelle e 8 carretti a coppie simmetriche (raccolta `ripari`, con gli urti), 67 giare, 55
  lanterne, 16 fili di panni tra i muri dei vicoli, tappeti stesi, appesi e arrotolati (raccolta `arredi`, senza
  urti). Tutto contro i muri delle case, mai davanti a porte e finestre, a 1,2 m dai punti, con 3 m liberi davanti
  agli oggetti grandi. I tetti di stoffa delle bancarelle sono oggetti a parte (`telo_…`), per farli muovere col
  vento nel codice. Oggetti `b_…`.
- Fatto: **trame su tutto**, cotte dalle trame procedurali di Blender (Noise, Voronoi, Brick, Wave) in immagini
  1024 ripetibili, in grigio, moltiplicate per i colori dei vertici: intonaco, pietra a corsi, roccia, sabbia, legno,
  metallo, stoffa, cotto (materiali `m_…`, immagini `trama_…`), ognuna con la sua mappa di rilievo (`rilievo_…`).
- Fatto: **case e torri meno da prefabbricato**: muri irregolari (gonfi e incavi di qualche centimetro, piede più
  largo, appena rastremati), spigoli con una smussatura sola e ombreggiatura morbida, sporco alla base, travi di legno
  sotto i tetti delle case di fango, cupola liscia a file di piastrelle. La pietra (mura, muri alti, torre centrale,
  case D) ha un trattamento più leggero (il proprietario: «un po' troppo»). Ogni casa ha la sua sfumatura: è una
  copia (`tinta_…`) della mesh del suo tipo, che resta la sorgente (proprietà `tipo_casa`).
- Fatto: **terremoto** (scelto dal proprietario al posto di una simulazione con la fisica): 56 case su 84 (2 su 3,
  dentro e fuori dalle mura) hanno la parte alta tagliata (Boolean esatto) da un angolo o da un lato, mai sotto
  2,3 m, così le porte restano libere; macerie, blocchi e sabbia ai piedi (`crollo_…`). Torre centrale, mura e case
  con il Falco restano intere. Gli urti delle case crollate sono le scatole del tipo, abbassate nella zona crollata
  (`urti_crollo_…`). Scelto il terremoto numero 1, forza 2,2, quota 0,67.
- Fatto: **massi e sassi** rifatti come rocce arrotondate e irregolari (stessi posti, stesse scatole); **sabbia**
  ai piedi dei massi (`sabbia_massi`), lungo la base di muri, case e muretti (`sabbia_muri`), e dune contro il muro di
  cinta dentro e fuori (`sabbia_mura`, alte 1-3 m; quella dentro si calpesta: entra nell'altezza del terreno del
  gioco). Niente sabbia sui punti e sulle due partenze.
- **Peso**: circa 516.000 triangoli in tutto. Il GLB è compresso con Draco (da 42 MB a 7,8 MB): `online.js` lo legge
  con il `DRACOLoader` di three.js 0.170.0 (`public/vendor/three/addons/loaders/DRACOLoader.js` e
  `libs/draco/gltf/`). Esportazione: scena «Scene», extras, niente luci, Y in alto, colori dai materiali, immagini
  JPEG 82, Draco livello 7. Da provare sul telefono che non scaldi e non scatti.

## Controlli prima di ogni rilascio

Oltre a `docs/controlli-prima-del-rilascio.md`: entrare dal corridoio della Lobby, giocare, uscire con Esci e
ritrovarsi nel corridoio con la Lobby normale; sul telefono la partita non scalda e non scatta.
