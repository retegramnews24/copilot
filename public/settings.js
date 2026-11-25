// Settings page: a grouped list (profile, notifications, appearance, games and help) with sub-pages for
// Aspetto (theme preview, swatches, text size) and the character; developer mode, problem report.
import { pref, setPref } from './prefs.js?v=bd123656a4';
import { isTouchDevice } from './touch-device.js';
import { pieceSvg } from './pieces.js?v=fa35e21be7';
import { HELP, helpList } from './lobby3d/help.js?v=d35882a376';
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
    renderValues();
  };
  // Text size as three pills; the (hidden) select stays the source of truth.
  document.querySelectorAll('[data-text-size]').forEach(button => {
    button.onclick = () => {
      $('setting-text').value = button.dataset.textSize;
      $('setting-text').dispatchEvent(new Event('change'));
    };
  });
  applyPreferences();

  // Comandi della Lobby 3D: le stesse righe del tasto «?» nella 3D (help.js), tutte le attività, per questo
  // dispositivo; un tasto mostra quelle dell'altro (telefono o computer)
  const helpBox = document.querySelector('.lobby3d-help');
  if (helpBox) {
    let onTouch = isTouchDevice();
    const renderHelp = () => {
      const other = document.createElement('button');
      other.type = 'button';
      other.className = 'alt';
      other.textContent = onTouch ? 'Mostra i comandi del computer' : 'Mostra i comandi del telefono';
      other.onclick = () => {
        onTouch = !onTouch;
        renderHelp();
      };
      const parts = [];
      for (const h of HELP) {
        const title = document.createElement('h4');
        title.textContent = h.title;
        parts.push(title, helpList(onTouch ? h.touch : h.pc));
      }
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent =
        (onTouch ? 'Comandi del telefono.' : 'Comandi del computer.') +
        ' Nella Lobby 3D il tasto ? mostra quelli di quello che stai facendo.';
      helpBox.replaceChildren(note, ...parts, other);
    };
    renderHelp();
  }

  // Settings as a grouped list (like Telegram's): rows open sub-pages, each with "‹ Settings" to go back.
  const subPages = ['settings-look', 'settings-character'];
  function showSub(id, focus) {
    $('settings-main').hidden = !!id;
    for (const sub of subPages) $(sub).hidden = sub !== id;
    const page = $('page-settings');
    if (focus) $(focus)?.scrollIntoView({ block: 'start' });
    else page.scrollTop = 0;
    if (id === 'settings-look') renderThemePreview();
  }
  document.querySelectorAll('[data-settings-open]').forEach(button => {
    button.onclick = () => showSub(button.dataset.settingsOpen, button.dataset.settingsFocus);
  });
  document.querySelectorAll('.settings-back').forEach(button => (button.onclick = () => showSub(null)));
  // Leaving the Settings tab and coming back starts again from the list.
  $('tab-settings')?.addEventListener('click', () => showSub(null));
  // Current choice shown on the right of each row.
  const chosen = selector =>
    document.querySelector(selector + '[aria-pressed="true"]')?.textContent.trim() || '';
  function renderValues() {
    // One "Aspetto" row: theme and board shown on the right, everything else inside the sub-page.
    $('value-look').textContent =
      [chosen('[data-theme-choice]'), chosen('[data-board-choice]')].filter(Boolean).join(' · ') + ' ›';
    const size = $('setting-text').value;
    document.querySelectorAll('[data-text-size]').forEach(b => {
      const on = String(b.dataset.textSize === size);
      if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
    });
  }
  // Profile row: the same avatar and name as the Lobby header.
  function renderProfileRow() {
    const avatar = $('profile-avatar');
    if (avatar) $('settings-avatar').replaceChildren(...[...avatar.childNodes].map(n => n.cloneNode(true)));
    $('settings-name').textContent = $('name')?.textContent || 'Il tuo profilo';
  }
  // Theme, board and piece buttons mark the choice with aria-pressed (themes.js): follow it.
  new MutationObserver(renderValues).observe($('settings-look'), {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed']
  });
  for (const id of ['profile-avatar', 'name'])
    if ($(id)) new MutationObserver(renderProfileRow).observe($(id), { childList: true, subtree: true });
  renderProfileRow();
  setTimeout(renderValues, 0);
  // The version at the bottom: shows the app version; five taps toggle developer mode, as on the Info page.
  const showVersion = () => ($('settings-version').textContent = $('app-version')?.textContent || appName);
  $('settings-version').onclick = () => {
    $('app-version')?.click();
    showVersion();
  };
  showVersion();

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
