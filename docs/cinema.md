# Cinema Streamer

[← Binottoland](../README.md)

Apri una sala da **Giochi e Applicazioni → Cinema Streamer**. In **Lobby → Sale Cinema** trovi le sale aperte e puoi entrarci direttamente. L’elenco mostra il canale corrente e chi è collegato. Da dentro il cinema, **Multisala** mostra le anteprime video delle sale aperte in un mosaico con audio disattivato all’avvio e permette di cambiare sala. Il tasto audio accende un’anteprima alla volta. Il primo riquadro YouTube idoneo può partire automaticamente. Gli altri si avviano dal lettore. Chi ha aperto la sala può chiuderla e riportare tutti alla lobby. Ogni spettatore può cambiare il canale per la propria sala. I preferiti e il loro ordine sono salvati sul server e condivisi in tempo reale fra tutte le sale. I preferiti sono sopra la ricerca e ogni griglia mostra quattro canali per riga. Trascina la maniglia di un preferito o usa le frecce quando la maniglia è a fuoco. I divanetti mostrano il personaggio Binottoland con i colori del singolo spettatore.

Il volume, il monitor e le dimensioni dei riquadri si salvano sul dispositivo. Trascina i separatori per regolare il layout. Su schermi stretti il pannello destro si apre con **Canali**. **Cinema Mode** allarga lo schermo e lascia visibili i divanetti, mentre **⛶** isola lo schermo del video. Se il browser blocca la riproduzione automatica, premi **Riproduci qui**.

La ricerca combina playlist M3U e il catalogo JSON IPTV-org con fonti FAST, tra cui Tubi, Pluto TV, Samsung TV Plus, Plex e Roku. Puoi filtrare per paese, categoria e fonte o aggiungere una playlist M3U pubblica via HTTPS per la sessione. La ricerca unisce i duplicati per URL e conserva gli stream alternativi. I flussi HTTPS sono riprodotti direttamente dal dispositivo. La disponibilità dipende dalla fonte e dal dispositivo.

Con **Guarda insieme** puoi aprire un link HTTPS diretto a uno stream o un video YouTube incorporabile. Il link cambia il contenuto della sala. Per YouTube, riproduzione, pausa e posizione sono condivise anche con chi entra dopo. I canali e i link possono essere salvati nei preferiti globali.

Nella sezione **Ricerca → YouTube**, incolla un link video per riprodurlo in sala o un link con ID del canale (`/channel/UC…`) per vedere i video recenti e aggiungere il canale ai preferiti condivisi. Quando il Worker ha il secret `YOUTUBE_API_KEY` per un progetto con YouTube Data API v3 attiva, si può cercare anche per nome, ottenere fino a 30 risultati e filtrare video, canali e dirette e aprire un canale con il suo `@handle`. Il lettore incorporato usa i controlli YouTube per le opzioni personali, mentre i pulsanti sotto lo schermo controllano la riproduzione condivisa.

Con **Condividi finestra**, un utente su PC può trasmettere una finestra o scheda a un massimo di tre spettatori della sala. La funzione usa una connessione WebRTC diretta e l’audio dipende dalla sorgente scelta nel selettore del browser. La pausa del lettore YouTube vale per chi la preme. I comandi **Per tutti** sincronizzano l’intera sala.

La barra sotto lo schermo distingue **Per tutti** da **Per te**. Il tasto quadrato ferma il video sul dispositivo. Se una finestra condivisa arriva senza traccia audio, compare **Solo video**.

**Invia al Cinema** collega per 30 minuti la chat privata con **@checkmategame_bot** alla sala corrente. Gli invii diretti e gli inoltri da qualsiasi chat arrivano in coda, fino a 12 in attesa. Il collegamento si rinnova a ogni invio accettato e si può disattivare con **Scollega**.

La coda riproduce video MP4/WebM, foto, GIF e audio nei formati supportati fino a 16 MB. Testi e allegati senza anteprima appaiono come schede. Gli spettatori vedono i contenuti Telegram solo nella sala collegata. Chi ha aperto la sala può avviare la coda mentre è attiva un’altra sorgente e passare al contenuto successivo.
