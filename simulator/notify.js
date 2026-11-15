// Messages for the Telegram group: calendar published, qualifying open, race result.
// Pure: decides what is new and marks it, so every notice is produced at most once.
// Sending is done by simulator/server.js, only when SIMULATOR_NOTIFY is "true".
import { TRACKS } from './physics.js';
import { standings } from './championship.js';

const BOT = 'https://t.me/checkmategame_bot?startapp';
const time = at =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(
    at
  );
const day = at =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(at);

export function collectNotices(s, now) {
  s.notified ??= [];
  const done = new Set(s.notified),
    out = [];
  const once = (key, text) => {
    if (done.has(key)) return;
    done.add(key);
    s.notified.push(key);
    out.push(text);
  };
  const sch = s.schedule;
  if (sch?.acceptedAt && now - sch.acceptedAt < 6 * 3600000)
    once(
      `calendar:${s.season}`,
      `🏁 Binotto Simulator · stagione ${s.season}\nCalendario pubblicato: 13 Gran Premi, si parte ${day(sch.dates[0])} alle ${time(sch.dates[0])} con ${TRACKS[0][0]}.\n${BOT}`
    );
  // Qualifying window: from 30 to 10 minutes before the race.
  const at = sch?.dates?.[s.round];
  if (sch && s.round < 13 && at && now >= at - 30 * 60000 && now < at && !s.race?.active)
    once(
      `qualifying:${s.season}:${s.round}`,
      `⏱ Qualifiche aperte · ${TRACKS[s.round][0]}\nFate uscire i piloti dal muretto entro le ${time(at - 10 * 60000)}. Partenza alle ${time(at)}.\n${BOT}`
    );
  const last = s.results?.[0];
  if (last && last.season === s.season && now - last.at < 6 * 3600000) {
    const podium = last.rows.filter(r => !r.dnf).slice(0, 3);
    const table = standings(s, false)
      .teams?.slice(0, 3)
      .map((t, i) => `${i + 1}. ${t.name} ${t.points}`)
      .join(' · ');
    once(
      `result:${last.id}`,
      `🏆 ${TRACKS[last.round][0]} · ordine d’arrivo\n` +
        podium.map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${r.name} (${r.teamName})`).join('\n') +
        (table ? `\nCostruttori: ${table}` : '') +
        `\nIl resoconto della tua gara è nel simulatore.\n${BOT}`
    );
  }
  s.notified = s.notified.slice(-60);
  return out;
}
