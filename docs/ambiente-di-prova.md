# Ambiente di prova (staging)

Un secondo Worker, **binottoland-motore-staging**, con dati suoi (tavoli, chat, classifiche separati da quelli veri).
Serve a provare una modifica dentro Telegram prima di pubblicarla per tutti.

## Come si usa
1. In GitHub Desktop crea il ramo `staging` (o passaci sopra), fai le modifiche, commit e **Push origin**.
2. Cloudflare pubblica il ramo `staging` sul Worker di prova (dopo i test, come per main).
3. Apri l'app di prova da Telegram: `https://t.me/checkmategame_bot/prova`. In alto c'è l'etichetta rossa **AMBIENTE DI PROVA**.
4. Se va bene, unisci `staging` in `main` (GitHub Desktop → Branch → Merge into current branch, stando su main) e fai Push: va online per tutti.

## Cosa fa diversamente
- Dati separati: è un altro Worker con i suoi Durable Objects.
- Il bot non scrive a nessuno (`TURN_NOTIFY=false`) e non fa backup (nessun cron).
- Stesso bot e stesso gruppo: l'accesso è riservato ai membri come nell'app vera.
- Non configurare mai il webhook del bot dall'ambiente di prova (`SETUP_ENABLED` resta spento): il bot deve continuare a rispondere al Worker vero.

## Da fare una volta sola (pannelli Cloudflare e Telegram)
1. **Telegram → @BotFather:** `/newapp`, scegli `@checkmategame_bot`, titolo "Binottoland prova", descrizione a piacere, foto qualsiasi, URL `https://binottoland-motore-staging.glauscat78.workers.dev`, nome breve `prova`.
2. **Cloudflare → Workers & Pages → Create → Import a repository:** repository `retegramnews24/copilot`, nome del Worker `binottoland-motore-staging`, ramo di produzione `staging`, comando di deploy `npx wrangler deploy --env staging`.
3. **Cloudflare → binottoland-motore-staging → Settings → Variables and Secrets:** aggiungi il secret `BOT_TOKEN` con lo **stesso valore** del Worker vero (serve a riconoscere l'accesso da Telegram).
4. **GitHub Desktop:** crea il ramo `staging` da main e fai Push.
