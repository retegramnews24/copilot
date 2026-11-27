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

## Da fare

Provarla nell'app di prova, anche con due giocatori (si vede il prodotto in mano all'altro?).
