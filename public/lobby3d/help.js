// Comandi della Lobby 3D, uno solo elenco per il tasto «?» nella 3D (solo l'attività in corso) e per la pagina
// Impostazioni → Personaggio e pallina → Comandi (tutte le attività). Righe diverse per telefono e computer.
// Ogni riga: [che cosa, come].
export const HELP = [
  {
    key: 'walk',
    title: 'Camminare',
    pc: [
      ['Muoversi', 'W A S D o le frecce; Maiuscole sinistro per correre'],
      [
        'Guardarsi intorno',
        'clic sulla scena per agganciare il mouse, poi muovi il mouse; Esc libera il mouse'
      ],
      ['Avvicinare la vista', 'rotellina'],
      ['Vista dagli occhi', 'V'],
      ['Saltare', 'Spazio'],
      ['Abbassarsi', 'tieni premuto Ctrl sinistro'],
      ['Colpo e parata', 'clic sinistro colpisce, tieni premuto il destro per parare (solo per gioco)'],
      ['Aprire o sedersi', 'avvicinati e premi E (lavagne, tavoli, cabinati, divani, sgabelli)'],
      ['Alzarsi', 'E o Esc'],
      ['Questo elenco', 'H o il tasto ? in alto a destra']
    ],
    touch: [
      ['Muoversi', 'cerchio in basso a sinistra'],
      ['Guardarsi intorno', 'cerchio in basso a destra, o trascina sulla scena'],
      ['Avvicinare la vista', 'due dita'],
      ['Vista dagli occhi', 'tasto in alto a destra'],
      ['Saltare, colpo, parata, abbassarsi', 'i quattro tasti attorno al cerchio di destra'],
      ['Aprire o sedersi', 'avvicinati e tocca il tasto giallo in basso a sinistra'],
      ['Alzarsi', 'tasto «Alzati»']
    ]
  },
  {
    key: 'stool',
    title: 'Sgabello',
    pc: [
      ['Prendere e posare', 'G'],
      ['Sedersi e alzarsi', 'E'],
      ['Alzare e abbassare', 'W e S, da seduto'],
      ['Molleggiare', 'Spazio, da seduto']
    ],
    touch: [
      ['Prendere e posare', '«Prendi» e «Posa»'],
      ['Sedersi e alzarsi', 'tasto giallo, poi «Alzati»'],
      ['Alzare e abbassare', '↑ e ↓, da seduto'],
      ['Molleggiare', '〰, da seduto']
    ]
  },
  {
    key: 'pinball',
    title: 'Flipper',
    pc: [
      ['Flipper', 'Z e M (o Maiuscole e le frecce), oppure i tasti sinistro e destro del mouse'],
      ['Leva', 'S, Freccia giù o Invio: tieni premuto e lascia; o trascina il pomello col mouse'],
      ['Colpo morbido o pieno', 'tocco breve o tasto tenuto'],
      ['Scossa al tavolo', 'Spazio'],
      ['Nuova partita', 'E all’inizio, S a fine partita'],
      ['Lasciare il flipper', 'E o Esc']
    ],
    touch: [
      ['Flipper', 'tocca a sinistra e a destra dello schermo'],
      [
        'Leva',
        'nella zona tratteggiata in basso al centro: tieni premuto o trascina giù, lascia per lanciare'
      ],
      ['Nuova partita', 'tocca lo schermo'],
      ['Lasciare il flipper', '✕ in alto a destra']
    ]
  },
  {
    key: 'balilla',
    title: 'Calcio balilla',
    pc: [
      [
        'Giocare',
        'clic sul campo per agganciare il mouse: su e giù sposta le stecche, destra e sinistra le gira'
      ],
      ['Difesa o attacco', 'Q cambia, oppure 1 e 2'],
      ['Pallina', 'Spazio la butta in campo (anche dopo un gol)'],
      ['Velocità delle stecche', '+ e -'],
      ['Liberare il mouse', 'Esc'],
      ['Lasciare il tavolo', 'E']
    ],
    touch: [
      [
        'Giocare',
        'trascina nel riquadro sotto il tavolo: su e giù sposta le stecche, destra e sinistra le gira'
      ],
      ['Difesa o attacco', '🔄 in basso a sinistra'],
      ['Pallina', 'tocco veloce al centro del campo (anche dopo un gol)'],
      ['Vista e zoom', 'trascina su e giù i riquadri «Vista» e «Zoom»'],
      ['Taratura', '⚙ in alto a sinistra'],
      ['Lasciare il tavolo', '✕ in basso a destra']
    ]
  },
  {
    key: 'pong',
    title: 'Pong sul monitor',
    pc: [
      ['Accendere e spegnere', 'E vicino al monitor'],
      ['Racchetta', 'I su, K giù']
    ],
    touch: [
      ['Accendere e spegnere', 'tasto giallo vicino al monitor'],
      ['Racchetta', 'tocca il monitor all’altezza dove vuoi la racchetta']
    ]
  }
];

// righe di un'attività per il dispositivo
export function helpFor(key, touch) {
  const h = HELP.find(x => x.key === key) || HELP[0];
  return { title: h.title, rows: touch ? h.touch : h.pc };
}

// elenco HTML (solo testo nostro, niente dati dall'esterno)
export function helpList(rows) {
  const ul = document.createElement('ul');
  for (const [what, how] of rows) {
    const li = document.createElement('li'),
      b = document.createElement('b');
    b.textContent = what;
    li.append(b, ': ' + how);
    ul.append(li);
  }
  return ul;
}
