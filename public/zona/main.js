// Zona Operativa: la pagina parte nel poligono di tiro (zona.js, da soli) oppure, con ?online, nella partita online
// sul deserto (online.js). Si passa dall'uno all'altro ricaricando la pagina, così in memoria c'è una mappa sola.
if (new URLSearchParams(location.search).has('online')) import('./online.js?v=8e29778d7b');
else import('./zona.js?v=32815ec769');
