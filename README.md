# Fiora — Fibonacci sanctuary

Mini App Telegram statica, in italiano, ottimizzata per Android e utilizzabile anche da browser. Nessuna compilazione, nessun token, nessun servizio audio esterno.

## Pubblicazione su GitHub Pages
1. Estrai lo ZIP e carica il contenuto di questa cartella nella radice del repository: index.html, style.css, app.js e README.md. Non caricare soltanto lo ZIP.
2. Su GitHub apri Settings → Pages, scegli Deploy from a branch, branch main e cartella / (root), quindi salva.
3. Attendi l'URL HTTPS di GitHub Pages e aprilo per controllare il caricamento.
4. In @BotFather configura la Main Mini App del tuo bot oppure il pulsante menu usando quell'URL HTTPS. Non occorre inserire il token del bot nei file.

Documentazione ufficiale: https://core.telegram.org/bots/webapps

## Esperienza
- Sette chakra nella pagina principale: palette tradizionali, intenzioni poetiche, composizioni e registri sonori differenti.
- Tre geometrie per ciascun chakra: rosetta ricorsiva, albero frattale, spirali logaritmiche con semi fillotattici.
- Tre paesaggi sonori: armonie sinusoidali, acqua filtrata e vento filtrato. Acqua e vento sono sintesi astratte, non registrazioni.
- Il suono parte soltanto con un tocco. Volume iniziale contenuto; silenziamento con dissolvenza.
- Modalità immersiva senza testi con pulsante di ritorno ed Escape su PC.
- Sessioni libere o da 5, 8, 13, 21 minuti; alla fine il suono sfuma e l'immagine si ferma.
- Preferenze di chakra, geometria, suono e volume salvate soltanto nel browser locale.
- Animazioni limitate a 34 fotogrammi/secondo, densità pixel limitata a 89/55, sospensione audio in background e rispetto delle preferenze di movimento ridotto.
- Fullscreen Telegram richiesto sui client compatibili, con fallback alla vista espansa; margini aggiornati dalle safe area Telegram. La barra di sistema resta gestita da Android e Telegram.

## Contratto Fibonacci
Scala di progetto: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597.
Gli spazi, i raggi, le dimensioni dei caratteri e le dimensioni minime dei controlli sono tratti dalla scala. La griglia desktop ha proporzione 3:5; quella mobile si ricompone in una colonna. Le dimensioni fluide sono adattate allo schermo, non possono essere tutte interi Fibonacci in pixel su ogni dispositivo.

Il rapporto R=89/55 approssima il rapporto aureo, limite dei rapporti fra numeri consecutivi. L'angolo fillotattico è 2π/R². Le ramificazioni sono 5, con 8 livelli e contrazione 1/R; le rosette usano 5 rami e contrazione 1/R². Sono presenti 233 semi. Rotazioni, pulsazioni e dissolvenze impiegano numeri o rapporti della successione. Respiro visivo: 5 secondi inspirazione, 8 espirazione, senza trattenere.

I registri base sono 144, 233, 377, 610, 987, 1597, 2584 Hz. Le tre voci sono ottenute moltiplicando il registro per rapporti Fibonacci e dividendo per 3; non sono frequenze terapeutiche o una codifica tradizionale dei chakra. I sette chakra e i loro colori appartengono al contenuto tematico, non alla successione numerica. Non si sostiene che un colore sia matematicamente generato da Fibonacci.

Valori tecnici (coordinate, conversioni secondi/minuti, RGB, opacità, media query e adattamento al viewport) non sono elementi della scala tipografica. Nessun asset raster o audio da scaricare; l'unica dipendenza remota è lo script ufficiale Telegram. Senza di esso l'esperienza funziona come pagina web, senza integrazione nativa.

## Verifiche
Controllo sintassi JavaScript e test automatico con DOM/Canvas/Web Audio simulati: cambio di tutti i chakra e delle geometrie, avvio e arresto dei tre suoni, modalità immersiva, timer e pausa delle animazioni. La verifica su dispositivo Android/Telegram reale va effettuata dopo la pubblicazione.
