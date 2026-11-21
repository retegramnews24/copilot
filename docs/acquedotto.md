# Acquedotto!

Puzzle 3D per un giocatore, in Giochi → Simulatori e sfide. File: `public/arcade/acquedotto.html` e `public/arcade/acquedotto.js` (Three.js da `public/vendor/three`), icona `public/arcade/acquedotto-icon-192.png`.

## Come si gioca

L'acqua esce dal rubinetto sopra il tabellone. Si toccano le tessere per girarle di 90° e portare l'acqua fino allo scolo in basso, dove riempie il vaso. L'acqua scorre dal vivo: se si gira una tessera bagnata si svuota, insieme a tutto quello che c'è dopo; dove un canale finisce contro un muro l'acqua schizza fuori. Tre gocce d'oro per livello stanno sul percorso della soluzione: contano quelle bagnate quando il vaso è pieno.

Tessere: dritta, curva, T, croce, ponte (canale in basso più tubo di vetro ad arco, due flussi separati), doppia curva (due curve indipendenti). Le tessere grigie con i bulloni sono bloccate nella posizione giusta e fanno da indizio.

Livelli generati a caso, sempre risolvibili: 4×4 fino al 3, 5×5 fino al 6, poi 6×6. Dal livello 2 compaiono ponti, doppie curve e tessere bloccate; rubinetto e scolo cambiano colonna. Il livello raggiunto, l'audio acceso o spento sono salvati sul dispositivo (`localStorage` `binottoland-acquedotto`).

## Collegamento con l'app

Si apre nell'iframe arcade (`public/arcade-link.js`, come Number Connect). `bridge.js` riceve i margini (`arcade:insets`) e manda `arcade:exit` dal tasto "← Giochi". La vibrazione di Telegram passa dall'app con `arcade:haptic` (`kind` impact/notification, `style`). Suoni tutti sintetizzati con Web Audio.

## Prove

`acquedotto.html?dev` espone `window.__acq` (`solve()`, `run(secondi)`, `next()`) per risolvere un livello e far avanzare la simulazione senza animazione. `acquedotto.html?icon` mostra l'inquadratura usata per l'icona (screenshot 1024×1024 con Edge headless, ridotto a 192 px).
