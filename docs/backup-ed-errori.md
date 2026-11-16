# Backup ed errori

## Backup
- **Cosa:** tutti i dati del gioco. Lobby (tavoli, chat, classifiche), Binotto Simulator, avvisi del bot, Cinema, lavagne e ogni tavolo aperto (scacchi, dama, golf, moto, labirinto, Pong…). Non i file video del Cinema (sono solo una cache).
- **Quando:** ogni lunedì alle 03:00 UTC (cron in `wrangler.jsonc`), oppure a mano.
- **Dove:** le ultime 8 copie restano su Cloudflare (Durable Object `backup-v1`). Se è impostato il secret `BACKUP_CHAT_ID`, il bot manda anche il file in privato a quella chat: una copia fuori da Cloudflare.
- **Come funziona:** ogni Durable Object sa esportare e reimportare tutto il suo archivio (`/backup/export`, `/backup/import`); `backup.js` raccoglie i singoli archivi e quelli di ogni tavolo elencato in Lobby.

### Da PC (serve il secret `ADMIN_TOKEN`)
```powershell
$env:ADMIN_TOKEN='la-tua-chiave'
node scripts/backup.mjs list                 # copie salvate
node scripts/backup.mjs run                  # una copia adesso
node scripts/backup.mjs download <id>        # salva in backups/<id>.json (cartella esclusa da git)
node scripts/backup.mjs restore <id>         # rimette tutto com'era in quella copia
node scripts/backup.mjs restore <id> checkmate-lobby-v1   # solo alcuni archivi
```
Senza `ADMIN_TOKEN` (almeno 24 caratteri) le pagine `/api/admin/...` non esistono. I backup settimanali si fanno comunque.

**Attenzione al ripristino:** sostituisce gli archivi scelti con la copia; quello che è cambiato dopo la copia, in quegli archivi, si perde.

## Errori
- **Server:** ogni errore imprevisto viene scritto nei log (`server-error`) e chi gioca riceve un messaggio breve.
- **App:** gli errori JavaScript imprevisti arrivano al server (`client-error`): messaggio ripulito da token e dati Telegram, pagina, versione, piattaforma. Ogni errore diverso una sola volta, massimo 10 per sessione e 10 al minuto per persona.
- **Dove leggerli:** Cloudflare → Workers & Pages → binottoland-motore → **Logs** (Workers Logs, attivato con `observability` in `wrangler.jsonc`). Cercare `client-error` o `server-error`.

## Test
`tests/backup-runtime.test.js`: nel worker vero salva, elenca, scarica, invia su Telegram (simulato), cancella un tavolo e lo ripristina, ripristino parziale, cron settimanale, chiave obbligatoria, limiti delle segnalazioni di errore.
