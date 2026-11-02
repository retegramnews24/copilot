# FractInt Mini — Telegram Mini App

**Versione 2.2.0** — esploratore frattale mobile-first, statico, senza backend obbligatorio.

## Funzioni incluse

- Catalogo di 36 formule e costruzioni frattali, divise in complessi, geometrici, natura/IFS e 3D.
- Insiemi dinamici: Mandelbrot, Julia, Multibrot, Burning Ship, Tricorn/Mandelbar, Celtic, Buffalo, Perpendicular Burning Ship, Phoenix, Magnet I/II, Nova, Newton z³−1 e z⁴−1, Sine, Exponential, Biomorph, McMullen/Rational e Lambda.
- Geometrici: Sierpiński, tappeto di Sierpiński, Koch, Lévy C, Drago, Hilbert, Cantor, Vicsek, albero di Pitagora e gasket di Apollonio.
- Natura/IFS: felce di Barnsley, albero frattale, spirali ispirate al Romanesco.
- Renderer volumetrico WebGL2 con ray marching e distance estimator per Mandelbulb, spugna di Menger, Mandelbox e sezione di Julia quaternionica.
- Worker JavaScript separato per i calcoli 2D, così l'interfaccia resta reattiva durante il rendering.
- Zoom, pan, pinch, rotazione 3D, iterazioni, esponente, costante Julia, 8 palette, preset, preferiti, PNG e render HD.
- Deep zoom multiprecisione per Mandelbrot e Julia, con coordinate/orbite fixed-point BigInt selezionabili a 128, 256, 512 o 1024 bit. Il renderer profondo lavora nel Web Worker e riduce automaticamente la risoluzione di anteprima alle precisioni più impegnative.
- Fullscreen nativo Telegram Mini Apps (Bot API 8.0+) con fallback alla Fullscreen API del browser.
- Esportazione PNG via condivisione nativa Web Share, selettore di salvataggio file quando disponibile e download Blob come fallback.
- Layout responsive per Android/Telegram, tasto schermo intero e supporto Telegram WebApp SDK.

## Pubblicazione GitHub Pages

1. Estrai lo ZIP e carica **tutti** i file e le cartelle nella root del repository.
2. In GitHub: Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
3. Attendi la pubblicazione e apri l'URL HTTPS assegnato a GitHub Pages.
4. In BotFather configura la Mini App/Web App con quell'URL HTTPS.

Non rinominare `index.html` e non spostare la cartella `js` o `assets`: sono percorsi relativi.

## Avvio locale

Per testare il Worker e WebGL, usa un server HTTP (non `file://`). Per esempio:

```bash
python -m http.server 8080
```

Poi visita `http://localhost:8080`.

## Note tecniche e limiti

- Il deep zoom usa aritmetica fixed-point BigInt fino a 1024 bit per Mandelbrot/Julia. Non è un perturbation/reference-orbit renderer: prestazioni e dettaglio dipendono da iterazioni, risoluzione e CPU del telefono. Gli altri frattali 2D restano in doppia precisione standard.
- Il Mandelbulb è una generalizzazione 3D resa con distance estimation e ray marching; la spugna di Menger e il Mandelbox usano distance estimator iterativi. Sono renderer real-time approssimati, non immagini pre-renderizzate.
- La formula di Romanesco è una visualizzazione procedurale ispirata alla fillotassi, non una simulazione botanica completa.
- Il rendering HD 2D aumenta la risoluzione alla qualità massima configurata dal dispositivo; la complessità e il tempo di calcolo dipendono da telefono/browser.
- **Salvataggio su Telegram/Android:** l’app genera un PNG locale. Quando il client espone Web Share, si apre il foglio di condivisione Android (puoi scegliere Telegram o File); altrimenti si avvia un download del browser. Una Mini App statica non può scrivere forzatamente in una cartella privata Telegram. L’API ufficiale `Telegram.WebApp.downloadFile` richiede un URL HTTPS del file ospitato su server, quindi non può ricevere direttamente il Blob appena creato nel canvas.
- Telegram SDK, Google Fonts e WebGL2 sono opzionali rispetto alle formule 2D: il sito resta utilizzabile senza login o API key. I Google Fonts sono solo un miglioramento estetico.

## Struttura

```text
fractint-telegram-pro/
├── index.html
├── style.css
├── manifest.webmanifest
├── service-worker.js
├── README.md
├── assets/
│   └── icon.svg
└── js/
    ├── app.js
    ├── catalog.js
    ├── render-worker.js
    └── renderer3d.js
```

## Riferimenti matematici

Le definizioni implementate seguono le formulazioni standard delle mappe complesse (Mandelbrot/Julia, Burning Ship, Tricorn, Multibrot, Newton e mappe razionali) e il metodo distance-estimation/ray-marching per i solidi frattali. Non esiste un catalogo finito di “tutte” le formule frattali possibili: questa raccolta include 36 famiglie/varianti significative ed è progettata per essere estesa. Per approfondire: Wolfram MathWorld, *Burning Ship Fractal*; documentazione e repository shader pubblici dedicati a Mandelbulb e distance estimation.

## Salvataggio immagini su Android

Premi **SALVA PNG**. L’app prova nell’ordine la condivisione file nativa (puoi scegliere Telegram e inviare a Messaggi salvati, oppure File), il selettore di salvataggio del browser quando supportato e infine il download standard. Il percorso effettivo è deciso da Android/Telegram: le Mini App non hanno accesso diretto alle cartelle private dell’app. Telegram `downloadFile` richiede un URL HTTPS ospitato su un server; per questo progetto statico non può ricevere direttamente il Blob PNG creato dal canvas.

## Deep zoom e limiti numerici

La precisione fixed-point BigInt è configurabile da 128 fino a 1024 bit e viene usata dal renderer Web Worker per Mandelbrot e Julia. A precisioni maggiori il lato lungo dell’anteprima e il numero di iterazioni vengono limitati automaticamente per evitare che il telefono resti bloccato. Non equivale a un renderer perturbativo con orbita di riferimento: per esplorazioni estremamente profonde e immagini finali ad altissima risoluzione, un renderer dedicato con perturbation theory e rendering a tile offrirebbe più dettaglio e velocità.
