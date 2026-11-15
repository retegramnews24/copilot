// Computer-run teams that fill the grid when few people take part. They never vote, never buy,
// never hold a debrief or a sponsor goal, and they leave when a new season opens.
export const AI_GRID = 10;
const NAMES = ['Aurora Corse', 'Vesuvio Racing', 'Dolomiti Motorsport', 'Laguna GP'];
const DRIVERS = [
  ['Ivo Marchetti', 'Rita Galli'],
  ['Bruno Esposito', 'Lia Fontana'],
  ['Pietro Valli', 'Nora Bassi'],
  ['Dario Greco', 'Sara Leone']
];
const COLORS = [
  ['#7a5cff', '#e9f5ff', '#ffd475'],
  ['#ff7a3d', '#1d2433', '#ffffff'],
  ['#2fbf71', '#f4f1e8', '#1d2433'],
  ['#3db6ff', '#ffd475', '#1d2433']
];
export const isAi = t => !!t?.ai;
const average = (list, fallback) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : fallback);

// Called once, when the calendar is published: AI teams join the participants list.
export function addAiTeams(s) {
  if (!s.schedule || s.schedule.aiAdded) return 0;
  s.schedule.aiAdded = true;
  const humans = s.schedule.participants.map(id => s.teams[id]).filter(t => t && !isAi(t));
  const need = Math.max(0, Math.min(NAMES.length, Math.ceil((AI_GRID - humans.length * 2) / 2)));
  // As strong as the people in the championship, with a small spread between AI teams.
  const skill = Math.round(average(humans.flatMap(t => t.drivers.map(d => d?.skill)).filter(Boolean), 55));
  const crew = Math.round(
    average(humans.flatMap(t => Object.values(t.crew).map(c => c?.skill)).filter(Boolean), 55)
  );
  const engine = Math.round(average(humans.map(t => t.engine?.skill).filter(Boolean), 55));
  const aero = Math.round(
    average(
      humans.map(t => t.aero),
      1
    )
  );
  const chassis = Math.round(
    average(
      humans.map(t => t.chassis),
      1
    )
  );
  for (let i = 0; i < need; i++) {
    const offset = [3, -1, -4, 1][i],
      person = (name, k = 0) => ({
        id: `ai-${i}-${k}`,
        name,
        skill: Math.max(30, Math.min(99, skill + offset + k)),
        consistency: Math.max(30, Math.min(99, skill + offset - 2)),
        tyres: Math.max(30, Math.min(99, skill + offset)),
        salary: 0,
        points: 0
      });
    const id = 'ai:' + (i + 1);
    s.teams[id] = {
      id,
      ai: true,
      principal: 'Computer',
      name: NAMES[i] + ' AI',
      cash: 0,
      xp: 0,
      points: 0,
      colors: COLORS[i],
      count: 2,
      drivers: DRIVERS[i].map((n, k) => person(n, k)),
      crew: {
        motor: { ...person('Tecnico ' + NAMES[i]), skill: crew },
        aero: { ...person('Aerodinamico ' + NAMES[i]), skill: crew },
        mechanic: { ...person('Meccanico ' + NAMES[i]), skill: crew }
      },
      engine: {
        id: `ai-${i}-pu`,
        name: NAMES[i] + ' PU',
        skill: Math.max(30, Math.min(99, engine + offset)),
        salary: 0
      },
      aero,
      chassis,
      // Placeholder plan; replaced by a ready-made one at every race start.
      strategies: [0, 1].map(() => ({
        wing: 50,
        brake: 56,
        compound: 'medium',
        pitLap: 12,
        wearAt: 30,
        fuel: 65,
        refuel: 40,
        pace: 'normal'
      })),
      enrolled: false,
      // Always "at the pit wall": no offline speed penalty.
      seen: Number.MAX_SAFE_INTEGER
    };
    // Kept apart from participants: those are the people who approved the calendar.
    (s.schedule.ai ??= []).push(id);
  }
  return need;
}
export function removeAiTeams(s) {
  for (const t of Object.values(s.teams)) if (isAi(t)) delete s.teams[t.id];
}
