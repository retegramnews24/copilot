# Fractal Art Explorer — Telegram Mini App

Una galleria interattiva di arte frattale, ottimizzata per smartphone e Telegram Mini Apps. La schermata principale mette al centro l’immagine: scegli una composizione, esplora con zoom e trascinamento, cambia palette e salva le tue creazioni.

## Cosa trovi

- **32 preset artistici precaricati**, organizzati in Cosmo, Fiori, Geometrie, Natura e 3D.
- Oltre 30 formule e famiglie frattali del motore precedente, con Mandelbrot, Julia, Burning Ship, Newton, geometrie autosimili, felce di Barnsley e renderer 3D.
- Otto palette cromatiche selezionabili con un tocco.
- Zoom, pan e gesto pinch; rotazione e avvicinamento per le opere 3D.
- Deep zoom multiprecisione per Mandelbrot e Julia, ancora disponibile nel motore.
- Esportazione PNG, preferiti, fullscreen Telegram e cache offline.
- Catalogo completo delle formule disponibile dal pulsante menu; i controlli avanzati sono nascosti per lasciare spazio all’opera.

## Pubblicazione su GitHub Pages

1. Estrai lo ZIP.
2. Carica **tutti** i file e le cartelle nella root del repository GitHub.
3. In Settings → Pages seleziona il branch `main` e la cartella `/root`.
4. Inserisci l’URL HTTPS pubblicato come URL della Mini App in BotFather.

`index.html` si trova direttamente nella root. Non è richiesto un backend.

## Uso

- Tocca una scheda della collezione per caricare un’opera.
- Trascina sull’immagine per esplorare; usa pinch o rotella per lo zoom.
- Scegli una palette dalla barra in basso.
- Usa ✧ per una sorpresa, ↺ per tornare alla composizione iniziale e ⇧ per esportare PNG.
- Usa ☆ per i preferiti e ⛶ per lo schermo intero.
- Il menu in alto apre il catalogo completo delle formule.

## Nota

Le miniature della collezione sono illustrazioni cromatiche di anteprima; l’opera principale viene generata dal motore frattale nel browser. Le prestazioni 3D dipendono dal supporto WebGL2 del dispositivo. Il salvataggio usa la condivisione o il download offerti dal browser/Android: una Mini App non può scrivere direttamente nella cartella privata di Telegram.
