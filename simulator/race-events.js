// One independent 2% draw per type, car and GP. Persist the draws with the race.
export const INCIDENT_RATE = .02;
export function incidentPlan(random, laps) {
  return ['damage', 'puncture', 'accident'].map(type => {
    const occurs = random() < INCIDENT_RATE;
    const progress = .25 + random() * Math.max(.1, laps - .5);
    return {type, progress, occurs, applied:false};
  });
}
export function applyIncidents(car, race, now) {
  if (car.finished || car.dnf || car.pitTime > 0) return;
  for (const item of car.incidents || []) {
    if (!item.occurs || item.applied || car.progress < item.progress) continue;
    item.applied = true;
    let text;
    if (item.type === 'accident') {
      car.dnf = true; car.dnfReason = 'Incidente'; car.speed = 0;
      text = 'incidente, vettura ritirata';
    } else if (item.type === 'puncture') {
      car.puncture = true; car.wear = Math.min(car.wear, 2); car.pitRequested = true;
      text = 'foratura, rientro richiesto';
    } else {
      car.damage = true; car.pitRequested = true;
      text = 'danno aerodinamico, riparazione al prossimo pit';
    }
    race.events.unshift({text:car.name+' · '+text, at:now});
    if (car.dnf) break;
  }
  race.events = race.events.slice(0,20);
}
// A full level costs 300 XP: four normal races (75), or three attended races (100).
// Legacy XP stays intact. A race counts as attended with >= half its elapsed time online.
export function progressionReward(race, teamId) {
  const total = Math.max(1,(race.ended-race.start)/1000);
  const attended = (race.onlineSeconds?.[teamId] || 0) >= total*.5;
  return {xp:attended?100:75, attended};
}
