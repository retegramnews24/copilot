# F1 on paper! · gara a quadretti

[← Binottoland](../README.md)

Gara a turni su una griglia: si disegna la pista col dito (o col mouse), poi si corre in 3D muovendo l'auto di
casella in casella. Nel codice si chiama anche «Gara a quadretti» (`public/gara`). Da soli contro i bot sullo stesso
telefono, oppure online da 2 a 8 auto tra persone e bot (`f1-server.js`, un oggetto del server per gara).

## Regole concordate

- **Pista.** Si sceglie prima il numero di piloti; si disegnano bordo esterno, bordo interno e linea di partenza. La
  pista è approvata se sulla linea verde ci stanno tutte le auto affiancate; la larghezza ha solo un minimo fisso di
  2,5 caselle. Niente griglia sfalsata: tutte le auto sulla stessa linea. Chi è ospite mette l'auto per primo.
- **Mosse.** Sempre su una casella. Marce da N a 7 con inerzia: le mosse possibili sono le 3×3 caselle attorno alla
  mossa precedente; la marcia sale o scende di una alla volta.
- **Bordo.** Toccarlo ferma l'auto sull'ultima casella buona e fa saltare 2 giri di mosse (al primo resta ferma, al
  secondo si gira verso il verso di gara), poi riparte in prima. Le auto non si urtano tra loro.
- **Traguardo.** La linea conta solo nel verso di gara; i giri li sceglie chi crea la pista.
- **Online.** Tutti scelgono insieme e le auto si muovono quando ha scelto l'ultimo. 60 secondi per mossa, poi guida
  il pilota automatico; per chi non c'è (app nascosta o ridotta a icona da 20 secondi, o ha abbandonato) guida subito.
  «Abbandona la gara»: la gara continua, la tua auto la guida il pilota automatico e non puoi vincere.
- **Bot.** Si chiamano «Bot 1», «Bot 2»… e guidano come l'IA di «Contro l'IA» (`AiDriver` di `ai.js`, che cerca la
  strada più corta), non come il pilota automatico. Non si fermano dove ha scelto di fermarsi un'altra auto.
  - Nella schermata «Nuova gara» si scelgono «Piloti» (le persone) e «Bot»: con i bot al massimo 8 auto in tutto
    (senza bot, sullo stesso telefono restano fino a 16 piloti).
  - «Contro l'IA»: tu più da 1 a 7 bot; prima metti la tua auto, poi i bot la loro.
  - «Stesso telefono»: i piloti giocano a turno e dopo di loro i bot, che mettono l'auto e muovono da soli quando
    tocca a loro.
  - Online: chi crea sceglie quanti piloti aspettare (lui compreso) e quanti bot; in sala d'attesa può cambiare i bot finché non
    preme «Parti ora», solo nei posti non presi dalle persone. Al via i posti rimasti liberi restano vuoti. I bot
    vanno sulla linea per ultimi (dopo chi ha creato la gara) e scelgono subito a ogni giro, così si aspettano solo le
    persone. Se vince un bot nessuno prende la vittoria nella Lobby. Per la Lobby i posti sono quelli delle persone
    («2/3 piloti + 1 bot»).

## Limiti della pista

Controllati dal server prima di ogni calcolo pesante, in `api.js` prima di entrare nella Lobby
(`public/gara/rules.js`: `checkBorderShape`, `checkFinishEnds`, `checkTrackSize`):

- punti dentro la griglia (2.000 × 2.000 caselle) e a distanza tra 0,1 e 2 caselle l'uno dall'altro (il gioco li mette
  a mezza casella);
- estremi della linea di partenza sui due segmenti di bordo dichiarati;
- al massimo un milione di caselle tra i due bordi, per il tempo di calcolo (circa 1,2 s di controllo e 0,3 s di
  mappa del pilota automatico su un PC). Il gioco avvisa già alla fine del bordo esterno se è enorme, e fa gli stessi
  controlli del server alla fine di ogni bordo e sulla pista arrotondata prima di mandarla (`checkOnlineTrack`).

## Rete

Il telefono chiede lo stato ogni 0,9 secondi (`public/f1-link.js`), e non lo chiede con l'app nascosta o ridotta a
icona. Con `?moves=N` il server manda solo le mosse dalla N in poi e le auto senza il percorso fatto: il telefono
attacca le mosse nuove a quelle che ha e ricostruisce i percorsi rifacendole. Prima ogni telefono riscaricava tutta la
gara a ogni scelta (fino a centinaia di MB in una gara lunga a 8).

Da fare se servirà: il server riscrive tutta la gara nel suo archivio a ogni scelta; una gara a 8 molto lunga si
avvicina al tetto di un valore salvato (2 MB). Si potranno salvare le mosse a blocchi.

## Grafica

Partenza «Media» sui telefoni e «Alta» sul computer (la scelta resta ricordata). La scena non disegna quando è
nascosta e, ferma, disegna un fotogramma su due. Se la grafica 3D non parte la gara lo dice.

## Prove

`tests/f1.test.js` (regole, limiti della pista, solo le mosse nuove, bot), `tests/f1-runtime.test.js` (server vero:
crea, pista sbagliata fermata in `api.js`, entra, mosse insieme, mosse nuove, abbandono, bot, chiude),
`tests/absent-players.test.mjs` (pilota automatico per chi non c'è).
