// Settings page: preferences (sound, vibration, text size), theme preview, developer mode, problem report.
import { pref, setPref } from './prefs.js?v=bd123656a4';
import { pieceSvg } from './pieces.js?v=fa35e21be7';
const $ = id => document.getElementById(id);

export function initSettings({ appName, tg, trace, events }) {
  function applyPreferences() {
    $('setting-sound').checked = pref('binottoland-sound', 'on') !== 'off';
    $('setting-haptics').checked = pref('binottoland-haptics', 'on') !== 'off';
    const scale = ['1', '1.12', '1.25'].includes(pref('binottoland-text', '1'))
      ? pref('binottoland-text', '1')
      : '1';
    $('setting-text').value = scale;
    document.documentElement.style.zoom = scale === '1' ? '' : scale;
  }
  $('setting-sound').onchange = e => {
    setPref('binottoland-sound', e.target.checked ? 'on' : 'off');
    trace('UI', 'Suoni ' + (e.target.checked ? 'attivi' : 'spenti'));
  };
  $('setting-haptics').onchange = e => {
    setPref('binottoland-haptics', e.target.checked ? 'on' : 'off');
    if (e.target.checked) tg?.HapticFeedback?.impactOccurred?.('light');
  };
  $('setting-text').onchange = e => {
    setPref('binottoland-text', e.target.value);
    applyPreferences();
  };
  applyPreferences();

  function renderThemePreview() {
    const pieces = ['r', 'n', 'q', 'k', 'P', 'P', 'B', 'K'];
    $('theme-preview').replaceChildren(
      ...pieces.map((piece, i) => {
        const sq = document.createElement('span');
        sq.className = 'square' + ((Math.floor(i / 4) + i) % 2 ? ' dark' : '');
        sq.innerHTML = pieceSvg(piece);
        return sq;
      })
    );
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-theme-choice],[data-board-choice],[data-piece-choice]')) renderThemePreview();
  });

  // Developer mode: five taps on the version shows the Debug page and developer shortcuts.
  const isDev = () => pref('binottoland-dev', '0') === '1';
  function applyDevMode() {
    $('open-debug').hidden = !isDev();
    if ($('solo-labyrinth')) $('solo-labyrinth').hidden = !isDev();
  }
  applyDevMode();
  let versionTaps = 0,
    versionTimer = null;
  $('app-version').onclick = () => {
    versionTaps++;
    clearTimeout(versionTimer);
    versionTimer = setTimeout(() => (versionTaps = 0), 1500);
    if (versionTaps < 5) return;
    versionTaps = 0;
    setPref('binottoland-dev', isDev() ? '0' : '1');
    applyDevMode();
    $('app-version').textContent = appName + (isDev() ? ' · modalità sviluppatore' : '');
  };

  // Problem report: the recent log, copied and shared through Telegram to whoever the user picks.
  $('report-problem').onclick = async () => {
    const report = [
      'Segnalazione ' + appName,
      new Date().toLocaleString('it-IT'),
      'Pagina: ' + (document.querySelector('.page:not([hidden])')?.id || '—'),
      'Schermo: ' + innerWidth + '×' + innerHeight + ' · ' + (tg?.platform || 'browser'),
      '',
      ...events.slice(-40)
    ].join('\n');
    let copied = false;
    try {
      await navigator.clipboard.writeText(report);
      copied = true;
    } catch {}
    const link =
      'https://t.me/share/url?url=' +
      encodeURIComponent('https://t.me/checkmategame_bot?startapp') +
      '&text=' +
      encodeURIComponent(report.slice(0, 1500));
    if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else window.open(link, '_blank', 'noopener');
    $('report-result').textContent =
      (copied ? 'Registro copiato. ' : '') +
      'Scegli in Telegram a chi inviarlo (per esempio un amministratore del gruppo).';
  };
  return { renderThemePreview, isDev };
}
