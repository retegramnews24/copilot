# Calcio balilla (Lobby 3D) — decisioni prima del rifacimento

Si gioca **solo nella Lobby 3D**, al tavolo della sala giochi. Stato: realizzato su staging.

## File
| File | Cosa fa |
|---|---|
| `public/lobby3d/balilla-rules.js` | Regole e fisica (stesso codice su server e telefono): rimessa dal foro, piede che tira, ferma e trascina la palla, rialzi negli angoli, gol e formati, palla morta |
| `public/lobby3d/balilla-ai.js` | Il computer: segue la traiettoria, alza le figure davanti ai tiri dei compagni, ferma e tira; livello salvato sul telefono che si adatta |
| `public/lobby3d/balilla.js` | Tavolo 3D, menu, comandi (dito, mouse, tastiera), viste, partite sul telefono |
| `balilla-hub.js` | Partite online sul server della Lobby (1 contro 1, 2 contro 2, cambio campo, rimessa) |
| `tests/balilla.test.js` | Regole, fisica, computer e server |

## Regolamento
- Base: **ITSF** ([regole ufficiali](https://tablesoccer.org/rules), [sintesi ITSF](https://s3.tablesoccer.org/organization/ITSF/education/ITSF_RULES_short_version_A3_en.pdf)).
- **Rullata impossibile**: il gioco limita la rotazione dell'asta (niente giro oltre 360° prima o dopo il tiro), quindi non serve una penalità.
- **Niente tempi di possesso** (ITSF ne ha di 10 e 15 secondi: qui no).
- **Rimessa all'italiana**: la palla entra dal foro laterale a centrocampo (prima battuta a sorteggio, dopo un gol rimette chi l'ha subito, palla ferma fuori portata: si rimette dal foro).
- **Formati** scelti da chi apre il tavolo: 5, 8 o 10 gol; partita secca o al meglio di 3. Nel 2 contro 2 si cambia campo tra una partita e l'altra.

## Tavolo
- **Italiano a portiere singolo** (tipo Garlando): per squadra 1-2-5-3, campo circa 120 × 70 cm, pallina 34 mm, aste telescopiche (non escono dall'altro lato).
- **Fisica realistica**: pallina che rotola e rallenta, rimbalzi su sponde e omini, tiri fino a circa 10 m/s, palla che si può fermare sotto il piede e passare tra le aste, angoli in rilievo che la riportano in gioco.

## Modalità
- **Contro il computer**: un livello che si adatta (più bravo se vinci, più facile se perdi).
- **1 contro 1 online** e **2 contro 2 online** (difesa = portiere + difesa, attacco = centrocampo + attacco).
- **Stesso telefono**: in orizzontale, rosso a sinistra e blu a destra, vista dall'alto.

## Comandi e vista
- **Dito o mouse**: su e giù sposta l'asta, uno scatto in avanti tira (più veloce = tiro più forte). PC: mouse e clic, o tastiera.
- **1 contro 1**: si muovono sempre le due aste più vicine alla palla, cambiano da sole.
- **Vista** dal proprio lato del tavolo, inclinata, con il personaggio alle manopole (stesso telefono: dall'alto).
