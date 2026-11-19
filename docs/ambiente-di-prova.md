# Ambiente di prova (staging)

Un secondo Worker, **binottoland-motore-staging**, aperto da Telegram con `https://t.me/checkmategame_bot/prova`.

## Com'è adesso
- **Pagina bianca.** Nel ramo `staging` non c'è l'app: niente Lobby, giochi, chat. Si prova **un progetto alla volta**, aggiunto qui quando serve.
- **Niente test.** Su `staging` non girano i test di GitHub e Cloudflare pubblica subito (`scripts/deploy-gate.mjs`, `build` dell'ambiente staging in `wrangler.jsonc`).
- **Worker minimo:** `staging-worker.js` serve solo i file di `public/`. La classe `Room` resta vuota solo perché il Worker di prova la aveva già.
- **`staging` non si unisce mai in `main`.** Quello che funziona si riporta a mano su `main`, dove invece i test girano sempre.

## Come si usa
1. In GitHub Desktop passa al ramo `staging`, fai le modifiche, commit e **Push origin**.
2. Cloudflare pubblica il ramo `staging` sul Worker di prova (Settings → Build → Branch control: ramo `staging`).
3. Apri `https://t.me/checkmategame_bot/prova`.

L'app com'era in prova (Lobby a chat, Giochi a griglia, Settings, Giulio Simulator, Giuliosim 3D…) resta nella cronologia di git del ramo `staging`, fino al commit 1.0.61.