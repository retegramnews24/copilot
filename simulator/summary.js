// What a member still has to do in Binotto Simulator, for the Binottoland Lobby ("Adesso").
// Read-only: computed from the state, never saved, never marks the member as connected.
import { TRACKS } from './physics.js';
import { approvalState } from './calendar-approval.js';
import { ready } from './engine.js';

const time = at =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(
    at
  );

export function lobbySummary(s, userId, now) {
  const t = s.teams[userId],
    items = [],
    add = (rank, text) => items.push({ rank, text: 'Binotto Simulator · ' + text });
  const sch = s.schedule,
    racing = !!sch?.participants.includes(userId),
    at = sch?.dates?.[s.round],
    track = TRACKS[Math.min(s.round, 12)][0];
  if (!t) add(4, 'crea la tua scuderia e partecipa al campionato.');
  else if (!ready(t)) add(3, 'completa la scuderia: piloti, tecnici e motore.');
  else if (!sch && !t.enrolled) add(3, 'iscrivi la scuderia alla stagione.');
  else if (!sch) {
    const a = approvalState(s, userId);
    if (!s.proposals.length) add(2, 'proponi giorni e orari del calendario.');
    else if (!s.votes[userId]) add(1, 'accetta una proposta di calendario.');
    else if (!a.ready) add(1, 'conferma il calendario con Pronto!');
    else if (a.allReady && !a.started) add(0, 'tutti pronti: premi Si parte!!');
    else add(5, `in attesa degli altri iscritti (${a.readyCount}/${a.members.length} pronti).`);
  }
  if (racing && s.round < 13 && at) {
    if (s.race?.active) add(1, `gara in corso a ${TRACKS[s.race.round][0]}: segui dal muretto.`);
    else if (now >= at - 30 * 60000 && now < at - 10 * 60000)
      add(0, `qualifiche aperte a ${track}: fai uscire i piloti entro le ${time(at - 10 * 60000)}.`);
    else if (at - now < 24 * 3600000 && at > now) add(3, `prossima gara a ${track} alle ${time(at)}.`);
  }
  return {
    items,
    debrief: t?.lastDebrief ? { race: t.lastDebrief.race, track: t.lastDebrief.track } : null
  };
}
