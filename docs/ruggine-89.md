# Ruggine 89 · corsa con i colpi

[← Binottoland](../README.md)

Corsa vista dall'alto sul circuito della Raffineria (3 giri) tra la tua auto gialla n. 89 e due avversari guidati dal
gioco, Scorpione e Avvoltoio. Si apre dalla pagina Giochi o dal cabinato della Lobby 3D: tutti e due gli ingressi
passano da `public/arcade-link.js` (margini di Telegram, tasto Indietro, Lobby 3D ferma mentre si gioca).
Gira tutto sul telefono: niente server, niente multigiocatore, niente classifica.

## Comandi

| | Computer | Telefono |
|---|---|---|
| Guidare | W A S D o frecce | Gas, Freno e sterzo sullo schermo |
| Colpo | Spazio | Colpo |
| Nitro (dopo un bidone rosso) | Maiuscole | Gas due volte |
| Vista | V | tasto della vista |
| Pausa | Esc o P | tasto Pausa |

Telefono o computer lo decide `public/touch-device.js`, come nel resto dell'app.

## Livelli

- Il livello 1 è il GP della Raffineria di sempre, con le curve allargate: quattro curve avevano raggio 4-5 caselle,
  più strette del muro (6,2), e lì le auto si incagliavano. Ora nessuna curva scende sotto 11.
- Dal livello 2 la pista la crea il gioco dal numero del livello (`trackFor` in `public/ruggine/world.js`): sempre la
  stessa per lo stesso livello, diversa da un livello all'altro, sempre intorno alla raffineria. Più si sale, più
  curve e più strette, ma mai sotto 8 caselle di raggio; le parti lontane della pista non si toccano mai.
- Avversari (`levelSetup` in `public/ruggine/cars.js`): uno in più ogni tre livelli, fino a cinque; a ogni livello un
  po' più veloci e più pronti a sparare.
- Vincere sblocca il livello dopo (salvato sul telefono, chiave `ruggine.livello`); il pulsante «Livello N» ricarica
  la pagina con `?livello=N`, così strada, muri e minimappa si costruiscono sulla pista nuova. «Ricomincia dal
  livello 1» torna all'inizio. Livelli fino a 30.

## Regole

- Il colpo stordisce chi hai davanti per 0,9 secondi; dopo lo stordimento c'è un secondo in cui non si può essere
  colpiti di nuovo (prima un avversario allineato dietro poteva tenerti fermo a lungo).
- I bidoni rossi danno un nitro; tornano dopo 7 secondi.
- Gli avversari seguono la loro corsia, frenano prima delle curve e sparano a chi hanno davanti. Hanno una velocità
  obiettivo minima, così ripartono sempre (prima un'auto ferma davanti alla curva dei punti 430-433 restava lì).

## Grafica e suoni

- Telefono: qualità media e niente bagliori; computer: qualità alta con bagliori.
- Se la grafica 3D non parte, il tasto lo dice invece di restare su «Caricamento». Gli errori vanno nel registro di
  Debug dell'app (`frame-errors.js`).
- I suoni partono spenti se in Impostazioni «Suoni» è spento; il tasto del gioco li riaccende.

## Prove

`tests/ruggine.test.mjs`: le funzioni di guida (`public/ruggine/cars.js`) girano senza grafica con un generatore con
seme. Otto corse con tre auto guidate dal gioco devono finire tutte; per i livelli da 1 a 20 la pista rispetta le regole e tutte le auto del livello finiscono; un'auto ferma alla curva stretta deve ripartire;
dopo un colpo serve un secondo prima del successivo. Per le prove a mano: `?dev` espone `window.ruggine`.
