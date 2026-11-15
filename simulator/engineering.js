import { metrics, estimate, weatherAt, PROFILES } from './physics.js';
const cache = new Map();
function projection(c, round, laps, season) {
  const key = JSON.stringify([c, round, laps, season]);
  if (cache.has(key)) return cache.get(key);
  const value = estimate(c, round, laps, season);
  if (cache.size > 600) cache.clear();
  cache.set(key, value);
  return value;
}
// Ready-made race plans: same model as the race, checked by a full simulation.
const PRESETS = [
  {
    key: 'safe',
    name: 'Prudente',
    text: 'Ritmo Conserva, gomme dure, una sosta e più benzina di scorta. Difficile restare a secco.',
    pace: 'save',
    stops: 1,
    dry: ['hard', 'medium'],
    wearAt: 40,
    margin: 4
  },
  {
    key: 'balanced',
    name: 'Bilanciata',
    text: 'Il consiglio dei tecnici: ritmo Normale, una sosta, Medium poi Hard.',
    pace: 'normal',
    stops: 1,
    dry: ['medium', 'hard'],
    wearAt: 30,
    margin: 3
  },
  {
    key: 'attack',
    name: 'Aggressiva',
    text: 'Ritmo Spingi, gomme morbide e due soste: più veloce, ma consuma molto.',
    pace: 'push',
    stops: 2,
    dry: ['soft', 'soft', 'medium'],
    wearAt: 20,
    margin: 2
  }
];
const tyreFor = (water, dry) => (water > 0.55 ? 'wet' : water > 0.18 ? 'inter' : dry);
function presets(c, track, round, laps, season, raceSeconds) {
  const clampFuel = kg => Math.max(10, Math.min(110, Math.ceil(kg)));
  const startWater = weatherAt(round, 0, season).water;
  return PRESETS.map(p => {
    const n = p.stops,
      stopLaps = Array.from({ length: n }, (_, i) => Math.max(1, Math.round((laps * (i + 1)) / (n + 1)))),
      starts = [0, ...stopLaps],
      // Tyre for each stint follows the forecast at the moment the stint starts.
      compounds = starts.map((lap, i) =>
        tyreFor(weatherAt(round, (lap / laps) * raceSeconds, season).water, p.dry[i])
      ),
      wing = Math.round(Math.max(0, Math.min(100, track[2] + startWater * 12))),
      brake = Math.max(45, Math.min(65, track[3]));
    let plan, result;
    for (let extra = 0; extra <= 9; extra += 3) {
      const perLap = metrics(
        { ...c, compound: compounds[0], strategy: { ...c.strategy, wing, brake, pace: p.pace } },
        track,
        weatherAt(round, 0, season)
      ).consumption;
      const stint = i => (i < n ? stopLaps[i] : laps) - starts[i];
      const stops = stopLaps.map((lap, i) => ({
        lap,
        compound: compounds[i + 1],
        refuel: Math.min(110, clampFuel(perLap * stint(i + 1) + p.margin + extra))
      }));
      plan = {
        wing,
        brake,
        compound: compounds[0],
        pace: p.pace,
        pitLap: stops[0].lap,
        wearAt: p.wearAt,
        fuel: clampFuel(perLap * stint(0) + p.margin + extra),
        refuel: stops[0].refuel,
        stops
      };
      result = projection(
        { ...c, fuel: plan.fuel, compound: plan.compound, strategy: plan },
        round,
        laps,
        season
      );
      if (!result.dnf) break;
    }
    return {
      key: p.key,
      name: p.name,
      text: p.text,
      strategy: plan,
      minutes: result.seconds / 60,
      stops: result.stops,
      finishFuel: result.finishFuel,
      dnf: result.dnf
    };
  });
}
export function engineering(s, t, tracks, deltaFn, laps) {
  if (!t) return null;
  const round = Math.min(s.round, 12),
    track = tracks[round],
    weather = weatherAt(round, 0, s.season),
    p = s.sessions?.practice[t.id];
  return {
    laps,
    distance: track[1] * laps,
    maxMinutes: 70,
    forecast: weather.forecast,
    drivers: t.drivers.map((d, slot) => {
      if (!d || !t.engine || Object.values(t.crew).some(x => !x)) return null;
      const plan = t.strategies[slot],
        history =
          (p?.key === s.season + ':' + s.round ? p.cars.find(c => c.slot === slot)?.history : []) || [];
      const c = {
        id: t.id + ':' + slot,
        progress: 0,
        skill: d.skill,
        consistency: d.consistency,
        tyres: d.tyres,
        engine: t.engine.skill,
        motor: t.crew.motor.skill,
        mechanic: t.crew.mechanic.skill,
        aerodynamic: t.crew.aero.skill,
        aero: t.aero,
        chassis: t.chassis,
        fuel: plan.fuel,
        wear: 100,
        compound: plan.compound,
        strategy: plan
      };
      const m = metrics(c, track, weather),
        sim = projection(c, round, laps, s.season),
        tyreStint = Math.max(1, Math.floor((100 - plan.wearAt) / m.wearPerLap));
      const alternatives = [1, 2].map(n => {
        const v = structuredClone(c);
        v.strategy.stops = Array.from({ length: n }, (_, i) => ({
          lap: Math.round((laps * (i + 1)) / (n + 1)),
          compound: i === n - 1 ? 'medium' : 'soft',
          refuel: Math.max(0, Math.ceil((m.consumption * laps) / (n + 1) + 2))
        }));
        v.fuel = Math.ceil((m.consumption * laps) / (n + 1) + 2);
        const result = projection(v, round, laps, s.season);
        return {
          label: n + ' sost' + (n === 1 ? 'a' : 'e') + ' · carburante distribuito',
          ...result
        };
      });
      const error = Math.max(2, Math.ceil((100 - t.crew.aero.skill) / 8 / Math.sqrt(history.length + 1)));
      return {
        name: d.name,
        consumption: m.consumption,
        wearPerLap: m.wearPerLap,
        measured: history.filter(h => h.consumption).slice(0, 8),
        practiceLaps: history.length,
        lapEstimate: m.lap,
        raceMinutes: sim.seconds / 60,
        fuelNeeded: sim.fuelNeeded,
        fuelRange: Math.floor(plan.fuel / m.consumption),
        tyreStint,
        stops: sim.stops,
        finishFuel: sim.finishFuel,
        dnf: sim.dnf,
        alternatives,
        presets: presets(c, track, round, laps, s.season, m.lap * laps),
        uncertainty: Math.max(
          0.015,
          (0.1 + (100 - t.crew.motor.skill) / 1000) / Math.sqrt(history.length + 1)
        ),
        confidence: history.length >= 6 ? 'Media: verificata nelle libere' : 'Bassa: dati preliminari',
        advice: [
          {
            role: 'Aerodinamica',
            name: t.crew.aero.name,
            text: `Carico da confrontare: ${Math.max(0, track[2] - error)}–${Math.min(100, track[2] + error)}. Più carico favorisce le curve e aumenta resistenza e consumo. Confronta giri con carburante e gomme simili.`
          },
          {
            role: 'Capo meccanico',
            name: t.crew.mechanic.name,
            text: `Freno anteriore indicativo ${track[3] - 2}–${track[3] + 2}%. Stint iniziale circa ${tyreStint} giri: temperatura, peso e ritmo possono accorciarlo. Transito box circa ${PROFILES[round].pitLoss} s, più servizio e attesa compagno.`
          },
          {
            role: 'Motorista',
            name: t.crew.motor.name,
            text: `Consumo iniziale ${m.consumption.toFixed(2)} kg/giro. Qualifica: circa ${Math.max(10, Math.ceil(m.consumption * 4 + 2))} kg per uscita, due giri lanciati e rientro. Rifornimento: 3,5 kg/s, in parallelo al cambio gomme.`
          },
          {
            role: 'Strategia',
            text: sim.dnf
              ? 'Il piano simulato non raggiunge il traguardo: verifica carburante e soste.'
              : `${weather.forecast}. Arrivo stimato con ${sim.finishFuel.toFixed(1)} kg; ${sim.stops} soste incluse quelle di sicurezza. Stima senza traffico né penalità offline.`
          }
        ]
      };
    })
  };
}
