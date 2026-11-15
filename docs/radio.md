# Radio: catalogo e brano in onda

[← Binottoland](../README.md)

Il catalogo richiede fino a 200 risultati italiani e conserva gli URL HTTPS utilizzabili. I preferiti restano personali. Il brano viene mostrato come testo scorrevole sotto i controlli, solo quando disponibile. Le emittenti che non trasmettono metadati ICY, o li offrono solo con API proprie, non mostrano titolo e artista.

L'audio rimane diretto tra dispositivo e stazione. L'endpoint autenticato `/api/radio/now-playing?station=UUID` risolve la stazione attraverso Radio Browser e legge solo un breve campione ICY: massimo 10 secondi, 256 KiB e quattro blocchi. Non accetta URL arbitrari dal client; verifica gli indirizzi e i redirect. I risultati hanno una cache breve per isolate e le richieste simultanee alla stessa stazione condividono il probe. Il client aggiorna ogni minuto durante l'ascolto con app visibile; pausa e cambio stazione invalidano le risposte precedenti.
