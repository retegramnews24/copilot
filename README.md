# Fractal Art Explorer — Telegram Mini App v4.2

Una galleria interattiva di forme frattali, geometrie autosimili, mappe caotiche, attrattori, sistemi stocastici e sculture 3D. Progetto statico pronto per GitHub Pages.

## Novità v4.2
- Splash screen iniziale di 5 secondi con frattale Julia animato, palette luminosa, marchio e indicatore di avanzamento. Al termine sfuma e apre l’esploratore. Tutta l’interfaccia e le funzioni della v4.1 restano invariate.

## Novità v4.1
- Modalità **Tela immersiva**: canvas a tutto schermo, senza titoli, HUD, comandi, filtri o testo sovrapposto; pensata per guardare l'opera e fare screenshot dal telefono.
- Uscita dalla tela: pulsante Indietro di Telegram, tasto `Esc` su desktop, oppure pressione prolungata nell'angolo in alto a destra se il client non espone un pulsante Indietro.
- Rimossa completamente l'esportazione/salvataggio PNG e il relativo pulsante.
- Catalogo ampliato con 71 forme nel catalogo e 67 opere curate con formule live: Mandelbrot/Julia e varianti, Newton, Lyapunov, curve di Koch/Lévy/Dragon/Gosper/Minkowski/Peano/Cesàro, Sierpiński, Cantor, Vicsek, T-square, H/Pentaflake/Hexaflake, IFS botanici, attrattori di Lorenz/Rössler/Thomas/Aizawa/Halvorsen/Chen/Dadras, mappe di Hénon/Ikeda/Clifford/De Jong/Hopalong/Bedhead, Fractal Flame, DLA/Brownian Tree, paesaggi fBm, reazione-diffusione Gray–Scott, Game of Life, automi Rule 30/90/110 e diagramma di biforcazione logistica, oltre ai quattro renderer volumetrici.
- Galleria mobile più compatta: più spazio al frattale, collezione orizzontale, filtri a scorrimento.
- Nessun servizio remoto necessario per i calcoli; il renderer usa worker e WebGL2 dove previsto.

## Pubblicazione su GitHub Pages
1. Estrai l'archivio e carica **tutti** i file nella root del repository.
2. In GitHub → Settings → Pages scegli `Deploy from a branch`, `main` e `/ (root)`.
3. Inserisci l'URL HTTPS come URL della Mini App in BotFather.

## Modalità screenshot
Tocca il pulsante ⛶ nella barra superiore per entrare in modalità solo grafica. La tela riempie tutto lo schermo e non mostra alcuna scritta o icona sopra l'immagine. In Telegram l'uscita usa `BackButton` e `requestFullscreen()/exitFullscreen()` quando supportati; in browser usa Fullscreen API, `Esc` oppure la pressione prolungata nell'angolo in alto a destra.

## Famiglie e riferimenti di catalogazione
La raccolta segue le principali famiglie comunemente usate per classificare i frattali: escape-time e dinamiche complesse; sistemi di funzioni iterate (IFS) e curve geometriche; L-system; attrattori caotici; processi stocastici e aggregazione; automi cellulari e frattali volumetrici. Non esiste un elenco finito di “tutte le forme possibili”: le famiglie generano varianti senza limite e questo catalogo è un atlante ampliabile, non un'enumerazione matematica esaustiva.

Riferimenti introduttivi: 
- Wolfram MathWorld, Fractal e voci correlate: https://mathworld.wolfram.com/Fractal.html
- IEEE Technology Navigator, Fractals: https://technav.ieee.org/topic/fractals/
- Fractal Institute, Fractal Types: https://fractal.institute/encyclopedia/mathematics/fractal-types/
- Fractal Lab, catalogo di dinamiche complesse, IFS, L-systems e curve geometriche: https://fractal.suparnpatra.com/
- Telegram Mini Apps API (fullscreen, safe areas, BackButton): https://core.telegram.org/bots/webapps

## Note tecniche
- La modalità a tutto schermo mostra il buffer renderizzato; non produce un file immagine e non avvia un salvataggio. Per conservare un'immagine, usa la funzione screenshot del sistema operativo del telefono.
- I sistemi stocastici usano semi deterministici per mantenere stabile l'immagine tra i render della stessa composizione.
- Le curve L-system e i frattali geometrici sono rendering 2D. Lorenz, Rössler, Thomas e altri attrattori sono proiettati su una tela 2D; i renderer Mandelbulb/Menger/Mandelbox/Julia quaternionica restano le forme volumetriche 3D.
- Alcune famiglie sono interpretazioni artistiche o implementazioni didattiche/procedurali, non simulazioni scientifiche calibrate.
