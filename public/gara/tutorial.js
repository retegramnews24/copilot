// Tutorial a fumetti: la prima volta spiega il gioco passo per passo, dal disegno della pista alla fine della gara.
// Due tipi di fumetto:
// - "da fare": ti dice cosa fare; non serve premere niente, appena lo fai arriva il fumetto dopo;
// - "da leggere" (modal): blocca il gioco finché non premi il tasto, per esempio tutti i consigli della gara insieme.
// Ogni fumetto compare una volta sola. Si può saltare e si può sempre rifare dal menu.

import { isTouchDevice } from '../touch-device.js';

const KEY = 'gara.tutorial';
// scritte per telefono o computer (analisi 11.7): «col dito» e «tocca», oppure mouse, clic e rotellina
const touch = isTouchDevice();
const Tap = touch ? 'Tocca' : 'Clicca', tap = touch ? 'tocca' : 'clicca';

export const STEPS = {
  setup: { title: 'Benvenuto in F1 on paper!', text: `Qui scegli contro chi corri e l’ora della gara. Poi disegni la tua pista ${touch ? 'con il dito' : 'con il mouse'} e la corri in 3D. Quando sei pronto premi «Disegna la pista».` },
  draw1: { title: '1 · Il bordo esterno', text: touch ? 'Se vuoi una pista grande, prima allontana la vista con il cursore (−). Poi passa il dito per disegnare il bordo esterno e torna vicino al punto di partenza: si chiude da solo. Con due dita sposti e ingrandisci.' : 'Se vuoi una pista grande, prima allontana la vista con la rotellina o con il cursore (−). Poi tieni premuto il tasto sinistro per disegnare il bordo esterno e torna vicino al punto di partenza: si chiude da solo. Con il tasto destro sposti la vista.' },
  draw2: { title: '2 · Il bordo interno', text: 'Ora disegna il bordo interno, tutto dentro il primo. Lo spazio tra i due bordi è l’asfalto: lascia almeno 2,5 caselle.' },
  draw3: { title: '3 · La linea di partenza', text: 'Traccia una linea da un bordo all’altro. Verde: ci stanno tutte le auto affiancate. Rossa: non ci stanno, rifalla dove la pista è più larga.' },
  draw4: { title: '4 · Verso e giri', text: ` una delle due frecce sulla linea per scegliere il verso di gara. Con − e + scegli quanti giri.` },
  create3d: { title: 'Pista pronta!', text: 'Ora puoi creare la pista 3D: premi «Crea pista 3D» in basso a destra.' },
  place: { title: 'La partenza', text: ` una casella bianca sulla linea per mettere la tua auto. Le auto partono affiancate, con una casella libera tra una e l’altra.` },
  race: {
    modal: true, ok: 'Via!', title: 'Come si corre',
    items: [
      ['🚦 Semaforo', 'Le luci rosse si accendono una alla volta: quando diventano verdi, si parte.'],
      ['🎯 Le mosse', `Le auto vanno di casella in casella. I dischi colorati sono i punti dove puoi arrivare: ${tap} un disco e l’auto parte subito.`],
      ['⚙️ Le marce', 'Il numero sul disco è la marcia, cioè quante caselle fai. Blu: sali. Verde: tieni. Rosso: scali. Una marcia alla volta, dalla N alla 7ª.'],
      ['➡️ L’inerzia', 'L’auto tende a ripetere la mossa di prima: i dischi stanno intorno al punto dove ti porterebbe. Non puoi frenare o girare di colpo: prima delle curve rallenta!'],
      ['✕ Urto', 'Le ✕ escono di pista. Se ne tocchi una sbatti: resti fermo 2 turni, poi riparti in prima.'],
      ['👆 La vista', (touch ? 'Un dito sposta la vista; due dita ingrandiscono, girano e inclinano.' : 'Trascina col tasto sinistro per spostare la vista; la rotellina ingrandisce, il tasto destro gira, Maiuscole con la rotellina inclina.') + ' Se la sposti resta lì: «Centra» ti riporta sulla tua auto. Con «Griglia» nascondi i quadretti.']
    ]
  },
  crash: { title: 'Urto!', text: 'Al primo turno resti fermo. Al secondo l’auto si gira verso la pista. Poi riparti in prima, una casella alla volta.', auto: 7000 },
  lap: { title: 'Giro completato', text: 'Hai passato la linea nel verso giusto. La scia del giro prima diventa più chiara, quella di due giri fa sparisce.', auto: 6000 },
  end: { modal: true, ok: 'Fine', title: 'Fine del tutorial', text: 'Ora sai tutto. Il tutorial lo puoi rifare quando vuoi dal menu ☰ o dalla schermata «Nuova gara». Buona corsa!' }
};

export class Tutorial {
  constructor(el) {
    this.el = el; this.queue = []; this.open = null; this.timer = 0;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* niente memoria: si parte da capo */ }
    this.done = !!(saved && saved.done);
    this.seen = new Set((saved && saved.seen) || []);
    el.querySelector('[data-tut-ok]').onclick = () => this.close();
    el.querySelector('[data-tut-skip]').onclick = () => this.finish();
    // la X chiude solo questo fumetto: il tutorial continua con i prossimi
    el.querySelector('[data-tut-x]').onclick = () => this.close();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ done: this.done, seen: [...this.seen] })); } catch (e) { /* niente */ } }

  // mostra un fumetto (se non l'hai già visto). Per quelli "da leggere" la promessa finisce quando premi il tasto.
  show(key) {
    const s = STEPS[key];
    if (this.done || this.seen.has(key) || !s) return Promise.resolve();
    this.seen.add(key); this.save();
    return new Promise((res) => {
      const item = { key, s, res };
      // un fumetto "da fare" prende il posto di quello "da fare" che c'era prima; aspetta solo se è aperto uno "da leggere"
      if (this.open && !this.open.s.modal) { this.open.res(); this.open = null; }
      this.queue = this.queue.filter((q) => q.s.modal || (q.res(), false));
      this.queue.push(item);
      if (!this.open) this.next();
    });
  }

  next() {
    clearTimeout(this.timer);
    this.open = this.queue.shift() || null;
    if (!this.open) { this.el.hidden = true; return; }
    const { s } = this.open, card = this.el;
    card.classList.toggle('free', !s.modal);
    card.querySelector('[data-tut-title]').textContent = s.title;
    const body = card.querySelector('[data-tut-text]');
    body.innerHTML = '';
    if (s.items) {
      for (const [t, x] of s.items) { const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = t + ' '; p.append(b, x); body.append(p); }
    } else body.textContent = s.text;
    const ok = card.querySelector('[data-tut-ok]');
    ok.textContent = s.ok || 'Ok';
    ok.hidden = !s.modal && !s.auto; // i fumetti "da fare" non hanno il tasto: basta fare la cosa
    card.hidden = false;
    if (s.auto) this.timer = setTimeout(() => { if (this.open && this.open.s === s) this.close(); }, s.auto);
  }

  close() {
    if (!this.open) return;
    const o = this.open; this.open = null;
    o.res();
    if (o.key === 'end') { this.finish(); return; }
    this.next();
  }

  // chiude il fumetto "da fare" aperto (la cosa è stata fatta)
  hide() { if (this.open && !this.open.s.modal) this.close(); }

  finish() {
    this.done = true; this.save();
    const all = [this.open, ...this.queue].filter(Boolean);
    this.open = null; this.queue = [];
    all.forEach((q) => q.res());
    this.el.hidden = true;
  }

  restart() { this.done = false; this.seen = new Set(); this.save(); }
}
