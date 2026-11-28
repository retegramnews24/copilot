// Regole delle slot machine della sala giochi (docs/slot.md), uguali per il server (club-wallet.js) e per la
// Lobby 3D (lobby3d/slot.js). Scelte del proprietario, 28 novembre 2026:
// - si punta 1, 2 o 3 gettoni a giro; le vincite si pagano in gettoni (moltiplicate per la puntata);
// - tre pagliacci di Binotto in fila vincono il jackpot in BTN, con qualsiasi puntata;
// - jackpot uno solo per le tre macchine: parte da 5 BTN e sale di 1 BTN ogni 25 gettoni giocati da chiunque;
// - jackpot circa una volta ogni 3.000 giri; la slot restituisce in tutto circa il 110% (jackpot compreso).
export const SLOT_BETS = [1, 2, 3];
export const SLOT_MACHINES = ['rossa', 'oro', 'nera'];
export const JACKPOT_START = 5;
export const JACKPOT_STEP = 25; // gettoni giocati per ogni BTN in più nel jackpot

// simboli, nell'ordine della striscia disegnata sui rulli
export const SYMBOLS = [
  'ciliegia',
  'limone',
  'arancia',
  'prugna',
  'anguria',
  'bar',
  'barbar',
  'sette',
  'btn',
  'pagliaccio'
];
// quanto esce ogni simbolo su ogni rullo (su 144): pagliaccio 10/144, quindi tre in fila 1 volta su 2.986
export const WEIGHTS = {
  ciliegia: 14,
  limone: 22,
  arancia: 20,
  prugna: 18,
  anguria: 16,
  bar: 14,
  barbar: 11,
  sette: 10,
  btn: 9,
  pagliaccio: 10
};
export const WEIGHT_TOTAL = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// vincite per 1 gettone puntato (si moltiplicano per la puntata)
export const PAYS = {
  btn: 175,
  sette: 100,
  barbar: 40,
  bar: 25,
  anguria: 20,
  prugna: 15,
  arancia: 12,
  limone: 10,
  ciliegia3: 20,
  ciliegia2: 5,
  ciliegia1: 2,
  barMisti: 10
};

// che cosa vince un giro: {gettoni (per 1 gettone puntato), jackpot, combo} — combo per il display
export function slotWin(r) {
  const [a, b, c] = r;
  if (a === 'pagliaccio' && b === 'pagliaccio' && c === 'pagliaccio')
    return { gettoni: 0, jackpot: true, combo: 'jackpot' };
  if (a === b && b === c && PAYS[a]) return { gettoni: PAYS[a], jackpot: false, combo: a };
  const cherries = r.filter(s => s === 'ciliegia').length;
  if (cherries === 3) return { gettoni: PAYS.ciliegia3, jackpot: false, combo: 'ciliegia' };
  if (r.every(s => s === 'bar' || s === 'barbar')) return { gettoni: PAYS.barMisti, jackpot: false, combo: 'bar' };
  if (cherries) return { gettoni: PAYS['ciliegia' + cherries], jackpot: false, combo: 'ciliegia' };
  return { gettoni: 0, jackpot: false, combo: '' };
}

// un simbolo da un numero a caso tra 0 e 1
export function pickSymbol(u) {
  let n = Math.floor(u * WEIGHT_TOTAL);
  for (const s of SYMBOLS) {
    n -= WEIGHTS[s];
    if (n < 0) return s;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

// quanto restituisce la slot (senza jackpot) e quanto spesso esce il jackpot: per le prove
export function slotOdds() {
  let back = 0,
    jackpot = 0,
    wins = 0;
  for (const a of SYMBOLS)
    for (const b of SYMBOLS)
      for (const c of SYMBOLS) {
        const p = (WEIGHTS[a] * WEIGHTS[b] * WEIGHTS[c]) / WEIGHT_TOTAL ** 3,
          w = slotWin([a, b, c]);
        back += p * w.gettoni;
        if (w.jackpot) jackpot += p;
        if (w.gettoni || w.jackpot) wins += p;
      }
  // il jackpot rende 1 BTN (5 gettoni) ogni 25 gettoni giocati: 0,2 per gettone, più i 5 BTN di partenza
  return { back, jackpot, wins, total: back + 5 / JACKPOT_STEP };
}
