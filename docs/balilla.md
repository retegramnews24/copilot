# Calcio balilla (Lobby 3D) — decisioni prima del rifacimento

Si gioca **solo nella Lobby 3D**, al tavolo della sala giochi. Stato: pubblicato in Binottoland Playground (1.0.41).

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
- **Italiano a portiere singolo** (tipo Garlando): per squadra 1-2-5-3, aste telescopiche (non escono dall'altro lato).
- **Misure** (tavoli omologati ITSF): campo 120 × 70 cm, porta 20 cm, pallina 34 mm, aste da 16 mm ogni 15 cm
  (portiere a 7,5 cm dal fondo), asse delle aste a 8,5 cm dal campo, piede a 7,8 cm dall'asse.
  Figure: difesa a 23,5 cm, attacco a 20,5 cm, centrocampo a 12 cm. Corsa delle aste fino ai paracolpi (la spalla
  dell'omino si ferma a mezzo centimetro dalla sponda): difesa 20 cm, attacco 11,3 cm, centrocampo 7,8 cm, portiere 12,5 cm.
- **Aste**: passano sempre dentro le due boccole in ottone; dal lato opposto alla manopola rientrano in un manicotto
  telescopico fisso lungo quanto la corsa; i paracolpi in gomma sull'asta toccano la sponda a fine corsa.
- **Velocità** da tavolo vero: polso al massimo 55 rad/s (piede a circa 4 m/s), aste a 1,4 m/s, tiro forte 6,5 m/s,
  la palla rallenta sul panno; rialzi ai lati delle porte che la riportano verso il portiere.
- **Suoni** con l'intensità del colpo: piede in plastica, sponde in legno, palo in metallo, gol con la palla che scende nel canale.
- **Omino** modellato in Blender (`blender/omino.blend` → `public/lobby3d/models/omino.glb`), alto 12,4 cm; maglia e calzettoni
  si colorano per squadra (rossi con pantaloncini bianchi, blu con pantaloncini blu scuro).
- **Fisica realistica**: pallina che rotola e rallenta, rimbalzi su sponde e omini, tiri fino a circa 10 m/s, palla che si può fermare sotto il piede e passare tra le aste, angoli in rilievo che la riportano in gioco.

## Modalità
- **Contro il computer**: un livello che si adatta (più bravo se vinci, più facile se perdi).
- **1 contro 1 online** e **2 contro 2 online** (difesa = portiere + difesa, attacco = centrocampo + attacco).
- **Stesso telefono**: in orizzontale, rosso a sinistra e blu a destra, vista dall'alto.

## Comandi e vista
- **Dito o mouse**: su e giù sposta l'asta, uno scatto in avanti tira (più veloce = tiro più forte). PC: mouse e clic, o tastiera.
- **1 contro 1**: si muovono sempre le due aste più vicine alla palla, cambiano da sole.
- **Vista** dal proprio lato del tavolo, inclinata, con il personaggio alle manopole (stesso telefono: dall'alto).
