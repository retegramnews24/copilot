// Tetto ai collegamenti in diretta per persona (Lobby, tavoli, Cinema, lavagna). Il tetto totale di ogni oggetto
// (120 Lobby, 60 tavolo, 120 Cinema) da solo lasciava che una persona li occupasse tutti e nessun altro entrasse.
// Quando la stessa persona apre un collegamento in più, si chiude il suo più vecchio dello stesso tipo: così anche
// chi si ricollega dopo un intoppo di rete (con quello vecchio ancora "appeso") entra sempre.
export const PER_PERSON = 3;

// identità del collegamento: numero Telegram, comunque sia salvato (memberId, "tg:123", user.id)
export function socketPerson(a) {
  const id =
    a?.memberId ?? a?.user?.id ?? (typeof a?.player === 'string' ? a.player.replace(/^tg:/, '') : null);
  return id == null ? null : String(id);
}

// prima di accettare un nuovo collegamento di "person" (di tipo "kind", o senza tipo per i tavoli)
export function makeRoomFor(ctx, person, kind = null, limit = PER_PERSON) {
  if (person == null) return;
  const mine = ctx.getWebSockets().filter(ws => {
    try {
      const a = ws.deserializeAttachment();
      return !a?.closed && !a?.authDenied && (a?.kind ?? null) === kind && socketPerson(a) === String(person);
    } catch {
      return false;
    }
  });
  for (const ws of mine.slice(0, Math.max(0, mine.length - limit + 1)))
    try {
      ws.serializeAttachment({ ...ws.deserializeAttachment(), closed: true }); // già fuori dal conto
      ws.close(4008, 'Aperta da un altro collegamento');
    } catch {}
}
