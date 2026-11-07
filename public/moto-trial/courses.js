// Each row specifies a ramp profile, gap width, landing height change, drop and receiving ledge and optional short runout.
export const FIXED_COURSES = [
  {name: 'Gole d’Ambra', theme: 0, detail: 'Rampe spezzate e un tornante sul vuoto.', rows: [
    ['roll', 8.4, 1.5, 8.5, 24], ['dip', 9.6, .7, 10.5, 23], ['step', 10.1, .4, 9, 26], ['wall', 10.7, .8, 11, 24], ['roll', 10.9, .4]]},
  {name: 'La Diga', theme: 1, detail: 'Balzi tra argini e discese strette.', rows: [
    ['step', 9.3, 1.1, 11.5, 23], ['wall', 10.6, .7, 9.5, 22], ['dip', 10, .6, 11.5, 24], ['wall', 11.4, .2, 10.5, 23, 7], ['step', 10.8, .1, 9, 25], ['dip', 11.8, .6]]},
  {name: 'Denti di Drago', theme: 2, detail: 'Creste a dente e atterraggi in salita.', rows: [
    ['tooth', 8.8, 1.1, 10, 24], ['tooth', 10.5, -.15, 9.5, 24], ['wall', 11, .25, 10.5, 23], ['tooth', 11.6, -.2, 10, 24, 7], ['step', 10.7, -.2]]},
  {name: 'Cava di Vetro', theme: 3, detail: 'Pianerottoli corti e rampe dal fondo della cava.', rows: [
    ['dip', 9.7, .9, 8, 21], ['wall', 10.7, .6, 10.5, 22], ['step', 10.3, .4, 8.5, 22], ['dip', 11.7, .2, 11.5, 23], ['wall', 11.1, .0, 9.5, 22, 7], ['tooth', 11.6, -.1]]},
  {name: 'Ago di Lava', theme: 4, detail: 'Labbri ripidi, vuoti larghi e pochi metri per frenare.', rows: [
    ['wall', 10, .8, 10.5, 23], ['tooth', 11.4, .2, 11.5, 23], ['dip', 11.8, .5, 10, 22], ['wall', 12.5, .5, 12, 23, 6.8], ['step', 11.7, .2, 10, 23], ['wall', 12.1, .25]]},
  {name: 'Bosco Pensile', theme: 5, detail: 'Una sequenza fitta di salite corte e lanci sfalsati.', rows: [
    ['roll', 9.2, 1.1, 8, 23], ['step', 10.5, .5, 9, 22], ['roll', 10.1, -.2, 9, 24, 7], ['dip', 11.5, .6, 10, 22], ['tooth', 11.9, .2, 9, 23], ['step', 11, .2, 9, 22], ['dip', 12.3, .7]]},
  {name: 'Ruggine', theme: 6, detail: 'Rampe industriali, arrivi alti e inversioni secche.', rows: [
    ['step', 10, .6, 9, 22], ['wall', 11.4, .1, 10, 22], ['step', 11.5, -.25, 10.5, 23], ['wall', 12.6, .35, 10, 22, 6.8], ['tooth', 12.2, -.2, 10, 22], ['step', 12.3, -.15]]},
  {name: 'Sottozero', theme: 7, detail: 'Guglie, gradoni alti e avvallamenti subito dopo il salto.', rows: [
    ['tooth', 9.5, .5, 9, 23], ['dip', 10.9, .1, 10, 22], ['wall', 11.6, -.2, 9.5, 22], ['tooth', 12, -.1, 10, 22], ['dip', 12.6, .2, 10, 22, 6.8], ['wall', 12, -.25, 10, 22], ['tooth', 12.5, .1]]},
  {name: 'Pozzo Lunare', theme: 8, detail: 'Lanci lunghi sopra una catena di pozzi sfalsati.', rows: [
    ['dip', 10.5, .6, 11, 23], ['wall', 12.1, .2, 10, 23], ['tooth', 12.4, -.1, 11, 23], ['wall', 12.8, .3, 11, 22, 6.8], ['step', 11.8, -.25, 10, 22], ['dip', 12.8, .2, 10.5, 23], ['wall', 13.1, .4]]},
  {name: 'L’Ultima Cresta', theme: 9, detail: 'Otto rampe in successione con appoggi e arrivi stretti.', rows: [
    ['step', 10.6, .4, 9, 22], ['wall', 12, .0, 10, 22], ['tooth', 12, -.25, 9, 22], ['dip', 12.5, .1, 10, 22, 6.7], ['wall', 12.9, .15, 10, 22, 6.6], ['tooth', 12.2, -.25, 10, 22], ['step', 12.5, -.2, 10, 22], ['wall', 13.2, .45]]}
];

const PROFILES = {
  roll: {before: [1.15, -.15], rise: 4, ramp: 8, launch: .67, exit: [1.1, 1.5]},
  dip: {before: [-.6, 1.25], rise: 4.4, ramp: 8.5, launch: .70, exit: [1.15, .55]},
  step: {before: [.2, -.95], rise: 4.5, ramp: 8.5, launch: .70, exit: [-.4, .85]},
  tooth: {before: [-.85, .45], rise: 4.8, ramp: 8.5, launch: .73, exit: [.5, 1.2]},
  wall: {before: [1.0, .4], rise: 5.4, ramp: 9, launch: .76, exit: [.3, 1.5]}
};

export function fixedCourse(id) {
  const track = FIXED_COURSES[id - 1];
  if (!track) throw RangeError('Circuito non valido.');
  let start = 0, base = 0, overlap = 0;
  const tiers = track.rows.map(([style, gap, landingDelta, drop, nextOverlap, shelf], i) => {
    const profile = PROFILES[style], direction = i % 2 ? -1 : 1;
    const approach = i ? overlap + 3 : 19;
    const lip = approach + profile.ramp, landing = lip + gap;
    const lipY = base + profile.before[1] - profile.rise, landingY = lipY + landingDelta;
    const last = i === track.rows.length - 1;
    const end = landing + (shelf ?? (last ? 22 : 19.5));
    const x = s => start + direction * s;
    const points = [
      [0, base], [approach - 10, base], [approach - 5, base + profile.before[0]],
      [approach, base + profile.before[1]], [approach + 2.4, base + profile.before[1] - .65],
      [lip, lipY], [landing, landingY], ...(shelf ?
        [[landing + 2.5, landingY + .15], [end, landingY + .4]] :
        [[landing + 4, landingY + .35], [landing + 10, landingY + profile.exit[0]],
          [landing + 16, landingY + profile.exit[1]], [end, landingY + profile.exit[1] + (last ? 0 : .25)]])
    ].map(([s, y]) => ({x: x(s), y}));
    if (direction < 0) points.reverse();
    points.find(p => p.x === x(direction > 0 ? lip : landing)).gapAfter = true;
    const tier = {start, end: x(end), direction, points, marker: x(i ? Math.max(3, overlap - 6) : 4),
      top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)),
      jump: {approach: x(approach), lip: x(lip), landing: x(landing), launch: profile.launch, short: !!shelf},
      precisionDrop: !!drop && nextOverlap <= 24};
    if (!last) {
      start = tier.end + direction * nextOverlap;
      // Put the receiving ledge below the exit while keeping the overlapping courses separated.
      base = Math.max(points[direction > 0 ? points.length - 1 : 0].y + drop, tier.bottom + 7.6);
      overlap = nextOverlap;
    }
    return tier;
  });
  const last = tiers.at(-1);
  return {id, seed: id, version: 5, name: track.name, detail: track.detail, theme: track.theme, tiers,
    finish: last.end - last.direction * 5, bottom: last.bottom + 15};
}
