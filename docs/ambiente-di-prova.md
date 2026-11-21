# Ambiente di prova (staging)

Un secondo Worker, **binottoland-motore-staging**, con dati suoi (tavoli, chat, classifiche separati da quelli veri).
Serve a provare una modifica dentro Telegram prima di pubblicarla per tutti.

## Come si usa
1. In GitHub Desktop crea il ramo `staging` (o passaci sopra), fai le modifiche, commit e **Push origin**.
2. Cloudflare pubblica il ramo `staging` sul Worker di prova, **senza test** (l'app è completa come main: stesso `worker.js`).

**Test e pubblicazione.** Su `main` i test girano su GitHub a ogni push (azione "Test") e `scripts/deploy-gate.mjs` pubblica solo se sono verdi (se sono ancora in corso aspetta fino a 12 minuti; se GitHub non risponde li esegue lui). Su `staging` l'azione "Test" non parte e `deploy-gate` pubblica subito: è un posto per provare, i test si fanno quando la modifica si riporta su main.

**Prove in corso su staging:** Lobby 3D (guscio facoltativo della Lobby: `public/lobby3d/`), F1 on paper! Sprint, Ruggine 89 (`public/ruggine/`).
3. Apri l'app di prova da Telegram: `https://t.me/checkmategame_bot/prova`. In cima c'è una riga rossa e accanto al nome la scritta **PROVA**.
4. Se va bene, la modifica si riporta a mano su `main`, con un commit a parte. **`staging` non si unisce mai in `main`**: la riga rossa e la scritta PROVA non devono finire nell'app vera.

I due rami hanno numeri di versione separati: `staging` può essere più avanti di `main`.

Se il Worker di prova mostra la versione di `main`, in Cloudflare → binottoland-motore-staging → Deployments i build hanno accanto la scritta **main**: in Settings → Build → Branch control il ramo di produzione deve essere `staging`. Dopo la correzione serve un nuovo push su `staging`.

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
