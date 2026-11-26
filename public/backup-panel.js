// Impostazioni → Backup: solo per il proprietario (il server risponde 404 a tutti gli altri e la sezione resta
// nascosta). «Fai un backup adesso»: il bot manda il file in privato al proprietario. Sotto, le ultime copie salvate
// su Cloudflare: «Manda» la rimanda in chat, «Ripristina» rimette tutto com'era (dopo una conferma).
const $ = id => document.getElementById(id);

// request(path, data?) is the app's authenticated fetch (GET without data, POST with data).
export function initBackupPanel({ tg, request }) {
  const section = $('backup-section');
  if (!section) return { refresh: async () => {} };
  let busy = false;
  const say = text => ($('backup-result').textContent = text);
  const kb = n => Math.max(1, Math.round(n / 1024)) + ' KB';
  const when = at =>
    new Date(at).toLocaleString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  const ask = text =>
    tg?.showConfirm
      ? new Promise(resolve => {
          try {
            tg.showConfirm(text, ok => resolve(!!ok));
          } catch {
            resolve(confirm(text));
          }
        })
      : Promise.resolve(confirm(text));

  async function act(work, waiting) {
    if (busy) return;
    busy = true;
    say(waiting);
    try {
      say(await work());
    } catch (error) {
      say('Non è andata: ' + error.message);
    } finally {
      busy = false;
    }
    await refresh(false);
  }
  function render(list) {
    const rows = list.map(item => {
      const row = document.createElement('div');
      row.className = 'backup-item';
      const label = document.createElement('span');
      label.textContent = when(item.at) + ' · ' + item.objects + ' archivi · ' + kb(item.size);
      const send = document.createElement('button');
      send.type = 'button';
      send.className = 'alt';
      send.textContent = 'Manda';
      send.onclick = () =>
        act(async () => {
          const r = await request('/api/backup/' + item.id + '/send', {});
          return r.sent ? 'Il bot ti ha mandato la copia in chat.' : 'Il bot non è riuscito a mandarla.';
        }, 'Invio in corso…');
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'alt danger';
      restore.textContent = 'Ripristina';
      restore.onclick = async () => {
        const ok = await ask(
          "Rimettere tutto com'era il " +
            when(item.at) +
            '? Partite, chat e classifiche cambiate dopo quel momento andranno perse.'
        );
        if (ok)
          act(async () => {
            const r = await request('/api/backup/' + item.id + '/restore', {});
            return (
              'Ripristinati ' + r.restored.length + " archivi. Riapri l'app per vedere i dati di allora."
            );
          }, 'Ripristino in corso…');
      };
      const buttons = document.createElement('span');
      buttons.className = 'backup-buttons';
      buttons.append(send, restore);
      row.append(label, buttons);
      return row;
    });
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Nessuna copia salvata ancora.';
      rows.push(empty);
    }
    $('backup-list').replaceChildren(...rows);
  }
  // Reads the list; a 404 means "not the owner": the section stays hidden.
  async function refresh(clear = true) {
    try {
      const list = await request('/api/backup');
      section.hidden = false;
      if (clear && !busy) say('');
      render(list);
    } catch {
      section.hidden = true;
    }
  }
  $('backup-run').onclick = () =>
    act(async () => {
      const r = await request('/api/backup/run', {});
      return (
        'Backup fatto: ' +
        r.objects +
        ' archivi, ' +
        kb(r.size) +
        '. ' +
        (r.sent
          ? "Il bot te l'ha mandato in chat."
          : 'Il bot non è riuscito a mandarlo: la copia è salvata qui sotto.')
      );
    }, 'Backup in corso…');
  return { refresh };
}
