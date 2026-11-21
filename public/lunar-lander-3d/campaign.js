export const missions = [
  { name: 'Piana Alpha', notes: 'Prendi confidenza con la spinta e il livellamento automatico.',
    padX: 0, pad: 7, down: 3.5, sideways: 2.4, tilt: 14, x: -21, y: 38, vx: 1.8, vy: -3, fuel: 100, light: 3 },
  { name: 'Crinale Bravo', notes: 'Inizia più in alto e avvicinati da destra.',
    padX: -30, pad: 6, down: 3, sideways: 2, tilt: 12, x: 2, y: 54, vx: -2.6, vy: -3.6, fuel: 90, light: 2.8 },
  { name: 'Bacino Kepler', notes: 'Correggi la deriva laterale prima della discesa finale.',
    padX: 35, pad: 5, down: 2.8, sideways: 1.8, tilt: 11, x: -3, y: 61, vx: 4.5, vy: -4, fuel: 82, light: 2.6 },
  { name: 'Ombra di Selene', notes: 'Con la luce radente, usa l’anello e la telemetria per orientarti.',
    padX: 77, pad: 4.3, down: 2.5, sideways: 1.6, tilt: 10, x: 110, y: 65, vx: -2.7, vy: -5, fuel: 76, light: 1.8 },
  { name: 'Avamposto Zenith', notes: 'Piattaforma stretta, discesa rapida e riserva ridotta.',
    padX: -72, pad: 3.6, down: 2.2, sideways: 1.4, tilt: 8, x: -109, y: 71, vx: 3.4, vy: -6, fuel: 70, light: 2.1 },
];

export function landingScore(flight, mission) {
  const approach = 1 - (
    Math.abs(flight.x - mission.padX) / mission.pad +
    Math.abs(flight.vy) / mission.down +
    Math.abs(flight.vx) / mission.sideways +
    Math.abs(flight.angle * 180 / Math.PI) / mission.tilt
  ) / 4;
  return Math.round(1000 * (0.75 * approach + 0.25 * flight.fuel / mission.fuel));
}

export function loadRecords(storage) {
  try {
    const saved = JSON.parse(storage().getItem('binottoland.lunar-lander.records.v1'));
    if (Array.isArray(saved)) {
      const valid = [];
      for (const score of saved.slice(0, missions.length)) {
        if (!Number.isInteger(score) || score < 0 || score > 1000) break;
        valid.push(score);
      }
      return valid;
    }
  } catch {
    // Storage can be unavailable when the preview is opened from a file.
  }
  return [];
}

export function saveRecords(storage, records) {
  try {
    storage().setItem('binottoland.lunar-lander.records.v1', JSON.stringify(records));
  } catch {
    // Progress remains available for the current session.
  }
}
