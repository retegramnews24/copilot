# Avvisi "tocca a te"

Nelle partite tra persone a **Scacchi, Dama, Forza 4 e Scarabeo** il bot scrive in privato a chi deve muovere.

## Quando arriva un messaggio
- Dopo ogni mossa (e quando l'avversario si siede, o quando Scarabeo inizia o serve un voto) il tavolo mette in coda un avviso per chi deve agire.
- La coda (`turn-notices.js`, Durable Object `turn-notices-v1`) aspetta 1 minuto, poi controlla:
  - che sia ancora lo stesso turno (chiede al tavolo, percorso interno `/turn-check`);
  - che la persona non stia guardando quel tavolo in quel momento (chiede alla Lobby, `/lobby/presence`);
  - che non abbia spento gli avvisi nelle Impostazioni.
- Un solo messaggio per turno. Un turno nuovo sostituisce un avviso ancora in attesa.
- Tra le 23 e le 8 (ora di Roma) non si manda niente: gli avvisi partono alle 8.
- Il messaggio ha il pulsante **Apri la partita**: apre la Mini App con `startapp=t-<stanza>` e l'app va dritta al tavolo.

## Attivazione
Telegram permette a un bot di scrivere in privato solo a chi ha avviato la sua chat. Chi preme **Avvia** nella chat del bot (comando `/start`, anche dal pulsante "Attiva" in Lobby) viene registrato come "avvisi attivi", solo se è membro del gruppo. Se Telegram rifiuta l'invio (bot mai avviato o bloccato) la persona viene segnata e saltata finché non preme di nuovo Avvia.

Nell'app: invito in Lobby finché gli avvisi sono spenti ("Più tardi" lo nasconde per 7 giorni), interruttore in Impostazioni → Preferenze.

## Configurazione
- `TURN_NOTIFY=false` sul Worker spegne tutti gli avvisi.
- Solo per i test: `TURN_NOTICE_DELAY_MS` (ritardo) e `TURN_QUIET_HOURS=off`.

## Test
`tests/turn-notices.test.js` (regole, ore di silenzio, coda), `tests/table-ai-runtime.test.js` (percorso completo nel worker vero), `tests/app-modules.test.mjs` (invito, interruttore, apertura dal messaggio).

## Tempo per muovere
- Ogni tavolo a turni ha un orologio (`s.clock`): riparte quando tocca a qualcun altro (nuova mossa o nuovo voto). Una proposta di patta non lo azzera.
- Dopo 48 ore senza mossa il bot manda un promemoria; dopo altre 48 ore il tempo è scaduto:
  - Scacchi, Dama, Forza 4 e Scarabeo in 2: chi doveva muovere perde a tavolino (conta in classifica e nei tornei);
  - Scarabeo in 3 o 4: chi doveva giocare salta il turno, la partita continua;
  - voto su una parola: i voti mancanti contano come "accettata".
- Entrambi i giocatori ricevono l'esito. Sul tavolo e in "Le tue partite" si vede il tempo rimasto.
- La sveglia del tavolo (`alarm`) scatta al promemoria e alla scadenza (`runClock` in worker.js, regole in `timeoutTable` di turn-notices.js).
- Solo per i test: `TURN_LIMIT_MS` accorcia le 48 ore (`tests/turn-clock-runtime.test.js`).
- Un tavolo a turni resta aperto 7 giorni dall'ultima azione; se ne possono avere fino a 10 insieme, oltre a un tavolo di un altro gioco.