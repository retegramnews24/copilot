// Sponsor objective: one goal per team and Grand Prix, known before the race, paid once at the finish.
// Deterministic from season, round and team, so every request and every player sees the same goal.
export const SPONSOR_REWARD = 400000;

const hash = text => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

export function objectiveFor(s, teamId, round) {
  if (!s.schedule?.participants.includes(teamId) || round >= 13) return null;
  const participants = [...s.schedule.participants, ...(s.schedule.ai || [])],
    cars = participants.length * 2,
    me = s.teams[teamId],
    others = participants.filter(id => id !== teamId && s.teams[id]),
    // Rival: the other team closest in the championship (ties by id, for a stable choice).
    rival = others
      .map(id => s.teams[id])
      .sort(
        (a, b) => Math.abs(a.points - me.points) - Math.abs(b.points - me.points) || (a.id < b.id ? -1 : 1)
      )[0];
  const top = Math.max(3, Math.ceil(cars / 2)),
    both = Math.max(4, Math.ceil(cars * 0.75));
  const options = [
    { type: 'top', n: top, text: `Porta almeno una vettura nei primi ${top}.` },
    { type: 'both', n: both, text: `Entrambe le vetture al traguardo nei primi ${both}.` },
    { type: 'gain', n: 2, text: 'Guadagna almeno 2 posizioni dalla griglia con una vettura.' },
    { type: 'tyres', text: 'Gestione gomme: nessuna vettura sotto il 40% di gomma durante la gara.' },
    { type: 'fuel', n: 5, text: 'Efficienza: una vettura al traguardo con meno di 5 kg di benzina.' },
    ...(rival
      ? [{ type: 'beat', rival: rival.id, text: `Una tua vettura davanti a tutte quelle di ${rival.name}.` }]
      : [])
  ];
  const pick = options[hash(`${s.season}:${round}:${teamId}:sponsor-v1`) % options.length];
  return { ...pick, reward: SPONSOR_REWARD };
}

// order: final classification (array of race cars, best first).
export function objectiveMet(o, order, teamId) {
  const position = new Map(order.map((c, i) => [c.id, i + 1])),
    mine = order.filter(c => c.team === teamId),
    finished = mine.filter(c => !c.dnf);
  switch (o.type) {
    case 'top':
      return finished.some(c => position.get(c.id) <= o.n);
    case 'both':
      return finished.length === 2 && finished.every(c => position.get(c.id) <= o.n);
    case 'gain':
      return finished.some(c => (c.grid || 99) - position.get(c.id) >= o.n);
    case 'tyres':
      return finished.length === mine.length && mine.every(c => !(c.wornSeconds > 0));
    case 'fuel':
      return finished.some(c => c.fuel < o.n);
    case 'beat': {
      const best = Math.min(...finished.map(c => position.get(c.id)));
      const theirs = order.filter(c => c.team === o.rival && !c.dnf).map(c => position.get(c.id));
      return finished.length > 0 && theirs.every(p => p > best);
    }
    default:
      return false;
  }
}
