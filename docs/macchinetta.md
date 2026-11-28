# Macchinetta caffè e snack (Lobby 3D)

Solo visiva: niente soldi, niente punti. Si prende un prodotto e lo si consuma con il personaggio.

## Decisioni del proprietario (27 novembre 2026)

- **Una macchina sola, combinata:** vetrina degli snack a sinistra (4 file di spirali), caffè a destra (display,
  tastiera, tasti delle bevande, vano tazza); in basso il vano di ritiro degli snack.
- **Stile moderno:** metallo scuro, vetro, display e tasti con la luce.
- **Gli altri vedono:** il prodotto in mano al personaggio e i morsi o sorsi passano dal server, come le pose da
  seduti.
- **Tasti veri sulla macchina:** ci si avvicina («Usa (E)»), la visuale si avvicina al pannello e si toccano i tasti
  3D.

## Come funziona

1. Ti avvicini e premi «Usa»: la visuale va davanti al pannello.
2. Scegli: per gli snack il codice sulla tastiera (A1…D3), per il caffè un tasto bevanda. Il display mostra la
   scelta.
3. Scende: la spirale gira e lo snack cade nel vano di ritiro; per il caffè cade il bicchiere, scende il getto e
   sale il vapore, poi «Pronto».
4. Prendi: tocchi il prodotto e passa in mano al personaggio.
5. Consumi: a ogni tocco un morso o un sorso (tre in tutto); alla fine la carta o il bicchiere spariscono.

## Prodotti (scelti dal proprietario)

- **Bevande:** espresso, cappuccino, cioccolata calda, tè al limone.
- **Snack** (fila A in alto): A1 patatine, A2 cioccolato, A3 wafer, B1 cracker, B2 crostatina, B3 caramelle,
  C1 taralli, C2 biscotti, C3 merendina, D1 mentine, D2 acqua, D3 aranciata.

- **Colori:** grafite (metallo scuro, acciaio, luci azzurre nella vetrina) con linee luminose arancio sul davanti:
  sotto l'insegna, lungo i fianchi, sotto la vetrina, sopra il vano di ritiro e attorno al vano tazza.
- **Suoni** (fatti al momento con Web Audio, `vendingSounds`): bip dei tasti, errore, motorino della spirale, tonfo
  della caduta, sportello, bicchiere che cade, pompa e getto del caffè, «din» di pronto, morso e sorso.
- **Posto:** nell'atrio, contro la parete del cinema, a destra della porta (oltre la locandina), girata verso
  l'atrio.

## Da decidere

- La scritta dell'insegna (per ora «CAFFÈ · SNACK»).

## Fatto

- Modello: `blender/macchinetta.blend` → `public/lobby3d/models/macchinetta.glb`. Pezzi separati per le animazioni:
  spirale, sportello, tasti, confezioni (scatoletta, busta, bottiglietta), bicchiere e caffè.
- Codice: `public/lobby3d/vending.js` (`createVending`, `makeHeld`): tasti con la scritta, display, spirali che girano,
  confezione che cade nel vano (dietro il vetro), bicchiere che scende con getto e vapore, presa e tre morsi o sorsi.
  Provato nel browser con una pagina solo locale (`public/_prova-macchinetta.html`, fuori da git).

- Nella Lobby 3D (`lobby3d.js`, blocco «Macchinetta caffè e snack»): nell'atrio a x 6,15, contro la parete del
  cinema, girata verso l'atrio. «Usa · Macchinetta (E)» porta la visuale davanti al pannello (abbastanza lontana da
  vederla tutta anche sul telefono), «Esci (Esc)» torna a camminare. Il prodotto preso passa nella mano destra del
  personaggio (più grande del vero: i personaggi sono a blocchi); «Mangia / Bevi (F)» fa un morso o un sorso con la
  mano che sale alla bocca (`actCharacter`, `a.hold`, `fx.bite`), al terzo il prodotto sparisce.
- Gli altri lo vedono: la posa (`walk` e `seat`) porta `snack: {id, left, n}`; il server (`worker.js`) accetta solo
  un id valido e da 1 a 3 morsi rimasti (prova in `tests/expedition-runtime.test.js`).

## Una persona alla volta, e tutti vedono (scelta del proprietario, 28 novembre 2026)

Vale per tutte le macchinette della Lobby 3D. Chi usa una macchinetta lo dice nella posa (`use`: quale, la scelta o
il codice che sta scrivendo, ordini fatti, prodotti presi); il server (`club-machines.js`) la lascia solo al primo,
collegato e nel club. Gli altri vedono «la sta usando …» al posto di «Usa», e sulla loro macchinetta succede quello
che fa lui: tasti scritti sul display, spirale e caduta, caffè, popcorn che scoppiano, cartoccio e bicchiere, presa.
Chi va via senza prendere il prodotto lo perde, e la macchinetta torna libera.

## Carrello dei popcorn e della Binotto Cola

Decisioni del proprietario (28 novembre 2026):

- **Posto:** nell'atrio, contro la parete del cinema, a sinistra della porta, tra la pianta e il divano petrolio e
  senape (x -5,475; il tettuccio passa davanti alla parte bassa del quadro del panorama).
- **Aspetto:** carrello rosso e oro dei popcorn con le ruote, la vetrina col pentolino appeso, il tettuccio a strisce
  rosse e bianche con l'insegna «POPCORN» e le lampadine; accanto la colonnina della **Binotto Cola** (niente marchi
  veri), con il rubinetto e i bicchieri impilati. Vetro molto trasparente.
- **Uso:** «Usa (E)», la visuale va davanti al carrello e si sceglie tra tre tasti: **Popcorn**, **Cola**, **Tutti
  e due**. I popcorn scoppiano davvero: i semi gialli saltano fuori dal pentolino, si aprono in popcorn (quattro forme,
  col cuore giallo scuro) e cadono sul mucchio, che cresce; poi il pentolino si inclina e versa, e il cartoccio arriva
  sul banco e si riempie. La cola scende dal rubinetto nel bicchierone, poi arriva il coperchio con la cannuccia.
  Si tocca il prodotto pronto per prenderlo.
- **In mano:** il cartoccio nella mano destra, si mangia in sei manciate («Mangia», F) e si svuota a vista; la cola
  nella sinistra, quattro sorsi («Bevi», B). Con le mani già piene il tasto non parte.
- **Al cinema:** seduti sul divanetto la cola va da sola nel portabicchiere del bracciolo; a ogni sorso sale verso la
  bocca e torna giù. Il cartoccio resta in mano.
- **Gli altri vedono** cartoccio, manciate, cola in mano o nel portabicchiere e i sorsi (posa: `snack` con 6 manciate
  per i popcorn, `drink`).

Fatto: `blender/popcorn.blend` → `public/lobby3d/models/popcorn.glb` (carrello, tetto, vetro, mucchio, pentolino,
tasto, cartoccio, quattro chicchi, bicchierone, coperchio, cola, lampadine; i pezzi che si muovono sono all'origine),
codice in `public/lobby3d/popcorn.js` (`createPopcorn`, `makeHeldPopcorn`, `makeHeldCola`), suoni in `vending.js`
(scoppio, sfrigolio, versa). Prova del server in `tests/expedition-runtime.test.js`.

## Da fare

Provarle nell'app di prova con due giocatori: si vede il prodotto in mano all'altro? Quando uno usa una macchinetta,
l'altro vede «la sta usando» e quello che fa? I popcorn scoppiano bene anche sul telefono? La cola nel portabicchiere
sta al posto giusto su tutti i divanetti?
