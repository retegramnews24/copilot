// Private post-race report for each team: what happened to its two cars and the main lesson.
// Estimates use the same coefficients as physics.js; they are explanations, not exact accounting.
import { lapTime } from './commentary.js';

const s1 = n => n.toFixed(1).replace('.', ',');
const minutes = sec => (sec >= 90 ? Math.round(sec / 60) + ' min' : Math.round(sec) + ' s');

export function debrief(r, order, track, teamId) {
  const winner = order.find(c => !c.dnf) || order[0],
    total = Math.max(1, (r.ended - r.start) / 1000),
    online = r.onlineSeconds?.[teamId] || 0;
  return order
    .map((c, i) => ({ c, position: i + 1 }))
    .filter(({ c }) => c.team === teamId)
    .map(({ c, position }) => {
      const notes = [],
        losses = [];
      const grid = c.grid || position,
        moved = grid - position,
        stops = c.pits || 0,
        pitSeconds = c.pitSum || 0,
        winnerPit = winner.pitSum || 0,
        trafficSeconds = c.trafficSeconds || 0,
        trafficLoss = c.trafficLoss || 0,
        wornLaps = (c.wornSeconds || 0) / (c.lastLap || c.best || 90),
        wornLoss = c.wornLoss || 0,
        fuelLeft = c.fuel || 0,
        places = n => n + (n === 1 ? ' posizione' : ' posizioni');
      if (c.dnf) {
        notes.push(
          c.dnfReason === 'Incidente'
            ? `Ritirato per incidente al giro ${Math.floor(c.progress) + 1}: è la sfortuna del 2%, non una scelta sbagliata.`
            : `Ritirato al giro ${Math.floor(c.progress) + 1}: benzina finita. Aumenta la benzina iniziale o il rifornimento, oppure scegli la strategia Prudente.`
        );
        losses.push({ seconds: Infinity, text: notes[0] });
      } else {
        notes.push(
          `Partito ${grid}°, arrivato ${position}°` +
            (moved > 0
              ? `: ${places(moved)} ${moved === 1 ? 'guadagnata' : 'guadagnate'}.`
              : moved < 0
                ? `: ${places(-moved)} ${moved === -1 ? 'persa' : 'perse'}.`
                : '.')
        );
        if (c.id !== winner.id && c.finished && winner.finished)
          notes.push(
            `Distacco dal vincitore ${winner.name}: ${s1((c.finished - winner.finished) / 1000)} s.`
          );
      }
      notes.push(
        `Ai box ${stops} ${stops === 1 ? 'sosta' : 'soste'} per ${Math.round(pitSeconds)} s` +
          (c.id !== winner.id ? ` (il vincitore: ${winner.pits || 0}, ${Math.round(winnerPit)} s).` : '.')
      );
      if (pitSeconds - winnerPit > 8)
        losses.push({
          seconds: pitSeconds - winnerPit,
          text: `Ai box hai speso ${Math.round(pitSeconds - winnerPit)} s più del vincitore: valuta una sosta in meno o meno benzina per sosta.`
        });
      if (trafficLoss >= 1) {
        notes.push(
          `Bloccato dietro vetture più lente per ${minutes(trafficSeconds)}: circa ${Math.round(trafficLoss)} s persi.`
        );
        losses.push({
          seconds: trafficLoss,
          text: `Hai perso circa ${Math.round(trafficLoss)} s bloccato dietro vetture più lente: qui sorpassare è difficile, conta partire davanti (qualifiche) o fermarsi quando la pista è libera.`
        });
      }
      if (wornLoss >= 1) {
        notes.push(
          `Circa ${s1(wornLaps)} giri con gomme sotto il 40%: circa ${Math.round(wornLoss)} s persi.`
        );
        losses.push({
          seconds: wornLoss,
          text: `Gomme troppo consumate: circa ${Math.round(wornLoss)} s persi negli ultimi giri prima della sosta. Anticipa la sosta o alza il "Rientro di sicurezza".`
        });
      }
      if (!c.dnf && fuelLeft > 6) {
        // The surplus was carried for the whole last stint (physics: fuel × (0.018 + km × 0.002) s per lap).
        const lastStint = r.laps - (c.lastPlanned || 0),
          weight = fuelLeft * (0.018 + track[1] * 0.002) * lastStint;
        notes.push(`Arrivato con ${Math.round(fuelLeft)} kg di benzina non usata.`);
        losses.push({
          seconds: weight,
          text: `Hai portato ${Math.round(fuelLeft)} kg di benzina in più fino al traguardo: il peso costa circa ${Math.round(weight)} s. Puoi caricarne meno.`
        });
      }
      // Being away is reported, but the key lesson prefers what the player can change in the strategy.
      const offline = total - online,
        offlineLoss = offline * 0.05;
      if (offline > total * 0.3)
        notes.push(
          `Muretto non collegato per ${minutes(offline)}: velocità al 95%, circa ${Math.round(offlineLoss)} s. Seguire la gara dà anche più esperienza.`
        );
      if (offline > total * 0.3 && !losses.some(l => l.seconds >= 5))
        losses.push({
          seconds: offlineLoss,
          text: `Non eri collegato per ${minutes(offline)}: senza muretto la vettura va al 95% (circa ${Math.round(offlineLoss)} s). Se puoi, segui la gara dal muretto.`
        });
      for (const item of c.incidents || [])
        if (item.applied && item.type !== 'accident')
          notes.push(
            item.type === 'puncture'
              ? 'Foratura: una sosta in più non prevista.'
              : 'Danno aerodinamico: +6 s al giro fino alla riparazione.'
          );
      if (r.fastest?.id === c.id) notes.push(`Giro più veloce della gara: ${lapTime(r.fastest.time)}!`);
      else if (c.best) notes.push(`Miglior giro ${lapTime(c.best)}.`);
      const key = losses.filter(l => l.seconds >= 3).sort((a, b) => b.seconds - a.seconds)[0];
      return {
        slot: c.slot,
        name: c.name,
        grid,
        position,
        dnf: c.dnf,
        positions: c.positions || [],
        key:
          key?.text ||
          (position === 1
            ? 'Gara perfetta: vittoria senza errori di strategia.'
            : 'Nessun errore evidente: per migliorare servono piloti, tecnici o sviluppo più forti.'),
        notes
      };
    });
}
