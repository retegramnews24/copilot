import { installCockpit } from './cockpit.js?v=13';
import { attachCanvas, draw, resetCamera, getCamera, setCamera } from './renderer.js';
import { installPanelLayouts, saveView, readView, replacePanelContent } from './layout.js?v=12';
const $ = id => document.getElementById(id),
  esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
const money = n =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    n || 0
  );
const date = n =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(n);
const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
  roles = {
    driver: 'Pilota',
    motor: 'Motorista',
    aero: 'Ingegnere aerodinamico',
    mechanic: 'Capo meccanico',
    engine: 'Power unit'
  },
  compounds = { soft: 'Soft', medium: 'Medium', hard: 'Hard', inter: 'Intermedie', wet: 'Wet' };
let renderedRaceKey = '',
  lastMarketStamp = '';
const raceKey = r => (r ? String(r.id) + ':' + r.active : '');
const marketStamp = () =>
  data?.me
    ? data.me.xp +
      ':' +
      data.marketRefresh +
      ':' +
      !!data.race?.active +
      ':' +
      data.market.map(o => o.id + o.sold).join('|')
    : '';
let token = '',
  data = null,
  tab = 'Paddock',
  marketRole = 'driver',
  follow = null,
  followCamera = false,
  received = 0,
  polling = false,
  busy = false,
  opened = false,
  identityDirty = false;
const lastView = readView();
if (['Telemetria', 'Strategia'].includes(lastView.tab)) lastView.tab = 'Box';
if (['Scuderia', 'Mercato'].includes(lastView.tab)) lastView.tab = 'Team';
if (['Paddock', 'Team', 'Evento', 'Campionato', 'Box', 'Libere', 'Qualifiche', 'Gara'].includes(lastView.tab))
  tab = lastView.tab;
follow = typeof lastView.follow === 'string' ? lastView.follow : null;
followCamera = lastView.followCamera === true;
if (lastView.layoutVersion === 3) setCamera(lastView.camera);
else resetCamera();
let disposePanels = () => {},
  disposeCockpit = () => {};
function persistView() {
  saveView({ tab, follow, followCamera, camera: getCamera(), layoutVersion: 3 });
}
const started = performance.now();
function toast(message) {
  $('toast').textContent = message;
  $('toast').style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => ($('toast').style.display = 'none'), 4500);
}
function salary(t) {
  return [...t.drivers, ...Object.values(t.crew)].reduce((n, d) => n + (d?.salary || 0), 0);
}
function ready(t) {
  return !!t && t.drivers.every(Boolean) && Object.values(t.crew).every(Boolean) && !!t.engine;
}
function options(values, selected) {
  return Object.entries(values)
    .map(([v, label]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${esc(label)}</option>`)
    .join('');
}
function button(action, label, extra = '', cls = '') {
  return `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
}
async function api(body, { keepalive = false } = {}) {
  if (!token) throw Error('Apri Binotto Simulator da Binottoland.');
  const r = await fetch('/api/simulator/' + (body ? 'action' : 'state'), {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    keepalive,
    signal: AbortSignal.timeout(15000)
  });
  const result = await r.json();
  if (!r.ok) {
    if (r.status === 401) {
      token = '';
      parent.postMessage({ type: 'simulator:ready' }, location.origin);
    }
    throw Error(result.error || 'Connessione interrotta.');
  }
  return result;
}
function accept(next) {
  if (data && next.revision < data.revision) return false;
  data = next;
  loadAutoDrafts();
  received = performance.now();
  $('sync').textContent = '● ONLINE';
  $('sync').style.color = 'var(--teal)';
  if (tab === 'Gara' && (!follow || !data.race?.cars.some(c => c.id === follow)))
    follow = data.race?.cars.find(c => c.own)?.id || data.race?.cars[0]?.id;
  updateHeader();
}
let chatSending = false,
  chatPending = null;
const chatKey = () => 'simulator-chat-draft:' + (data?.viewer?.id || data?.me?.id);
function saveChatDraft(value) {
  if (!data?.viewer?.id && !data?.me) return;
  try {
    localStorage.setItem(chatKey(), value);
  } catch {}
}
function restoreChatDraft() {
  const input = document.querySelector('[data-form=chat] input');
  if (input && (data?.viewer?.id || data?.me))
    try {
      input.value = localStorage.getItem(chatKey()) || '';
    } catch {}
}
const drafts = new Map();
let commandTail = Promise.resolve(),
  pendingCommands = 0;
const formKey = f =>
  f.dataset.form +
  ':' +
  (f.dataset.form === 'session-setup' ? f.dataset.mode + ':' + f.dataset.event + ':' : '') +
  (f.dataset.slot || '');
function rememberDraft(f) {
  if (f.dataset.form === 'chat') {
    saveChatDraft(f.elements.text.value);
    return;
  }
  if (!['identity', 'strategy', 'proposal', 'live', 'session-setup'].includes(f.dataset.form)) return;
  drafts.set(
    formKey(f),
    Array.from(f.elements)
      .filter(el => el.name)
      .map(el => ({ name: el.name, value: el.value, checked: el.checked, type: el.type }))
  );
  if (f.dataset.form === 'identity') identityDirty = true;
  formNotice(
    f,
    f.dataset.form === 'proposal' ? 'Bozza conservata; pubblica per condividerla.' : 'Salvataggio automatico…'
  );
  queueAutoSave(f);
  persistAutoDrafts();
}
function formNotice(f, message) {
  if (!f?.isConnected) return;
  let out = f.querySelector('[data-save-status]');
  if (!out) {
    out = document.createElement('output');
    out.dataset.saveStatus = '';
    out.setAttribute('role', 'status');
    out.style.cssText = 'display:block;margin-top:10px';
    f.append(out);
  }
  out.textContent = message;
}
function restoreDrafts() {
  for (const f of document.querySelectorAll('[data-form]')) {
    const draft = drafts.get(formKey(f));
    if (!draft) continue;
    for (const entry of draft) {
      const el = Array.from(f.elements).find(
        el => el.name === entry.name && (entry.type !== 'checkbox' || el.value === entry.value)
      );
      if (el) {
        el.value = entry.value;
        if (entry.type === 'checkbox') el.checked = entry.checked;
      }
    }
    formNotice(f, autoJobs.has(formKey(f)) ? 'Salvataggio automatico in attesa…' : 'Bozza conservata');
    if (f.dataset.form === 'identity') {
      const fd = new FormData(f);
      $('livery').innerHTML = car({
        count: Number(fd.get('count')),
        colors: [0, 1, 2].map(i => fd.get('color' + i))
      });
    }
  }
}
function command(body, { quiet = false, automatic = false } = {}) {
  const key =
      body.action +
      ':' +
      (body.action === 'session-setup' ? body.mode + ':' + body.event + ':' : '') +
      (['strategy', 'live', 'session-setup'].includes(body.action) ? body.slot : ''),
    submittedDraft = drafts.get(key);
  const findForm = () => Array.from(document.querySelectorAll('[data-form]')).find(f => formKey(f) === key);
  body = JSON.parse(JSON.stringify(body));
  pendingCommands++;
  busy = true;
  formNotice(findForm(), 'Salvataggio in corso…');
  const job = commandTail.then(async () => {
    try {
      accept(await api(body));
      if (drafts.get(key) === submittedDraft) drafts.delete(key);
      identityDirty = drafts.has('identity:');
      persistAutoDrafts();
      if (!quiet) {
        render();
        formNotice(
          findForm(),
          drafts.has(key) ? 'Salvato. Ci sono nuove modifiche da salvare.' : 'Salvato sul server ✓'
        );
        toast(
          body.action === 'strategy' ? 'Piano pilota ' + (body.slot + 1) + ' salvato' : 'Salvato sul server'
        );
      }
      return true;
    } catch (e) {
      formNotice(findForm(), 'Non salvato: ' + e.message);
      if (!automatic) toast(e.message);
      return false;
    } finally {
      pendingCommands--;
      busy = pendingCommands > 0;
    }
  });
  commandTail = job.catch(() => {});
  return job;
}

const autoJobs = new Map();
let autoOwner = null,
  autoTimer = 0,
  autoRunning = false;
const autoKey = () => 'simulator-autosave:' + data?.me?.id;
function persistAutoDrafts() {
  if (!data?.me) return;
  try {
    localStorage.setItem(autoKey(), JSON.stringify({ drafts: [...drafts], jobs: [...autoJobs] }));
  } catch {}
}
function loadAutoDrafts() {
  if (!data?.me || autoOwner === data.me.id) return;
  autoOwner = data.me.id;
  drafts.clear();
  autoJobs.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(autoKey()) || '{}');
    for (const [k, v] of saved.drafts || []) if (Array.isArray(v)) drafts.set(k, v);
    for (const [k, v] of saved.jobs || [])
      if (
        v?.body &&
        ['identity', 'strategy', 'live', 'session-setup'].includes(v.body.action) &&
        (v.body.action !== 'live' || v.race === data.race?.id) &&
        (v.body.action !== 'session-setup' || v.body.event === data.sessions?.event)
      )
        autoJobs.set(k, v);
  } catch {}
  identityDirty = drafts.has('identity:');
  scheduleAutoSave();
}
function scheduleAutoSave() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(flushAutoSaves, 400);
}
function queueAutoSave(f) {
  const key = formKey(f),
    type = f.dataset.form;
  if (!['identity', 'strategy', 'live', 'session-setup'].includes(type)) return;
  if (!f.checkValidity()) {
    autoJobs.delete(key);
    formNotice(f, 'Bozza salvata: completa i valori validi');
    return;
  }
  const fd = new FormData(f),
    slot = Number(f.dataset.slot);
  let body;
  if (type === 'identity')
    body = {
      action: type,
      name: fd.get('name'),
      count: Number(fd.get('count')),
      colors: [0, 1, 2].map(i => fd.get('color' + i))
    };
  else if (type === 'session-setup')
    body = {
      action: type,
      mode: f.dataset.mode,
      event: data.sessions.event,
      slot,
      setup: getSessionSetup(f)
    };
  else body = { action: type, slot, strategy: getStrategy(f) };
  if (type === 'live') {
    const c = data.race?.cars.find(c => c.own && c.slot === slot);
    if (!c) return;
  }
  autoJobs.set(key, { body, race: data.race?.id });
  scheduleAutoSave();
}
async function flushAutoSaves() {
  clearTimeout(autoTimer);
  if (autoRunning || !token || !data?.me) return;
  autoRunning = true;
  const batch = [...autoJobs];
  try {
    for (const [key, job] of batch) {
      if (autoJobs.get(key) !== job) continue;
      if (!drafts.has(key)) {
        autoJobs.delete(key);
        continue;
      }
      if (
        (job.body.action === 'live' && job.race !== data.race?.id) ||
        (job.body.action === 'session-setup' && job.body.event !== data.sessions?.event)
      ) {
        autoJobs.delete(key);
        drafts.delete(key);
        continue;
      }
      const ok = await command(job.body, { quiet: true, automatic: true });
      if (ok && autoJobs.get(key) === job) {
        autoJobs.delete(key);
        const f = [...document.querySelectorAll('[data-form]')].find(f => formKey(f) === key);
        formNotice(f, 'Salvato automaticamente ✓');
      }
      persistAutoDrafts();
    }
  } finally {
    autoRunning = false;
    if ([...autoJobs].some(([k, v]) => !batch.some(([bk, bv]) => k === bk && v === bv))) scheduleAutoSave();
  }
}
window.addEventListener('online', flushAutoSaves);
setInterval(() => {
  if (!document.hidden && autoJobs.size) flushAutoSaves();
}, 10000);

async function poll() {
  if (polling || busy || !token || document.hidden) return;
  polling = true;
  try {
    const next = await api();
    const changed = next.revision !== data?.revision;
    const raceChanged = raceKey(next.race) !== renderedRaceKey;
    accept(next);
    if (!opened) {
      const delay = Math.max(0, 2000 - (performance.now() - started));
      setTimeout(() => {
        $('splash').hidden = true;
        $('app').hidden = false;
        opened = true;
        render();
        presence();
      }, delay);
    } else if (
      (raceChanged && !document.body.classList.contains('panel-dragging') && !identityDirty) ||
      (changed &&
        !document.body.classList.contains('panel-dragging') &&
        !identityDirty &&
        !['Gara', 'Libere', 'Qualifiche'].includes(tab) &&
        !$('modal').open &&
        (!$('main').contains(document.activeElement) ||
          (tab === 'Campionato' && !document.activeElement?.closest('[data-form=proposal]'))))
    )
      render();
    else if (tab === 'Gara') updateRace();
    else if (['Libere', 'Qualifiche'].includes(tab)) updateSessions();
    else {
      updateCommunity();
      updateEventBoard();
    }
  } catch (e) {
    $('sync').textContent = '● RICONNESSIONE';
    $('sync').style.color = '#ffad85';
    if (!opened) {
      $('connection').textContent = e.message;
      $('retry').hidden = false;
    }
  } finally {
    polling = false;
  }
}
async function presence() {
  if ((busy && !document.hidden) || !data?.me || !token) return;
  try {
    const next = await api(
      { action: 'presence', visible: !document.hidden && opened },
      { keepalive: document.hidden }
    );
    accept(next);
  } catch {}
}
setInterval(() => {
  if (['Gara', 'Libere', 'Qualifiche', 'Paddock'].includes(tab)) poll();
}, 3000);
setInterval(() => presence(), 3000);
setInterval(() => {
  if (!['Gara', 'Libere', 'Qualifiche', 'Paddock'].includes(tab)) poll();
}, 15000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    persistView();
    flushAutoSaves();
  }
  presence();
  if (!document.hidden) poll();
});
window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== parent) return;
  if (e.data?.type === 'simulator:session' && typeof e.data.token === 'string') {
    token = e.data.token;
    poll();
  }
  if (e.data?.type === 'simulator:back') {
    navigateBack();
    return;
  }
  if (e.data?.type === 'arcade:insets') {
    applySimulatorInsets(e.data.insets);
    fitSimulatorViewport();
  }
});
parent.postMessage({ type: 'arcade:ready' }, location.origin);
parent.postMessage({ type: 'simulator:ready' }, location.origin);
$('retry').onclick = () => {
  parent.postMessage({ type: 'simulator:ready' }, location.origin);
  poll();
};
if (parent === window) {
  $('connection').textContent = 'Apri Binotto Simulator dal catalogo di Binottoland su Telegram.';
  $('retry').hidden = false;
}
function updateHeader() {
  if (!data) return;
  const marketPanel = document.querySelector('.team-market');
  if (marketPanel && marketStamp() !== lastMarketStamp) marketPanel.innerHTML = market();
  const t = data.me;
  $('team-name').textContent = t ? `${t.name} · LV ${1 + Math.floor(t.xp / 300)}` : 'Il tuo posto al muretto';
  $('balance').textContent = t ? money(t.cash) : '';
  if ($('connected-names')) {
    $('connected-names').textContent = (data.online || []).map(u => u.name).join(' · ') || 'Nessuno';
    $('connected-count').textContent = '● Connessi ' + (data.online || []).length;
  }
}
function car(t) {
  const c = t.colors,
    a = c[0],
    b = t.count > 1 ? c[1] : a,
    d = t.count > 2 ? c[2] : b;
  return `<svg viewBox="0 0 500 170" aria-label="Livrea scuderia" role="img"><defs><linearGradient id="body-light" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs><g fill="#080d15" stroke="#556171" stroke-width="2"><rect x="85" y="25" width="55" height="33" rx="8"/><rect x="85" y="115" width="55" height="33" rx="8"/><rect x="350" y="20" width="62" height="39" rx="8"/><rect x="350" y="114" width="62" height="39" rx="8"/></g><g stroke="#a6b3c3" stroke-width="3"><path d="M115 45L175 85 115 130M380 40L315 85 380 135"/></g><path d="M50 85L155 70 225 45 360 50 395 85 360 120 225 125 155 100Z" fill="${a}"/><path d="M55 81L235 75 360 65 360 100 235 95 55 89Z" fill="${b}"/><rect x="62" y="43" width="17" height="86" rx="3" fill="${d}"/><rect x="404" y="37" width="22" height="97" rx="3" fill="${d}"/><ellipse cx="253" cy="85" rx="26" ry="17" fill="#11151b" stroke="${d}" stroke-width="4"/><circle cx="255" cy="85" r="9" fill="#e6e5e1"/><path d="M282 60L350 60 374 85 350 111 282 111" fill="none" stroke="${d}" stroke-width="4"/><path d="M50 85L155 70 225 45 360 50 395 85 360 120 225 125 155 100Z" fill="url(#body-light)"/></svg>`;
}
const pagePositions = {};
function paged(items, key, size) {
  const total = Math.max(1, Math.ceil(items.length / size)),
    page = Math.max(0, Math.min(pagePositions[key] || 0, total - 1));
  pagePositions[key] = page;
  return {
    items: items.slice(page * size, (page + 1) * size),
    controls:
      total > 1
        ? `<div class="pager">${button('list-page', '‹', `data-key="${key}" data-step="-1" aria-label="Pagina precedente" ${page === 0 ? 'disabled' : ''}`)}<span>${page + 1} / ${total}</span>${button('list-page', '›', `data-key="${key}" data-step="1" aria-label="Pagina successiva" ${page === total - 1 ? 'disabled' : ''}`)}</div>`
        : ''
  };
}
function render() {
  if (!data) return;
  const feedScroll =
    $('main').dataset.page === 'Paddock' && tab === 'Paddock'
      ? ['events', 'chat']
          .map(id => {
            const e = $(id);
            return e
              ? { id, top: e.scrollTop, bottom: e.scrollHeight - e.clientHeight - e.scrollTop < 40 }
              : null;
          })
          .filter(Boolean)
      : [];
  const openDetails =
    $('main').dataset.page === tab
      ? [...$('main').querySelectorAll('details')].map((d, i) => (d.open ? i : -1))
      : [];
  renderedRaceKey = raceKey(data.race);
  for (const el of document.querySelectorAll('.split')) el._releaseDrag?.();
  disposePanels();
  disposeCockpit();
  updateHeader();
  $('navigation').innerHTML = [
    'Paddock',
    'Team',
    'Evento',
    'Campionato',
    'Box',
    'Libere',
    'Qualifiche',
    'Gara'
  ]
    .map(t => button('tab', t, `data-tab="${t}"`, t === tab ? 'active' : ''))
    .join('');
  $('main').className = ['Gara', 'Libere', 'Qualifiche'].includes(tab)
    ? tab === 'Gara'
      ? 'racing'
      : 'racing sessions'
    : '';
  $('main').dataset.page = tab;
  const pages = {
    Paddock: paddock,
    Team: teamPage,
    Scuderia: teamPage,
    Mercato: teamPage,
    Box: boxPage,
    Strategia: () => strategies() + telemetryPage(),
    Campionato: championship,
    Evento: eventPage,
    Telemetria: telemetryPage,
    Libere: sessionsPage,
    Qualifiche: sessionsPage,
    Gara: race
  };
  $('main').innerHTML = pages[tab]();
  [...$('main').querySelectorAll('details')].forEach((d, i) => {
    if (openDetails.includes(i)) d.open = true;
  });
  restoreDrafts();
  restoreChatDraft();
  const availability = document.querySelector('[data-form=proposal]');
  if (availability) updateAvailability(availability);
  const compact = isCompact();
  document.documentElement.classList.toggle('compact', compact);
  if (tab === 'Gara') {
    attachCanvas($('track'));
    if (!compact) installSplitters();
    updateRace();
  } else if (['Libere', 'Qualifiche'].includes(tab)) {
    attachCanvas($('track'));
    if (!compact) installSplitters();
    updateSessions();
  }
  updateCommunity();
  for (const saved of feedScroll) {
    const e = $(saved.id);
    if (e) e.scrollTop = saved.id === 'chat' && saved.bottom ? e.scrollHeight : saved.top;
  }
  updateEventBoard();
  // Phone: natural sizes and page scroll, no scaling and no drag handles; a sub-menu per section.
  disposePanels =
    compact || ['Gara', 'Libere', 'Qualifiche'].includes(tab)
      ? () => {}
      : installPanelLayouts($('main'), tab);
  disposeCockpit = compact ? () => {} : installCockpit($('main'));
  if (compact) installSubnav(tab);
  persistView();
}
// Compact layout for phones (portrait, or landscape with little height).
function isCompact() {
  return !!globalThis.matchMedia?.('(max-width: 760px), (max-height: 520px)').matches;
}
const SUBPANELS = {
  Paddock: [
    ['GP', '.paddock > .hero-card'],
    ['Scuderia', '.paddock > .team-summary'],
    ['Bacheca', '.paddock > .community-panel:not(.purple)'],
    ['Chat', '.paddock > .community-panel.purple']
  ],
  Team: [
    ['Scuderia', '.team-management'],
    ['Mercato', '.team-market']
  ],
  Box: [
    ['Strategia', '.box-workspace > section:nth-of-type(1)'],
    ['Telemetria', '.box-workspace > section:nth-of-type(2)']
  ],
  Libere: [
    ['Muretto', '.session-drivers'],
    ['Pista', '.track-wrap'],
    ['Classifica', '.session-stage > aside']
  ],
  Gara: [
    ['Muretto', '.driver-controls'],
    ['Pista', '.race-top > .track-wrap'],
    ['Classifica', '.race-board']
  ]
};
SUBPANELS.Qualifiche = SUBPANELS.Libere;
SUBPANELS.Evento = [
  ['Classifiche', '#event-live'],
  ['Premi e archivio', '.event-extra']
];
const subTabs = {};
function installSubnav(page) {
  const panels = SUBPANELS[page]
    ?.map(([label, sel]) => [label, $('main').querySelector(sel)])
    .filter(p => p[1]);
  if (!panels || panels.length < 2) return;
  const current = panels.some(p => p[0] === subTabs[page]) ? subTabs[page] : panels[0][0];
  const nav = document.createElement('div');
  nav.className = 'subnav';
  nav.setAttribute('role', 'tablist');
  const show = label => {
    subTabs[page] = label;
    for (const [name, el] of panels) el.classList.toggle('sub-hidden', name !== label);
    for (const b of nav.children) b.setAttribute('aria-selected', String(b.dataset.sub === label));
    $('main').dataset.sub = label;
    // The track canvas measures its box: let it re-measure once visible.
    if (label === 'Pista') requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  };
  for (const [label] of panels) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.sub = label;
    b.textContent = label;
    b.onclick = () => show(label);
    nav.append(b);
  }
  $('main').prepend(nav);
  show(current);
}
let wasCompact = isCompact();
window.addEventListener('resize', () => {
  if (isCompact() !== wasCompact && opened) {
    wasCompact = isCompact();
    render();
  }
});
function onboarding() {
  return `<div class="notice"><b>Il tuo primo campionato inizia qui.</b> Crea la scuderia con 10 milioni, ingaggia due piloti e tre tecnici, acquista il motore e iscriviti.${button('create', 'Crea la mia scuderia', '', 'primary')}</div>`;
}
// First-season path: one clear next step, derived only from the state the server already sends.
function guideSteps() {
  const t = data.me,
    a = data.approval || {},
    crewMissing = t ? Object.keys(t.crew).find(r => !t.crew[r]) : null,
    members = a.members?.length || 0;
  let calendarText =
      'Proponete giorni e orari nella scheda Campionato, poi accettate tutti la stessa proposta.',
    calendarButton = button('tab', 'Apri Campionato', 'data-tab="Campionato"', 'primary');
  if (t?.enrolled) {
    if (members < 2)
      calendarText = 'Serve almeno un’altra scuderia iscritta: invita qualcuno del gruppo a iscriversi.';
    else if (!data.proposals.length)
      calendarText = 'Nessuna proposta: scegli giorni e orari delle gare e pubblicala.';
    else if (!data.proposals.some(p => p.myVote))
      calendarText = 'Leggi le proposte e premi Accetta proposta su quella che ti va bene.';
    else if (!a.ready) calendarText = 'Hai accettato una proposta: premi Pronto! per confermare.';
    else if (!a.allReady)
      calendarText = `Sei pronto. Aspettiamo gli altri: ${a.readyCount || 0} / ${members} pronti sulla stessa proposta.`;
    else if (!a.started) calendarText = 'Tutti pronti: premi Si parte!! per chiudere le iscrizioni.';
    else
      calendarText = `Hai confermato. Mancano gli altri: ${a.startCount || 0} / ${members} hanno premuto Si parte!!.`;
  }
  return [
    {
      title: 'Crea la scuderia',
      text: 'Ricevi 10 milioni di budget. Sei il Team Principal: non guidi, decidi.',
      done: !!t,
      action: button('create', 'Crea la mia scuderia', '', 'primary')
    },
    {
      title: 'Ingaggia due piloti',
      text: 'Uno per vettura. Competenza = velocità, costanza = giri regolari, gomma = quanto le fa durare.',
      done: !!t && t.drivers.every(Boolean),
      action: button('market-role', 'Cerca piloti', 'data-role="driver"', 'primary')
    },
    {
      title: 'Ingaggia tre tecnici',
      text: 'Motorista (consumi), ingegnere aerodinamico (velocità e consigli di assetto), capo meccanico (soste).',
      done: !!t && !crewMissing,
      action: button(
        'market-role',
        'Cerca ' + (roles[crewMissing] || 'tecnici').toLowerCase(),
        `data-role="${crewMissing || 'motor'}"`,
        'primary'
      )
    },
    {
      title: 'Acquista la power unit',
      text: 'Il motore: si paga una volta, nessuno stipendio. Più potente = più veloce e meno consumi.',
      done: !!t?.engine,
      action: button('market-role', 'Scegli il motore', 'data-role="engine"', 'primary')
    },
    {
      title: 'Iscrivi la scuderia',
      text:
        t && ready(t) && t.cash < salary(t)
          ? 'Budget insufficiente per gli stipendi del primo GP: sostituisci un contratto più caro.'
          : 'Con cinque persone e il motore puoi iscriverti alla stagione.',
      done: !!t?.enrolled || !!data.schedule?.participants?.includes(t?.id),
      action: button('tab', 'Vai all’iscrizione', 'data-tab="Campionato"', 'primary')
    },
    {
      title: 'Decidete il calendario',
      text: calendarText,
      done: !!data.schedule,
      action: calendarButton
    }
  ];
}
function guide() {
  if (data.schedule) return '';
  const steps = guideSteps(),
    current = steps.findIndex(s => !s.done);
  if (current < 0) return '';
  const step = steps[current];
  return `<section class="guide" aria-label="Percorso del primo campionato"><div class="guide-head"><span class="eyebrow">Primo campionato · passo ${current + 1} di ${steps.length}</span><ol class="guide-steps">${steps.map((s, i) => `<li class="${s.done ? 'done' : i === current ? 'current' : ''}" title="${esc(s.title)}">${s.done ? '✓' : i + 1}</li>`).join('')}</ol></div><div class="guide-body"><div><b>${esc(step.title)}</b><p>${esc(step.text)}</p></div>${step.action}</div></section>`;
}
function sponsorGoal(cls = '') {
  const o = data.objective;
  if (!o) return '';
  return `<p class="sponsor-goal ${cls}"><b>Obiettivo sponsor</b> ${esc(o.text)} <span>+${money(o.reward)}</span></p>`;
}
function debriefButton() {
  const d = data.me?.lastDebrief;
  if (!d) return '';
  let seen = '';
  try {
    seen = localStorage.getItem('simulator-debrief-seen:' + data.viewer.id) || '';
  } catch {}
  return button(
    'debrief',
    'Resoconto · ' + esc(d.track) + (seen === d.race ? '' : ' ●'),
    '',
    seen === d.race ? '' : 'primary'
  );
}
function paddock() {
  const t = data.me,
    i = Math.min(data.round, 12),
    track = data.tracks[i],
    when = data.schedule?.dates[data.round],
    guideHtml = guide();
  return `${guideHtml}<div class="paddock" ${guideHtml ? 'style="height:calc(100% - 112px)"' : ''}><section class="hero-card"><img src="/simulator/assets/circuit-${i}.webp" alt="Panorama di ${track[0]}"><div class="hero-top"><span class="tag">STAGIONE ${data.season} / ROUND ${Math.min(data.round + 1, 13)}</span><span class="tag">${data.race?.active ? '● IN DIRETTA' : 'IL PROSSIMO GRAN PREMIO'}</span></div><div class="eyebrow">${data.round >= 13 ? 'Stagione conclusa' : when ? date(when) + ' · ORA ITALIANA' : 'Il calendario lo decidete voi'}</div><h2>${track[0]}</h2><p>${track[1].toFixed(3)} km &nbsp; / &nbsp; ${data.laps} giri &nbsp; / &nbsp; ${data.conditions?.forecast || 'Previsione in preparazione'}</p>${sponsorGoal()}<div class="row">${button('tab', data.race?.active ? 'Vai al muretto →' : 'Prepara la tua gara →', `data-tab="${data.race?.active ? 'Gara' : 'Box'}"`, 'primary')}${debriefButton()}<span class="tag">${data.teams.filter(t => t.enrolled).length} SCUDERIE ISCRITTE</span></div></section><section class="card scroll-card community-panel"><div class="row"><h3>Bacheca eventi</h3>${button('tab', 'Calendario ↗', 'data-tab="Campionato"', 'quiet')}</div><div class="scroll-body" id="events"></div></section><section class="card team-summary fit-panel"><div class="eyebrow">TEAM PRINCIPAL · ${esc(t?.principal || 'Il tuo nome')}</div><h3>${esc(t?.name || 'Una scuderia da costruire')}</h3><div class="car-stage">${car(t || { colors: ['#f14e58', '#ffd475', '#fff'], count: 2 })}</div>${(t?.drivers || [null, null]).map((d, i) => `<div class="driver-mini"><span><small>VETTURA 0${i + 1}</small><br><b>${esc(d?.name || 'Pilota da ingaggiare')}</b></span><strong>${d?.points || 0} <small>PT</small></strong></div>`).join('')}<div class="subtle row"><small>${t ? `Stipendi / GP · ${money(salary(t))}` : 'Due piloti. Tre tecnici. Un obiettivo.'}</small>${button('tab', 'Gestisci', 'data-tab="Team"')}</div></section><section class="card scroll-card purple community-panel"><div class="row"><h3>Radio paddock</h3><span class="tag">CHAT DI GRUPPO</span></div><div class="scroll-body" id="chat"></div><form class="chat-form" data-form="chat"><input name="text" aria-label="Messaggio al paddock" maxlength="500" required placeholder="Scrivi alla community…"><button type="submit">Invia ↗</button></form></section></div>`;
}
function teamPage() {
  if (!data.me) return onboarding();
  return `<div class="team-layout"><section class="team-management fit-panel">${team()}</section><section class="team-market">${market()}</section></div>`;
}
function team() {
  const t = data.me;
  if (!t) return onboarding();
  const contracts = [
    ...t.drivers.map((d, i) => ({ role: 'driver', label: 'Pilota ' + (i + 1), person: d })),
    ...Object.entries(t.crew).map(([role, person]) => ({ role, label: roles[role], person }))
  ];
  return `<div class="row"><div><div class="eyebrow">${esc(t.principal)} · TEAM PRINCIPAL</div><h2>Team</h2></div><span class="tag">SALVATAGGIO PERSONALE ONLINE</span></div><div class="two"><section class="card"><h3>Design studio</h3><form data-form="identity"><label>Nome scuderia<input name="name" maxlength="32" required value="${esc(t.name)}"></label><div class="car-stage" id="livery">${car(t)}</div><div class="row"><label>Livrea<select name="count">${options({ 1: '1 colore', 2: '2 colori', 3: '3 colori' }, String(t.count))}</select></label>${t.colors.map((c, i) => `<label>${['Base', 'Inserti', 'Dettagli'][i]}<input type="color" name="color${i}" value="${c}"></label>`).join('')}</div><output data-save-status role="status">Salvataggio automatico attivo</output></form></section><section class="card accent"><h3>Reparto sviluppo</h3><div class="stats"><div><small>POWER UNIT</small><b>${t.engine?.skill || '—'}</b></div><div><small>AERODINAMICA</small><b>LV ${t.aero}</b></div><div><small>TELAIO</small><b>LV ${t.chassis}</b></div></div><p class="muted">${esc(t.engine?.name || 'Nessun motore: acquistalo nel mercato.')}</p>${['aero', 'chassis'].map((k, i) => `<div class="row subtle"><span>${i ? 'Telaio' : 'Aerodinamica'} · LV ${t[k]}</span>${button('upgrade', money(t[k] * 350000), `data-part="${k}" ${data.race?.active ? 'disabled' : ''}`)}</div>`).join('')}<div class="subtle"><small>Monte stipendi per GP</small><div class="metric">${money(salary(t))}</div><small>Addebitati alla partenza. Sponsorizzazione: 350.000 € a gara più 6.000 € per punto. Le modifiche sono bloccate durante la tua gara.</small></div></section></div><h3 class="subtle">Le cinque figure della scuderia</h3><div class="grid">${contracts.map(({ role, label, person: p }) => `<article class="card contract"><span class="role">${label}</span><h3>${esc(p?.name || 'Posizione aperta')}</h3><p class="muted">${p ? `Competenza ${p.skill} · ${money(p.salary)} / GP` : 'Scegli e ingaggia un professionista nel mercato condiviso.'}</p>${button('market-role', p ? 'Sostituisci' : 'Cerca nel mercato', `data-role="${role}"`)}</article>`).join('')}</div>`;
}
function market() {
  lastMarketStamp = marketStamp();
  const t = data.me;
  if (!t) return onboarding();
  const level = 1 + Math.floor(t.xp / 300),
    page = paged(
      data.market.filter(o => o.role === marketRole),
      'market-' + marketRole,
      innerWidth <= 700 ? 2 : innerHeight < 650 ? 3 : 6
    );
  return `<div class="market-header"><div><div class="eyebrow">CONTRATTI CONDIVISI · RINNOVO ${date(data.marketRefresh)}</div><h2>Mercato</h2></div><span class="tag">IL TUO LIVELLO ${level}</span></div><div class="filters">${Object.entries(
    roles
  )
    .map(([r, n]) => button('market-role', n, `data-role="${r}"`, r === marketRole ? 'active' : ''))
    .join(
      ''
    )}</div><p class="muted subtle">Un livello ogni 4 gare, oppure 3 gare in presenza (almeno metà gara collegato). Progressione: ${t.xp % 300} / 300 XP. Ogni contratto è esclusivo; rinnovo giornaliero.</p><div class="grid market-grid" data-no-resize="true">${page.items.map(o => `<article class="card contract market-offer ${o.sold ? 'sold' : ''}"><div class="row"><span class="role">${roles[o.role]}</span><span class="tag">LV ${o.tier}</span></div><h3>${esc(o.name)}</h3><div class="stats"><div title="${o.role === 'driver' ? 'Velocità del pilota.' : o.role === 'engine' ? 'Potenza: più alta, più veloce e meno consumi.' : 'Qualità del lavoro del tecnico e precisione dei suoi consigli.'}"><small>COMPETENZA</small><b>${o.skill}</b></div>${o.role === 'driver' ? `<div title="Regolarità: più alta, meno variazioni da un giro all’altro."><small>COSTANZA</small><b>${o.consistency}</b></div><div title="Quanto il pilota fa durare le gomme: più alto, meno usura."><small>GESTIONE GOMME</small><b>${o.tyres}</b></div>` : ''}</div><p><b>${money(o.fee)}</b><br><small>${o.salary ? money(o.salary) + ' / GP' : 'Acquisto motore · nessuno stipendio'}</small></p>${button('hire', o.sold ? 'Contratto assegnato' : o.tier > level ? 'Sbloccato al livello ' + o.tier : 'Ingaggia →', `data-id="${o.id}" ${o.sold || o.tier > level || data.race?.active ? 'disabled' : ''}`, o.sold ? '' : 'primary')}</article>`).join('')}</div>${page.controls}`;
}
function strategyFields(st) {
  return `<div class="form-grid"><label>Carico aerodinamico<input type="number" name="wing" min="0" max="100" value="${st.wing}" required></label><label>Ripartizione freno anteriore %<input type="number" name="brake" min="45" max="65" value="${st.brake}" required></label><label>Mescola iniziale / pit singolo<select name="compound">${options(compounds, st.compound)}</select></label><label>Ritmo<select name="pace">${options({ save: 'Conserva', normal: 'Normale', push: 'Spingi' }, st.pace)}</select></label><label>Pit singolo · giro (se piano vuoto)<input type="number" name="pitLap" min="1" max="${data.laps || 60}" value="${st.pitLap}" required></label><label>Pit di riserva · gomme residue %<input type="number" name="wearAt" min="10" max="80" value="${st.wearAt}" required></label><label>Carburante iniziale · kg<input type="number" name="fuel" min="10" max="110" value="${st.fuel}" required></label><label>Rifornimento al pit · kg<input type="number" name="refuel" min="0" max="110" value="${st.refuel}" required></label></div><details class="stint-plans" open><summary>Piano fino a 3 soste · giro 0 = non utilizzata</summary><small>Se compilato sostituisce il pit singolo. I rientri di sicurezza restano attivi; ogni sosta usa la prossima mescola e quantità del piano.</small>${[
    0, 1, 2
  ]
    .map(i => {
      const p = st.stops?.[i];
      return `<div class="stint-row"><label>Sosta ${i + 1} · giro<input name="stopLap${i}" type="number" min="0" max="${data.laps || 60}" value="${p?.lap || 0}"></label><label>Mescola<select name="stopCompound${i}">${options(compounds, p?.compound || 'medium')}</select></label><label>Kg da aggiungere<input name="stopFuel${i}" type="number" min="0" max="110" value="${p?.refuel ?? 30}"></label></div>`;
    })
    .join('')}</details>`;
}
function boxPage() {
  return `<div class="box-workspace"><section class="fit-panel">${strategies()}</section><section class="fit-panel">${telemetryPage()}</section></div>`;
}
const PLAN_KEYS = ['wing', 'brake', 'compound', 'pace', 'pitLap', 'wearAt', 'fuel', 'refuel'];
const samePlan = (a, b) =>
  PLAN_KEYS.every(k => a?.[k] === b?.[k]) &&
  JSON.stringify((a?.stops || []).map(x => [x.lap, x.compound, x.refuel])) ===
    JSON.stringify((b?.stops || []).map(x => [x.lap, x.compound, x.refuel]));
function planSummary(st) {
  const stops = st.stops?.length ? st.stops : [{ lap: st.pitLap, compound: st.compound }];
  const tyres = [st.compound, ...(st.stops || []).map(p => p.compound)].map(c => compounds[c]).join(' → ');
  return `${tyres} · ${stops.length} ${stops.length === 1 ? 'sosta' : 'soste'} (giro ${stops.map(p => p.lap).join(', ')}) · ${st.fuel} kg · ${{ save: 'Conserva', normal: 'Normale', push: 'Spingi' }[st.pace]}`;
}
// Three ready-made plans computed by the server with the race model.
function presetPicker(slot, st) {
  const list = data.engineering?.drivers?.[slot]?.presets;
  if (!list) return '';
  return `<div class="presets" role="group" aria-label="Strategie pronte">${list
    .map(
      p =>
        `<button type="button" class="preset ${samePlan(p.strategy, st) ? 'active' : ''}" data-action="preset" data-slot="${slot}" data-key="${p.key}" title="${esc(p.text)} Arrivo stimato con ${Math.round(p.finishFuel)} kg di benzina."><b>${esc(p.name)}${samePlan(p.strategy, st) ? ' ✓' : ''}</b><small>≈ ${p.minutes.toFixed(1).replace('.', ',')} min · ${p.stops} ${p.stops === 1 ? 'sosta' : 'soste'}</small></button>`
    )
    .join(
      ''
    )}</div><p class="preset-note">${esc(list.find(p => samePlan(p.strategy, st))?.text || 'Scegli una strategia pronta oppure apri le impostazioni avanzate.')}</p>`;
}
function applyPreset(slot, key) {
  const p = data.engineering?.drivers?.[slot]?.presets?.find(x => x.key === key),
    form = document.querySelector(`[data-form="strategy"][data-slot="${slot}"]`);
  if (!p || !form) return;
  const plan = p.strategy,
    set = (name, value) => form.elements[name] && (form.elements[name].value = String(value));
  for (const k of PLAN_KEYS) set(k, plan[k]);
  for (let i = 0; i < 3; i++) {
    const stop = plan.stops[i];
    set('stopLap' + i, stop ? stop.lap : 0);
    if (stop) {
      set('stopCompound' + i, stop.compound);
      set('stopFuel' + i, stop.refuel);
    }
  }
  // Same path as a manual edit: local draft, then the serialized autosave.
  form.elements.wing.dispatchEvent(new Event('input', { bubbles: true }));
  toast(p.name + ' applicata a ' + (data.me?.drivers?.[slot]?.name || 'vettura ' + (slot + 1)) + '.');
}
// Keep the preset highlight, summary and note in step with the fields, without re-rendering the form.
function refreshPresetState(form) {
  const slot = Number(form.dataset.slot),
    plan = getStrategy(form),
    list = data.engineering?.drivers?.[slot]?.presets || [],
    match = list.find(p => samePlan(p.strategy, plan));
  for (const b of document.querySelectorAll(`.preset[data-slot="${slot}"]`)) {
    const on = b.dataset.key === match?.key,
      name = b.querySelector('b');
    b.classList.toggle('active', on);
    name.textContent = name.textContent.replace(/ ✓$/, '') + (on ? ' ✓' : '');
  }
  const summary = form.querySelector('.advanced-fields > summary span'),
    note = form.closest('section')?.querySelector('.preset-note');
  if (summary) summary.textContent = planSummary(plan);
  if (note)
    note.textContent =
      match?.text || 'Piano personalizzato. Le strategie pronte sopra lo sostituiscono con un clic.';
}
document.addEventListener('input', e => {
  const form = e.target.closest('[data-form="strategy"]');
  if (form) refreshPresetState(form);
});
function strategies() {
  const t = data.me;
  if (!t) return onboarding();
  const track = data.tracks[Math.min(data.round, 12)];
  return `<div class="eyebrow">PROSSIMO APPUNTAMENTO · ${track[0]}</div><h2>Box · assetto, strategia e telemetria.</h2>${sponsorGoal('box-goal')}<div class="notice">${track[1]} km · ${data.laps} giri · ${data.conditions?.forecast || 'Previsione in preparazione'}. Il piano offline usa giro pit, soglia gomme e riserva carburante. Se sei al muretto puoi cambiarlo durante la gara. Offline: velocità media −5%. Rischio per vettura e GP: danno 2%, foratura 2%, incidente 2% (estrazioni indipendenti).</div><div class="two">${t.strategies.map((st, i) => `<section class="card ${i ? 'purple' : 'accent'}"><div class="eyebrow">VETTURA 0${i + 1}</div><h3>${esc(t.drivers[i]?.name || 'Pilota da ingaggiare')}</h3>${presetPicker(i, st)}<form class="strategy-form" data-form="strategy" data-slot="${i}"><details class="advanced-fields"><summary>Impostazioni avanzate · <span>${esc(planSummary(st))}</span></summary>${strategyFields(st)}<small>Consumo iniziale stimato: ${(data.engineering?.drivers?.[i]?.consumption || 0).toFixed(2)} kg/giro. Peso, motore, carico e ritmo modificano consumo e gomme. Il pit avviene al passaggio del traguardo; la riserva automatica interviene sotto 1,7 giri di carburante.</small></details><output data-save-status role="status">Salvataggio automatico attivo</output></form></section>`).join('')}</div>`;
}
const proposalSlots = p => p.slots || p.days.map(day => ({ day, times: p.times }));
function qualifyingClock(time) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return '—';
  const [h, m] = time.split(':').map(Number),
    at = h * 60 + m;
  const fmt = n => {
    n = (n + 1440) % 1440;
    return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  };
  return fmt(at - 30) + '–' + fmt(at - 10) + (at < 30 ? ' (inizio il giorno prima)' : '');
}
function availabilityForm(t) {
  const own = data.proposals.find(p => p.author === t?.id),
    slots = own ? proposalSlots(own) : [],
    daily = own?.daily || Math.max(1, ...slots.map(s => s.times.length));
  return `<form data-form="proposal"><label>Disponibile a partire dal<input type="date" name="start" required value="${own?.start || new Date(Date.now() + 86400000).toISOString().slice(0, 10)}"></label><label>Gare per giornata selezionata<select name="daily">${options({ 1: '1 gara al giorno (standard)', 2: '2 gare al giorno' }, String(daily))}</select></label><p class="muted">Seleziona i giorni disponibili. Qualifiche: 30 minuti prima, durata 20 minuti.</p><div class="weekday-picker">${days.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${slots.some(s => s.day === i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div><div class="availability-week">${days
    .map((d, i) => {
      const chosen = slots.find(s => s.day === i);
      return `<div class="availability-day" data-day="${i}"><strong class="day-label">${d}</strong>${[0, 1].map(n => `<label data-race-slot="${n}">Gara ${n + 1}<input type="time" name="time-${i}-${n}" value="${chosen?.times[n] || (n ? '22:30' : '21:00')}" required><small data-qualifying>Qualifica ${qualifyingClock(chosen?.times[n] || (n ? '22:30' : '21:00'))}</small></label>`).join('')}</div>`;
    })
    .join(
      ''
    )}</div><p class="muted">Almeno 90 minuti tra due gare. Orari Italia/Malta. Riformulare sostituisce la tua proposta e richiede nuovi voti.</p><button class="primary" type="submit" ${!t?.enrolled || data.approval?.allReady ? 'disabled' : ''}>Pubblica / riformula disponibilità</button><output data-save-status>Bozza conservata su questo dispositivo; pubblica per condividerla.</output></form>`;
}
function updateAvailability(form) {
  const daily = Number(form.elements.daily.value);
  for (const row of form.querySelectorAll('[data-day]')) {
    const active = form.querySelector('[name=day][value="' + row.dataset.day + '"]').checked;
    row.hidden = !active;
    row.classList.toggle('selected', active);
    for (const label of row.querySelectorAll('[data-race-slot]')) {
      const second = Number(label.dataset.raceSlot) === 1;
      label.hidden = second && daily === 1;
      const input = label.querySelector('input');
      input.disabled = !active || (second && daily === 1);
      label.querySelector('[data-qualifying]').textContent = 'Qualifica ' + qualifyingClock(input.value);
    }
  }
}
function calendarConfirmations() {
  const a = data.approval || {},
    eligible = data.me?.enrolled && data.proposals.some(p => p.myVote);
  return `<div class="calendar-confirmations"><p>Puoi cambiare proposta o togliere il pronto finché non sono tutti pronti. La stagione parte solo con il Si parte!! di tutti.</p><div class="row">${button('calendar-ready', a.ready ? 'Togli Pronto!' : 'Pronto!', `${!eligible || a.allReady ? 'disabled' : ''}`, a.ready ? 'active' : 'primary')}<span>${a.readyCount || 0} / ${a.members?.length || 0} pronti</span>${a.allReady ? button('calendar-start', a.started ? 'Si parte!! ✓' : 'Si parte!!', a.started ? 'disabled' : '', 'primary') : ''}${a.allReady ? `<span>${a.startCount || 0} / ${a.members.length} conferme di partenza</span>` : ''}</div></div>`;
}
function championship() {
  const t = data.me,
    registered = data.teams.filter(t => t.enrolled),
    required = Math.max(2, registered.length),
    proposals = paged(data.proposals, 'proposals', 1);
  return `<div class="championship-layout"><div class="row"><div><div class="eyebrow">STAGIONE ${data.season} · ${registered.length} ISCRITTI</div><h2>Il vostro campionato.</h2></div>${data.round >= 13 ? button('next-season', 'Apri la prossima stagione', '', 'primary') : !data.schedule && t ? button('enroll', t.enrolled ? 'Ritira iscrizione' : 'Iscrivi la scuderia', `data-value="${!t.enrolled}" ${!ready(t) || data.approval?.allReady ? 'disabled' : ''}`, 'primary') : ''}</div>${
    !data.schedule
      ? `<div class="notice">Completa organico e motore per iscriverti. Servono i voti di tutti i ${required} iscritti (minimo due scuderie) sulla stessa proposta. Accettate una proposta, confermate Pronto! e infine Si parte!! Tutti devono confermare l’avvio. Gli orari sono italiani (Europe/Rome).</div><div class="two"><section class="card fit-panel"><h3>Quando puoi partecipare?</h3>${availabilityForm(t)} </section><section class="card fit-panel"><h3>Disponibilità e proposte del gruppo</h3><p class="muted">Confrontate gli orari, riformulate se serve, poi votate un unico calendario. Pubblicare una disponibilità non equivale a votare.</p>${
          data.proposals.length
            ? proposals.items
                .map(
                  p =>
                    `<article class="event-proposal"><b>${esc(p.name)}</b><small> · dal ${esc(p.start)}</small>${proposalSlots(
                      p
                    )
                      .map(
                        slot =>
                          `<p><strong>${days[slot.day]}</strong> ${slot.times.map(time => `<span class="availability-summary">Qualifica ${qualifyingClock(time)} · <b>Gara ${esc(time)}</b></span>`).join('')}</p>`
                      )
                      .join(
                        ''
                      )}<div class="row"><span class="tag">${p.votes} / ${required} VOTI</span>${button('vote', p.myVote ? 'Accetta proposta ✓' : 'Accetta proposta', `data-id="${p.id}" ${!t?.enrolled || data.approval?.allReady ? 'disabled' : ''}`, p.myVote ? 'active' : '')}</div></article>`
                )
                .join('')
            : '<p class="muted">Nessuna disponibilità ancora pubblicata.</p>'
        }${proposals.controls}${calendarConfirmations()}</section></div>`
      : `<div class="notice">Calendario approvato · ${data.schedule.participants.length} scuderie · Le gare partono automaticamente, anche se nessuno è collegato.</div><div class="calendar">${data.tracks.map((tr, i) => `<article><img src="/simulator/assets/circuit-${i}.webp" alt=""><span class="eyebrow">${String(i + 1).padStart(2, '0')} ${i < data.round ? '· CONCLUSA' : ''}</span><b>${tr[0]}</b><small>Gara ${date(data.schedule.dates[i])}<br>Qualifiche ${date(data.schedule.dates[i] - 1800000)} – ${date(data.schedule.dates[i] - 600000)}</small></article>`).join('')}</div>`
  }<p class="muted championship-footnote">Classifiche, iscritti e risultati sono nella sezione Evento.</p></div>`;
}
function race() {
  const r = data.race,
    i = r?.round ?? Math.min(data.round, 12);
  return `<div class="race-toolbar"><h2>${data.tracks[i][0]} <span class="tag">${r?.active ? '● LIVE' : r ? 'RISULTATI' : 'IN ATTESA'}</span></h2><div>${button('camera', followCamera ? 'Vista circuito' : 'Segui pilota')}${button('camera-reset', 'Centra')} </div></div><div class="race-top"><div class="track-wrap"><canvas id="track" aria-label="Gara vista dall’alto"></canvas><div class="track-hud"><span id="lap-hud"></span><span>${r?.wet ? 'PIOGGIA' : 'ASCIUTTO'} · ${data.tracks[i][1]} KM · ${r?.laps || data.laps} GIRI · ${r?.conditions?.trackTemp?.toFixed(0) || data.conditions?.trackTemp || '—'}°C PISTA</span></div><div class="track-help">SELEZIONA UN PILOTA · ROTELLA PER ZOOM · TRASCINA LA VISTA</div></div><div class="split vertical" role="separator" tabindex="0" aria-label="Larghezza classifica" aria-orientation="vertical" id="split-width"></div><aside class="card race-board fit-panel"><h3>CLASSIFICA LIVE</h3><div id="leaders"></div><div id="race-events" class="subtle"></div><div id="session-reports"></div></aside></div><div class="split horizontal" role="separator" tabindex="0" aria-label="Altezza pannelli piloti" aria-orientation="horizontal" id="split-height"></div><div class="driver-controls">${[0, 1].map(i => `<section class="card live-card" id="live-${i}"></section>`).join('')}</div>`;
}
function updateRace() {
  const r = data.race;
  if (!$('leaders')) return;
  const cars = [...(r?.cars || [])].sort(
    (a, b) => a.dnf - b.dnf || (a.finished && b.finished ? a.finished - b.finished : b.progress - a.progress)
  );
  $('lap-hud').textContent = r
    ? `GIRO ${Math.min(r.laps || data.laps, 1 + Math.floor(cars[0]?.progress || 0))} / ${r.laps || data.laps}`
    : 'NESSUNA GARA IN CORSO';
  const page = paged(cars, 'race-leaders', isCompact() ? 40 : 3);
  $('leaders').innerHTML = cars.length
    ? page.items
        .map(
          (c, i) =>
            `<button class="leader ${follow === c.id ? 'selected' : ''}" data-action="follow" data-id="${c.id}"><span style="color:${c.colors[0]}">${pagePositions['race-leaders'] * (isCompact() ? 40 : 3) + i + 1}</span><span><b>${esc(c.name)}</b><small>${esc(c.teamName)} · ${c.compound.toUpperCase()}</small></span><span>${c.dnf ? 'RIT' : c.finished ? 'ARRIVO' : pagePositions['race-leaders'] * (isCompact() ? 40 : 3) + i ? '≈ +' + ((cars[0].progress - c.progress) * (c.lastLap || 90)).toFixed(1) + 's' : 'LEADER'}</span></button>`
        )
        .join('') + page.controls
    : '<p class="empty">La gara parte all’orario approvato.</p>';
  const debriefReady = r && !r.active && data.me?.lastDebrief?.race === r.id;
  $('race-events').innerHTML =
    (debriefReady ? button('debrief', 'Il tuo resoconto della gara →', '', 'primary') : '') +
    (r?.events || [])
      .slice(0, debriefReady ? 1 : 4)
      .map(
        e =>
          `<div class="feed-item race-line" title="${esc(e.text)}">${e.lap ? `<span class="lap-tag">G${e.lap}</span>` : ''}${esc(e.text)}</div>`
      )
      .join('');
  for (let slot = 0; slot < 2; slot++) {
    const c = r?.cars.find(c => c.own && c.slot === slot),
      el = $('live-' + slot),
      type = c ? 'live' : 'strategy',
      st = c?.strategy || data.me?.strategies?.[slot],
      key = (r?.id || 'pre') + ':' + type;
    if (el.dataset.formKey !== key) {
      el.dataset.formKey = key;
      el.innerHTML = `<div class="eyebrow">◉ MURETTO · VETTURA ${slot + 1}</div><div class="row"><h3>${esc(c?.name || data.me?.drivers[slot]?.name || 'Pilota da ingaggiare')}</h3><span class="tag" data-race-status></span></div><div class="telemetry" data-race-telemetry></div><div class="live-actions" data-race-actions></div>${st ? `<form data-form="${type}" data-slot="${slot}">${strategyFields(st)}<output data-save-status>Salvataggio automatico attivo</output></form>` : ''}`;
      restoreDrafts();
    }
    el.querySelector('[data-race-status]').textContent = c
      ? c.finished
        ? 'ARRIVO'
        : c.dnf
          ? 'RITIRATO'
          : c.pitTime
            ? 'AI BOX'
            : 'IN PISTA'
      : 'PREPARAZIONE';
    const values = c
      ? [
          ['Carburante', c.fuel.toFixed(1) + ' kg'],
          ['Consumo/giro', (c.consumption || 0).toFixed(2) + ' kg'],
          ['Gomme', c.wear.toFixed(0) + '%'],
          ['Temperatura', (c.temperature ?? 90).toFixed(0) + '°C'],
          ['Autonomia', c.consumption ? (c.fuel / c.consumption).toFixed(1) + ' giri' : '—'],
          ['Velocità', Math.round(c.speed) + ' km/h']
        ]
      : [];
    el.querySelector('[data-race-telemetry]').innerHTML = values
      .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`)
      .join('');
    el.querySelector('[data-race-actions]').innerHTML = c
      ? button(
          'pit',
          c.pitRequested ? 'Annulla rientro' : 'Rientra ai box',
          `data-slot="${slot}" ${!r.active || c.finished || c.dnf ? 'disabled' : ''}`,
          'primary'
        ) +
        `<small>${c.puncture ? '⚠ FORATURA · ' : c.damage ? '⚠ DANNO · ' : ''}Ritmo e freni subito; carico, gomme e rifornimento al prossimo ingresso ai box.</small>`
      : '<small>Piano iniziale: puoi prepararlo qui prima della gara.</small>';
    const form = el.querySelector('form');
    if (form) {
      if (!drafts.has(formKey(form)) && !form.contains(document.activeElement)) fillStrategyForm(form, st);
      for (const input of form.elements)
        if (input.name) {
          input.disabled = !!c && (!r.active || !!c.finished || !!c.dnf);
          if (input.name === 'fuel') input.readOnly = !!c;
        }
      const fuelLabel = form.elements.fuel?.parentElement;
      if (fuelLabel && c) fuelLabel.title = 'Quantità iniziale: per il prossimo pit modifica Rifornimento.';
    }
  }
  updateSessionReports(cars, 'race');
}
function fillStrategyForm(form, st) {
  for (const input of form.elements) {
    const k = input.name;
    if (!k) continue;
    const match = /^stop(Lap|Compound|Fuel)([0-2])$/.exec(k);
    if (match) {
      const stop = st.stops?.[Number(match[2])];
      input.value =
        match[1] === 'Lap'
          ? stop?.lap || 0
          : match[1] === 'Compound'
            ? stop?.compound || 'medium'
            : (stop?.refuel ?? 30);
    } else if (k in st) input.value = st[k];
  }
}
function updateSessionReports(cars, mode) {
  const el = $('session-reports');
  if (!el) return;
  el.innerHTML = [0, 1]
    .map(slot => {
      const c = cars.find(c => c.own && c.slot === slot),
        d = data.engineering?.drivers?.[slot],
        st =
          mode === 'race'
            ? c?.strategy || data.me?.strategies?.[slot]
            : data.sessions?.setups?.[mode]?.[slot],
        wing = mode === 'race' ? (c?.appliedWing ?? st?.wing) : (c?.strategy?.wing ?? st?.wing),
        next =
          mode === 'race'
            ? st?.stops?.[c?.pits || 0] || { compound: st?.compound, refuel: st?.refuel, lap: st?.pitLap }
            : null;
      return `<section class="pit-report"><h4>Vettura ${slot + 1} · ${esc(c?.name || data.me?.drivers?.[slot]?.name || 'Da ingaggiare')}</h4><p><b>Carico</b> ${wing ?? '—'} → ${st?.wing ?? '—'} <small>al box</small><br><b>Gomme</b> ${esc(compounds[c?.compound] || '—')} → ${esc(compounds[next?.compound || st?.compound] || '—')}<br><b>${mode === 'race' ? 'Rifornimento' : 'Benzina uscita'}</b> ${next?.refuel ?? st?.fuel ?? '—'} kg${mode === 'race' ? ` · pit giro ${next?.lap || '—'}` : ` · ${st?.stintLaps || '—'} giri lanciati`}</p>${c?.pendingSetup ? '<span class="tag">AL RIENTRO</span>' : ''}${c?.lastLap ? `<p>Ultimo giro <b>${lapTime(c.lastLap)}</b></p>` : ''}${
        d
          ? `<p class="muted">Stima ${d.consumption.toFixed(2)} kg/giro · usura ${d.wearPerLap.toFixed(1)}%/giro</p>${(
              d.advice || []
            )
              .slice(0, 2)
              .map(a => `<p><b>${esc(a.role)}</b> · ${esc(a.text)}</p>`)
              .join('')}`
          : ''
      }</section>`;
    })
    .join('');
}

function updateCommunity() {
  const events = $('events');
  if (events) {
    const top = events.scrollTop;
    events.innerHTML = data.events.length
      ? data.events.map(e => `<div class="feed-item"><time>${date(e.at)}</time>${esc(e.text)}</div>`).join('')
      : '<p class="muted">Benvenuto nel campionato della community.</p>';
    events.scrollTop = top;
  }
  const chat = $('chat');
  if (chat) {
    const top = chat.scrollTop,
      stick = !chat.dataset.loaded || chat.scrollHeight - chat.clientHeight - top < 40;
    chat.innerHTML = data.chat.length
      ? data.chat
          .map(
            m =>
              `<article class="chat-message"><b>${esc(m.name)} · ${esc(m.team)}</b><p>${esc(m.text)}</p></article>`
          )
          .join('')
      : '<p class="muted">Strategie e chiacchiere dal paddock.</p>';
    chat.scrollTop = stick ? chat.scrollHeight : top;
    chat.dataset.loaded = 'true';
  }
}

// One-line explanations for every strategy/setup field, keyed by the input name.
const HELP = {
  wing: [
    'Carico aerodinamico',
    'Da 0 a 100. Più carico: più veloce in curva, più lento sui rettilinei, consumi e usura un po’ più alti. Ogni pista ha un valore ideale (sale con la pioggia): i tecnici nel Box ti danno l’intervallo.'
  ],
  brake: [
    'Ripartizione freno anteriore',
    'Da 45 a 65%. Ogni pista ha un valore ideale: allontanarsene fa perdere tempo e consuma di più le gomme. L’intervallo consigliato è nei consigli dei tecnici.'
  ],
  compound: [
    'Mescola',
    'Soft: la più veloce, dura poco. Medium: equilibrio. Hard: più lenta, dura a lungo. Intermedie: pista umida. Wet: pioggia forte. La gomma sbagliata per il meteo costa molti secondi al giro.'
  ],
  pace: [
    'Ritmo',
    'Conserva: più lento, risparmia benzina e gomme. Normale: via di mezzo. Spingi: più veloce, ma consuma e scalda le gomme di più.'
  ],
  pitLap: [
    'Pit singolo',
    'Il giro in cui la vettura si ferma ai box, usato solo se il piano soste è vuoto. La sosta avviene al passaggio sul traguardo.'
  ],
  wearAt: [
    'Rientro di sicurezza',
    'Se la gomma scende sotto questa percentuale la vettura rientra da sola, anche prima del giro previsto. Più è alta, più sei prudente.'
  ],
  fuel: [
    'Benzina alla partenza',
    'In kg. Più benzina = più peso: più lento e più usura, ma meno soste. Sotto 1,7 giri di autonomia la vettura rientra da sola a fare benzina.'
  ],
  refuel: [
    'Rifornimento al pit',
    'Kg aggiunti al pit singolo. Si rifornisce a 3,5 kg al secondo, insieme al cambio gomme: più benzina = sosta più lunga.'
  ],
  stintLaps: [
    'Giri lanciati',
    'Quanti giri cronometrati fare in questa uscita prima di rientrare ai box. Il giro di uscita non conta.'
  ],
  stopLap: [
    'Giro della sosta',
    '0 = sosta non usata. Se compili almeno una sosta, il piano sostituisce il pit singolo. I giri devono essere in ordine crescente.'
  ],
  stopCompound: ['Gomma della sosta', 'La mescola montata a questa sosta.'],
  stopFuel: ['Benzina della sosta', 'Kg aggiunti a questa sosta (3,5 kg al secondo).']
};
const helpKey = name => (HELP[name] ? name : (name || '').replace(/\d+$/, ''));
function decorateHelp(root) {
  for (const field of root.querySelectorAll('label > input[name], label > select[name]')) {
    const key = helpKey(field.name),
      label = field.parentElement;
    if (!HELP[key] || label.querySelector('.help-btn')) continue;
    label.title = HELP[key][1];
    // Keep the label text and its "?" on one line, above the field.
    const caption = document.createElement('span'),
      help = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'help-btn',
        textContent: '?',
        title: 'Cos’è ' + HELP[key][0].toLowerCase() + '?'
      });
    help.dataset.action = 'help';
    help.dataset.help = key;
    caption.className = 'help-caption';
    while (label.firstChild && label.firstChild !== field) caption.append(label.firstChild);
    caption.append(help);
    label.insertBefore(caption, field);
  }
}
// Forms are rebuilt by render() and by the live session/race updates: decorate whatever appears.
new MutationObserver(() => decorateHelp($('main'))).observe($('main'), { childList: true, subtree: true });
// Positions lap by lap as a tiny line chart (1st at the top).
function positionChart(positions, cars) {
  if (positions.length < 2) return '';
  const w = 220,
    h = 54,
    max = Math.max(cars, ...positions),
    x = i => (i / (positions.length - 1)) * (w - 8) + 4,
    y = p => ((p - 1) / Math.max(1, max - 1)) * (h - 12) + 6;
  const points = positions.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  return `<svg class="pos-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Posizione giro per giro: dal ${positions[0]}° al ${positions.at(-1)}°"><line x1="4" x2="${w - 4}" y1="6" y2="6" class="pos-first"/><polyline points="${points}"/><circle cx="${x(positions.length - 1)}" cy="${y(positions.at(-1))}" r="3"/><text x="${w - 4}" y="${h - 1}" text-anchor="end">giro ${positions.length}</text><text x="4" y="${h - 1}">P${positions[0]}</text></svg>`;
}
function debriefHtml(d) {
  const cars = data.results?.find(x => x.id === d.race)?.rows.length || 0;
  return `<div class="debrief"><div class="eyebrow">RESOCONTO · ${esc(d.track)}</div><h2>Com’è andata la tua gara</h2>${d.objective ? `<p class="sponsor-goal ${d.objective.met ? 'met' : 'missed'}"><b>Obiettivo sponsor ${d.objective.met ? 'centrato' : 'mancato'}</b> ${esc(d.objective.text)} <span>${d.objective.met ? '+' + money(d.objective.reward) : '0 €'}</span></p>` : ''}${d.cars
    .map(
      c =>
        `<section class="debrief-car"><div class="row"><h3>Vettura ${c.slot + 1} · ${esc(c.name)}</h3><span class="tag">${c.dnf ? 'RITIRATO' : 'P' + c.position} · DAL ${c.grid}°</span></div><p class="debrief-key"><b>Il punto chiave:</b> ${esc(c.key)}</p>${positionChart(c.positions, cars)}<ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>`
    )
    .join(
      ''
    )}<p class="muted">Stime calcolate con lo stesso modello della gara. Solo tu vedi questo resoconto.</p></div>`;
}
function rulesHtml() {
  const section = (title, items) => `<h3>${title}</h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  return `<div class="rules"><div class="eyebrow">REGOLAMENTO</div><h2>Come funziona Binotto Simulator</h2><p>Sei il Team Principal: non guidi, decidi. Costruisci la scuderia, prepari la strategia e la gara si corre da sola in tempo reale sul server, anche se chiudi l’app.</p>${section(
    'Per partire',
    [
      'Crea la scuderia: ricevi 10 milioni.',
      'Ingaggia 2 piloti, 3 tecnici (motorista, ingegnere aerodinamico, capo meccanico) e compra la power unit.',
      'Iscriviti nella scheda Campionato.',
      'Il calendario si decide insieme: ogni iscritto accetta la stessa proposta, preme Pronto! e poi Si parte!!. Servono almeno due scuderie.',
      'Se siete in pochi, alla pubblicazione del calendario entrano scuderie AI (nome con “AI”) fino a 10 vetture. Non votano, non comprano e lasciano il campionato a fine stagione.'
    ]
  )}${section('Il weekend di gara', [
    'Libere: 30 minuti per GP per provare assetti e consumi, senza costi.',
    'Qualifiche: da 30 a 10 minuti prima della gara. Fai uscire tu i piloti: il miglior giro decide la griglia.',
    'Gara: 13 GP a stagione. Puoi cambiare ritmo, piano e chiamare il pit dal muretto. Se sei offline la vettura segue il piano, al 95% della velocità.'
  ])}${section('Strategia', [
    'Ogni parametro ha un pulsante <b>?</b> che spiega cosa cambia.',
    'Gomme e benzina si consumano: decidi quante soste fare (fino a 3) e con quale mescola.',
    'I consigli dei tecnici nel Box diventano più precisi con tecnici bravi e con più giri fatti in libere.'
  ])}${section('Soldi, punti e livelli', [
    'Stipendi addebitati a ogni GP. Sponsor: 350.000 € a gara più 6.000 € per punto.',
    'Obiettivo sponsor: a ogni GP la tua scuderia ha un obiettivo (es. una vettura nei primi 4, gestire le gomme, battere un rivale). Se lo centri ricevi 400.000 €. Lo vedi nel Paddock e nel Box prima della gara.',
    'Punti: 25-18-15-12-10-8-6-4-2-1. A fine stagione premi in denaro per piloti e scuderie.',
    'Ogni GP dà esperienza: i livelli sbloccano contratti migliori nel mercato, che si rinnova ogni giorno.'
  ])}${section('Imprevisti', [
    'In ogni GP ogni vettura ha il 2% di probabilità di danno aerodinamico, 2% di foratura e 2% di incidente (ritiro).',
    'Senza benzina la vettura si ferma: tieni d’occhio l’autonomia.'
  ])}</div>`;
}
function openDialog(html) {
  $('modal').innerHTML = button('close', '×', '', 'close') + html;
  $('modal').showModal();
  restoreDrafts();
}
function getStrategy(form) {
  const fd = new FormData(form),
    s = {};
  for (const k of ['wing', 'brake', 'pitLap', 'wearAt', 'fuel', 'refuel']) s[k] = Number(fd.get(k));
  s.compound = fd.get('compound');
  s.pace = fd.get('pace');
  s.stops = [0, 1, 2]
    .map(i => ({
      lap: Number(fd.get('stopLap' + i) || 0),
      compound: fd.get('stopCompound' + i) || 'medium',
      refuel: Number(fd.get('stopFuel' + i) || 0)
    }))
    .filter(p => p.lap > 0);
  return s;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  if (a.startsWith('session-')) {
    if (a === 'session-follow') {
      follow = b.dataset.id;
      followCamera = true;
      return;
    }
    await flushAutoSaves();
    await commandTail;
    if (
      [...autoJobs.values()].some(j => j.body.action === 'session-setup' && j.body.mode === testingMode())
    ) {
      toast('Attendi il salvataggio dell’assetto prima di inviare il comando.');
      return;
    }
    await command({ action: a, mode: testingMode(), slot: Number(b.dataset.slot || 0) }, { quiet: true });
    updateSessions();
    return;
  }
  if (a === 'list-page') {
    pagePositions[b.dataset.key] = Math.max(0, (pagePositions[b.dataset.key] || 0) + Number(b.dataset.step));
    if (tab === 'Gara') updateRace();
    else if (['Libere', 'Qualifiche'].includes(tab)) updateSessions();
    else if (tab === 'Paddock') updateCommunity();
    else {
      await flushAutoSaves();
      render();
    }
    return;
  }
  if (a === 'exit') {
    await exitGame();
    return;
  }
  if (a === 'rules') return openDialog(rulesHtml());
  if (a === 'debrief' && data.me?.lastDebrief) {
    try {
      localStorage.setItem('simulator-debrief-seen:' + data.viewer.id, data.me.lastDebrief.race);
    } catch {}
    b.classList.remove('primary');
    return openDialog(debriefHtml(data.me.lastDebrief));
  }
  if (a === 'preset') return applyPreset(Number(b.dataset.slot), b.dataset.key);
  if (a === 'help') {
    e.preventDefault();
    const [title, text] = HELP[b.dataset.help];
    return openDialog(
      `<div class="eyebrow">COME FUNZIONA</div><h2>${esc(title)}</h2><p>${esc(text)}</p>${button('rules', 'Apri il regolamento')}`
    );
  }
  if (a === 'fullscreen') {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else
      document.documentElement
        .requestFullscreen?.()
        .catch(() => toast('Usa lo schermo intero di Telegram o F11.'));
    return;
  }
  if (a === 'close') {
    await flushAutoSaves();
    return $('modal').close();
  }
  if (a === 'tab') {
    await flushAutoSaves();
    tab = b.dataset.tab;
    render();
    presence();
    return;
  }
  if (a === 'market-role') {
    tab = 'Team';
    marketRole = b.dataset.role;
    render();
    return;
  }
  if (a === 'create') return command({ action: 'create' });
  if (a === 'upgrade') return command({ action: 'upgrade', part: b.dataset.part });
  if (a === 'enroll') return command({ action: 'enroll', enrolled: b.dataset.value === 'true' });
  if (a === 'calendar-ready') return command({ action: a, ready: !data.approval?.ready });
  if (a === 'calendar-start') return command({ action: a });
  if (a === 'vote') return command({ action: 'vote', proposal: b.dataset.id });
  if (a === 'next-season') return command({ action: 'next-season' });
  if (a === 'hire') {
    const o = data.market.find(o => o.id === b.dataset.id);
    openDialog(
      `<div class="eyebrow">NUOVO CONTRATTO</div><h2>${esc(o.name)}</h2><p>Ingaggio ${money(o.fee)}${o.salary ? ' · stipendio ' + money(o.salary) + ' / GP' : ''}.</p>${o.role === 'driver' ? `<p class="muted">Scegli il posto. L’eventuale contratto precedente termina senza rimborso.</p><div class="two">${[0, 1].map(i => button('confirm-hire', 'Vettura ' + (i + 1) + ' · ' + esc(data.me.drivers[i]?.name || 'Libera'), `data-id="${o.id}" data-slot="${i}"`, 'primary')).join('')}</div>` : button('confirm-hire', 'Conferma ingaggio', `data-id="${o.id}" data-slot="0"`, 'primary')}`
    );
    return;
  }
  if (a === 'confirm-hire') {
    $('modal').close();
    return command({ action: 'hire', offer: b.dataset.id, slot: Number(b.dataset.slot) });
  }
  if (a === 'follow') {
    follow = b.dataset.id;
    followCamera = true;
    resetCamera();
    render();
    return;
  }
  if (a === 'camera') {
    followCamera = !followCamera;
    resetCamera();
    render();
    return;
  }
  if (a === 'camera-reset') {
    resetCamera();
    return;
  }
  if (a === 'live-plan') {
    const slot = Number(b.dataset.slot),
      c = data.race.cars.find(c => c.own && c.slot === slot);
    openDialog(
      `<h2>${esc(c.name)} · Piano live</h2><form data-form="live" data-slot="${slot}">${strategyFields(c.strategy)}<p class="muted">Ritmo e freni cambiano subito. Carico, mescola e rifornimento vengono applicati al prossimo ingresso ai box.</p><output data-save-status role="status">Le modifiche vengono trasmesse automaticamente</output></form>`
    );
    return;
  }
  if (a === 'pit') {
    await flushAutoSaves();
    await commandTail;
    if (autoJobs.size) {
      toast('Attendi il salvataggio del piano prima del rientro.');
      return;
    }
    const slot = Number(b.dataset.slot),
      c = data.race.cars.find(c => c.own && c.slot === slot);
    return command({ action: 'live', slot, strategy: c.strategy, pit: !c.pitRequested }, { quiet: true });
  }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const fd = new FormData(f),
    type = f.dataset.form;
  if (type === 'chat') {
    if (chatSending) return;
    const text = String(fd.get('text') || '').trim();
    if (!text) return;
    chatSending = true;
    const submit = f.querySelector('button');
    submit.disabled = true;
    const requestId = chatPending?.text === text ? chatPending.id : crypto.randomUUID();
    chatPending = { text, id: requestId };
    saveChatDraft(text);
    const ok = await command({ action: 'chat', text, requestId }, { quiet: true });
    chatSending = false;
    if (submit.isConnected) submit.disabled = false;
    if (ok) {
      chatPending = null;
      const input = document.querySelector('[data-form=chat] input');
      if (input?.value.trim() === text) {
        input.value = '';
        saveChatDraft('');
      }
      updateCommunity();
      formNotice(document.querySelector('[data-form=chat]'), 'Messaggio inviato e salvato ✓');
      toast('Messaggio inviato e salvato ✓');
    }
    return;
  }
  if (type === 'identity')
    return command({
      action: 'identity',
      name: fd.get('name'),
      count: Number(fd.get('count')),
      colors: [0, 1, 2].map(i => fd.get('color' + i))
    });
  if (type === 'strategy')
    return command({ action: 'strategy', slot: Number(f.dataset.slot), strategy: getStrategy(f) });
  if (type === 'live') {
    const slot = Number(f.dataset.slot),
      strategy = getStrategy(f),
      c = data.race.cars.find(c => c.own && c.slot === slot);
    return command({ action: 'live', slot, strategy }, { quiet: true });
  }
  if (type === 'session-setup') {
    rememberDraft(f);
    return flushAutoSaves();
  }
  if (type === 'proposal')
    return command({
      action: 'proposal',
      slots: fd
        .getAll('day')
        .map(Number)
        .map(day => ({
          day,
          times: [0, 1].slice(0, Number(fd.get('daily'))).map(n => fd.get('time-' + day + '-' + n))
        })),
      start: fd.get('start')
    });
});
for (const event of ['input', 'change'])
  document.addEventListener(event, e => {
    const form = e.target.closest('[data-form]');
    if (form) {
      if (form.dataset.form === 'proposal') updateAvailability(form);
      rememberDraft(form);
    }
  });
document.addEventListener('input', e => {
  const form = e.target.closest('[data-form="identity"]');
  if (!form) return;
  identityDirty = true;
  const fd = new FormData(form);
  $('livery').innerHTML = car({
    count: Number(fd.get('count')),
    colors: [0, 1, 2].map(i => fd.get('color' + i))
  });
});
function installSplitters() {
  const root = document.documentElement,
    mode = innerWidth <= 700 ? 'phone' : innerWidth <= 850 ? 'tablet' : 'desktop';
  for (const [id, key, axis] of [
    ['split-width', 'side', 'clientX'],
    ['split-height', 'bottom', 'clientY']
  ]) {
    const el = $(id);
    if (!el) continue;
    el._releaseDrag?.();
    const bounds = () => {
      const container =
        key === 'side'
          ? document.querySelector('.race-top,.session-stage')
          : document.querySelector('.session-layout') || $('main');
      const available =
        (key === 'side' ? container?.clientWidth : container?.clientHeight) ||
        (key === 'side' ? innerWidth : innerHeight - 100);
      return {
        min: Math.min(key === 'side' ? 110 : 120, available * 0.3),
        max: Math.max(
          60,
          Math.min(key === 'side' ? 600 : available * 0.6, available - (key === 'side' ? 150 : 100))
        )
      };
    };
    const storage = 'simulator-cockpit-v4-' + tab + '-' + mode + '-' + key;
    const current = () =>
      parseFloat(getComputedStyle(root).getPropertyValue('--' + key)) || (key === 'side' ? 220 : 180);
    const change = value => {
      const b = bounds(),
        n = Math.round(Math.max(b.min, Math.min(b.max, value)));
      root.style.setProperty('--' + key, n + 'px');
      el.setAttribute('aria-valuenow', n);
      el.setAttribute('aria-valuemin', Math.round(b.min));
      el.setAttribute('aria-valuemax', Math.round(b.max));
      try {
        localStorage.setItem(storage, n);
      } catch {}
    };
    let initial =
      key === 'bottom'
        ? Math.round((document.querySelector('.session-layout') || $('main')).clientHeight * 0.54)
        : current();
    try {
      initial = Number(localStorage.getItem(storage)) || initial;
    } catch {}
    change(initial);
    let drag = null;
    const move = e => {
      if (drag && e.pointerId === drag.pointer) change(drag.size + drag.at - e[axis]);
    };
    const end = () => {
      drag = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.classList.remove('panel-dragging');
    };
    el._releaseDrag = end;
    el.onpointerdown = e => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      drag = { at: e[axis], size: current(), pointer: e.pointerId };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      document.body.classList.add('panel-dragging');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    el.onlostpointercapture = end;
    el.onkeydown = e => {
      const keys = key === 'side' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
      if (keys.includes(e.key)) {
        e.preventDefault();
        change(current() + (e.key === keys[0] ? 10 : -10));
      }
    };
  }
}
window.addEventListener('pagehide', () => {
  persistView();
  persistAutoDrafts();
  if (token) api({ action: 'presence', visible: false }, { keepalive: true }).catch(() => {});
});
function frame() {
  if (opened && !document.hidden) {
    if (tab === 'Gara') draw(data, follow, followCamera, received);
    else if (['Libere', 'Qualifiche'].includes(tab)) draw(testingData(), follow, followCamera, received);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const lapTime = n => (n ? Math.floor(n / 60) + ':' + (n % 60).toFixed(3).padStart(6, '0') : '—');
const clock = n =>
  Math.floor(Math.max(0, n) / 60000) + ':' + String(Math.floor(Math.max(0, n) / 1000) % 60).padStart(2, '0');
function testingMode() {
  return tab === 'Libere' ? 'practice' : 'qualifying';
}
function testingData() {
  const ss = data.sessions,
    mode = testingMode(),
    v = ss?.[mode];
  return {
    ...data,
    race: {
      round: data.round,
      active: mode === 'practice' ? v?.cars.some(c => c.onTrack && c.speed > 0) : v?.active,
      cars: (v?.cars || []).map(c => ({ ...c, pitTime: c.onTrack ? 0 : 1 }))
    }
  };
}
function sessionsPage() {
  return `<div class="session-layout" data-no-resize="true"><div class="row session-heading"><div><div class="eyebrow">${esc(data.tracks[Math.min(data.round, 12)][0])} · ${tab === 'Libere' ? 'LIBERE DEL CAMPIONATO' : 'SESSIONE CONDIVISA'}</div><h2>${tab === 'Libere' ? 'Prove libere' : 'Qualifiche'}</h2></div><strong class="metric" id="session-clock"></strong><small id="session-state"></small><p id="session-info" class="session-hint"></p></div><div class="session-stage"><section class="track-wrap"><canvas id="track" aria-label="Circuito della sessione"></canvas><div class="track-overlay">${button('camera-reset', 'Centra pista')} ${button('tab', 'Box', 'data-tab="Box"')}</div></section><div class="split vertical" role="separator" tabindex="0" aria-label="Larghezza pannello informazioni" aria-orientation="vertical" id="split-width"></div><aside class="card scroll-card fit-panel"><h3>Tempi sul giro</h3><div class="scroll-body" id="session-leaders"></div><div id="session-reports"></div></aside></div><div class="split horizontal" role="separator" tabindex="0" aria-label="Altezza muretto" aria-orientation="horizontal" id="split-height"></div><div class="two session-drivers" id="session-drivers"></div></div>`;
}
function updateSessions() {
  if (!$('session-clock') || !data.sessions) return;
  const ss = data.sessions,
    mode = testingMode(),
    v = ss[mode],
    available = ss.eligible && (mode === 'practice' ? v.available && v.remaining > 0 : v.active);
  $('session-clock').textContent =
    mode === 'qualifying' && ss.start > data.now ? 'Tra ' + clock(ss.start - data.now) : clock(v.remaining);
  $('session-info').textContent =
    mode === 'practice'
      ? ss.raceDay
        ? 'Libere chiuse oggi: è giorno di gara.'
        : !ss.eligible
          ? 'Libere disponibili dopo la chiusura delle iscrizioni e la pubblicazione del calendario.'
          : `30 minuti totali per Gran Premio, senza rinnovo giornaliero. ${v.running ? 'Tempo in corso' : 'Tempo fermo'}. Alla chiusura il tempo si ferma; interruzione di rete rilevata entro 10 s. Giro di uscita non cronometrato.`
      : v.active
        ? 'Qualifiche in corso: tutti girano insieme. Dopo 10 s senza connessione la vettura torna ai box; il giro incompleto è annullato.'
        : ss.at
          ? `${v.finished ? 'Qualifiche concluse' : 'Qualifiche programmate'}: ${date(ss.start)} – ${date(ss.end)}. Gara ${date(ss.at)}. Chi non registra un tempo parte dietro.`
          : 'Il calendario deve essere approvato. Le qualifiche iniziano 30 minuti prima della gara e durano 20 minuti.';
  $('session-info').hidden = !!data.schedule && data.now >= data.schedule.dates[0];
  $('session-state').textContent =
    mode === 'practice'
      ? ss.raceDay
        ? 'Libere chiuse nel giorno di gara'
        : v.running
          ? 'Libere in corso'
          : 'Libere in pausa'
      : v.active
        ? 'Qualifiche LIVE'
        : v.finished
          ? 'Qualifiche concluse'
          : 'In attesa delle qualifiche';
  const cars = [...v.cars].sort((a, b) => (a.best || Infinity) - (b.best || Infinity));
  const page = paged(cars, 'session-leaders', isCompact() ? 40 : 3);
  $('session-leaders').innerHTML = cars.length
    ? page.items
        .map(
          (c, i) =>
            `<button class="leader" data-action="session-follow" data-id="${esc(c.id)}"><span>${pagePositions['session-leaders'] * (isCompact() ? 40 : 3) + i + 1}</span><span><b>${esc(c.name)}</b><small>${c.onTrack ? 'IN PISTA' : 'AI BOX'} · ${esc(c.teamName)}</small></span><span>${lapTime(c.best)}</span></button>`
        )
        .join('') + page.controls
    : '<p class="empty">Nessun giro registrato.</p>';
  updatePitwall(v, mode, available);
  updateSessionReports(v.cars, mode);
}
function getSessionSetup(f) {
  const n = k => Number(f.elements[k].value);
  return {
    wing: n('wing'),
    brake: n('brake'),
    fuel: n('fuel'),
    stintLaps: n('stintLaps'),
    compound: f.elements.compound.value,
    pace: f.elements.pace.value
  };
}
function sessionFields(st) {
  return `<div class="session-settings"><label>Carico aero<input name="wing" type="number" min="0" max="100" required value="${st.wing}"></label><label>Freni ant. %<input name="brake" type="number" min="45" max="65" required value="${st.brake}"></label><label>Benzina · kg<input name="fuel" type="number" min="10" max="110" required value="${st.fuel}"></label><label>Giri lanciati<input name="stintLaps" type="number" min="1" max="20" required value="${st.stintLaps}"></label><label>Mescola<select name="compound">${options(compounds, st.compound)}</select></label><label>Ritmo<select name="pace">${options({ save: 'Conserva', normal: 'Normale', push: 'Spingi' }, st.pace)}</select></label></div><output data-save-status role="status">Assetto · autosalvataggio</output>`;
}
function updatePitwall(v, mode, available) {
  const root = $('session-drivers'),
    key = mode + ':' + data.sessions.event;
  if (root.dataset.session !== key) {
    root.dataset.session = key;
    replacePanelContent(
      root,
      [0, 1]
        .map(
          slot =>
            `<section class="card session-car" data-car-slot="${slot}"><div class="eyebrow">◉ MURETTO · VETTURA ${slot + 1}</div><div class="row"><h3>${esc(data.me?.drivers[slot]?.name || 'Pilota ' + (slot + 1))}</h3><span class="tag" data-session-status></span></div><div class="telemetry" data-session-telemetry></div><div class="row session-actions" data-session-actions></div><p class="muted" data-session-reason></p><form data-form="session-setup" data-mode="${mode}" data-event="${data.sessions.event}" data-slot="${slot}">${sessionFields(data.sessions.setups?.[mode]?.[slot] || { wing: 50, brake: 55, fuel: 30, stintLaps: 3, compound: 'medium', pace: 'normal' })}</form><details><summary>Giri registrati in questa sessione</summary><div data-session-history></div></details></section>`
        )
        .join('')
    );
    restoreDrafts();
  }
  for (const card of root.querySelectorAll('[data-car-slot]')) {
    const slot = Number(card.dataset.carSlot),
      c = v.cars.find(c => c.own && c.slot === slot),
      f = card.querySelector('form'),
      st = data.sessions.setups?.[mode]?.[slot];
    card.querySelector('[data-session-status]').textContent = c?.onTrack
      ? c.pitRequested
        ? 'RIENTRO A FINE GIRO'
        : c.outLap
          ? 'GIRO DI USCITA'
          : `GIRO LANCIATO ${(c.runLaps || 0) + 1} / ${c.targetLaps || '—'}`
      : 'AI BOX';
    const values = [
      ['Migliore', lapTime(c?.best)],
      ['Ultimo giro', lapTime(c?.lastLap)],
      ['Velocità', c ? Math.round(c.speed) + ' km/h' : '—'],
      ['Carburante', c ? c.fuel.toFixed(1) + ' kg' : '—'],
      ['Consumo/giro', c ? (c.consumption || 0).toFixed(2) + ' kg' : '—'],
      ['Autonomia', c?.consumption ? (c.fuel / c.consumption).toFixed(1) + ' giri' : '—'],
      ['Gomma residua', c ? c.wear.toFixed(0) + '%' : '—'],
      ['Temperatura', c?.temperature ? c.temperature.toFixed(0) + ' °C' : '—'],
      ['Grip', c?.grip ? c.grip.toFixed(0) + '%' : '—']
    ];
    card.querySelector('[data-session-telemetry]').innerHTML = values
      .map(([label, value]) => `<div><small>${label}</small><b>${value}</b></div>`)
      .join('');
    card.querySelector('[data-session-actions]').innerHTML =
      button(
        c?.onTrack ? 'session-pit' : 'session-start',
        c?.onTrack ? 'Rientra' : 'Esci in pista',
        `data-slot="${slot}" ${!available || c?.pitRequested ? 'disabled' : ''}`,
        'primary'
      ) +
      (c?.onTrack
        ? button('session-extend', 'Allunga +1', `data-slot="${slot}" ${!available ? 'disabled' : ''}`)
        : '') +
      (mode === 'practice'
        ? button(
            v.running ? 'session-pause' : 'session-resume',
            v.running ? 'Pausa libere' : 'Riprendi libere',
            !available ? 'disabled' : ''
          )
        : '');
    card.querySelector('[data-session-reason]').textContent =
      (c?.pendingSetup ? '● Modifiche programmate al rientro. ' : '') +
      (c?.reason ? c.reason + '. ' : '') +
      (c?.onTrack
        ? 'Ritmo e freni subito. Gli altri valori sono programmati per il rientro.'
        : 'Uscita dai box + giri lanciati impostati.');
    if (st && !drafts.has(formKey(f)) && !f.contains(document.activeElement))
      for (const [name, value] of Object.entries(st)) if (f.elements[name]) f.elements[name].value = value;
    for (const el of f.elements) if (el.name) el.disabled = !available;
    card.querySelector('[data-session-history]').innerHTML =
      (c?.history || [])
        .slice(0, 5)
        .map(
          h =>
            `<p>${lapTime(h.time)} · ${h.consumption.toFixed(2)} kg/giro · usura ${h.wearPerLap.toFixed(1)}% · carico ${h.wing} · freni ${h.brake}% · ${esc(h.compound)}</p>`
        )
        .join('') || '<p>Nessun giro lanciato completato.</p>';
  }
}

function telemetryPage() {
  const report = data.engineering;
  if (!report || report.drivers.every(d => !d))
    return '<div class="notice">Completa piloti, tecnici e motore per ricevere le previsioni.</div>';
  return `<div class="row"><h2>Telemetria e reparto tecnico</h2>${button('tab', 'Vai alle libere', 'data-tab="Libere"')}</div><div class="notice">Obiettivo durata 35–45 minuti in condizioni normali · Gara: ${report.laps} giri · ${report.distance.toFixed(1)} km · limite massimo ${report.maxMinutes} minuti. Le durate e i consumi sotto sono stime del modello, non risultati garantiti. I dati registrati sono disponibili dopo i giri delle libere ufficiali.</div><div class="two">${report.drivers.map((d, i) => (d ? `<section class="card"><div class="eyebrow">VETTURA ${i + 1}</div><h3>${esc(d.name)}</h3><div class="stats"><div><small>CONSUMO / GIRO</small><b>${d.consumption.toFixed(2)} kg</b></div><div><small>USURA / GIRO</small><b>${d.wearPerLap.toFixed(1)}%</b></div><div><small>DURATA GARA STIMATA</small><b>≈ ${d.raceMinutes.toFixed(0)} min</b></div></div><p>Giro stimato ${lapTime(d.lapEstimate)} · autonomia iniziale ${d.fuelRange} giri · circa ${d.stops} soste.</p><p class="muted">${esc(d.confidence || 'Stima preliminare')} · margine indicativo ±${((d.uncertainty || 0.1) * 100).toFixed(0)}% · senza traffico. ${d.dnf ? '⚠ Piano insufficiente per terminare.' : `Carburante previsto all’arrivo: ${(d.finishFuel || 0).toFixed(1)} kg.`}</p><div class="projection-comparison">${(d.alternatives || []).map(a => `<span>${esc(a.label)}<br><b>${a.dnf ? 'Non termina' : (a.seconds / 60).toFixed(1) + ' min'}</b> · soste effettive ${a.stops}</span>`).join('')}</div><details open><summary>Consigli dei tecnici</summary>${d.advice.map(a => `<article class="feed-item"><b>${esc(a.role)}${a.name ? ' · ' + esc(a.name) : ''}</b><p>${esc(a.text)}</p></article>`).join('')}</details><details><summary>Giri registrati</summary>${d.measured.length ? `<table><thead><tr><th>Tempo</th><th>kg/giro</th><th>Usura/giro</th><th>Carico</th></tr></thead><tbody>${d.measured.map(h => `<tr><td>${lapTime(h.time)}</td><td>${h.consumption.toFixed(2)}</td><td>${h.wearPerLap.toFixed(1)}%</td><td>${h.wing}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nessun giro registrato: stime preliminari dei tecnici.</p>'}</details></section>` : '')).join('')}</div>`;
}
function standingsTable(rows, drivers = false, key = drivers ? 'driver-table' : 'team-table') {
  const page = paged(rows, key, 4);
  return `<table><thead><tr><th>Pos.</th><th>${drivers ? 'Pilota / Scuderia' : 'Scuderia'}</th><th>Punti</th><th>Premio</th></tr></thead><tbody>${page.items.map(r => `<tr><td>${r.position}</td><td>${esc(r.name)}${drivers ? '<br><small>' + esc(r.teamName) + '</small>' : ''}</td><td><b>${r.points}</b>${r.points !== r.confirmed ? '<small> (' + r.confirmed + ' confermati)</small>' : ''}</td><td>${r.reward ? money(r.reward) : '—'}</td></tr>`).join('')}</tbody></table>${page.controls}`;
}
function eventPage() {
  const archive = paged(data.archives || [], 'archives', 1);
  return `<div class="event-workspace"><div id="event-live"></div><aside class="event-extra"><section class="card fit-panel"><h3>Premi · cassa unica</h3><p class="muted">Piloti e costruttori: entrambi nella cassa della scuderia.</p><table><thead><tr><th>Pos.</th><th>Team</th><th>Pilota</th></tr></thead><tbody>${(data.prizes?.teams || []).map((n, i) => `<tr><td>${i + 1}</td><td>${money(n)}</td><td>${money(data.prizes.drivers[i])}</td></tr>`).join('')}</tbody></table></section><section class="card fit-panel"><h3>Archivio campionati</h3>${
    archive.items
      .map(
        a =>
          `<details><summary>Stagione ${a.season} · ${date(a.ended)}</summary><h3>Costruttori</h3>${standingsTable(a.standings.teams, false, 'archive-team')}<h3>Piloti</h3>${standingsTable(a.standings.drivers, true, 'archive-driver')}<h3>Gare archiviate</h3>${a.results
            .map(
              r =>
                `<details><summary>${esc(data.tracks[r.round][0])} · ${date(r.at)}</summary>${standingsTable(
                  r.rows.map(c => ({ ...c, confirmed: c.points, reward: 0 })),
                  false,
                  'archive-race-' + r.round
                )}</details>`
            )
            .join('')}</details>`
      )
      .join('') || '<p class="muted">Archivio disponibile dopo la tredicesima gara.</p>'
  }${archive.controls}</section></aside></div>`;
}
function updateEventBoard() {
  const el = $('event-live');
  if (!el) return;
  const t = data.championship || { drivers: [], teams: [] },
    entrants = paged(
      data.teams.filter(t => (data.schedule ? data.schedule.participants.includes(t.id) : t.enrolled)),
      'entrants',
      4
    ),
    calendar = paged(
      (data.schedule?.dates || []).map((at, i) => ({ at, i })),
      'event-calendar',
      4
    );
  el.innerHTML = `<div class="row"><h2>Stagione ${data.season}</h2><span class="tag">${data.schedule ? 'ISCRIZIONI CHIUSE' : 'ISCRIZIONI APERTE'}</span></div><small>${t.provisional ? 'Classifica LIVE provvisoria' : 'Classifica ufficiale'} · Punti: 25–18–15–12–10–8–6–4–2–1</small><div class="event-panels"><section class="card fit-panel"><h3>Scuderie iscritte</h3>${entrants.items.map(t => `<div class="feed-item"><b>${esc(t.name)}</b><small> · ${esc(t.principal)}</small><p>${t.drivers.map(d => esc(d?.name || 'Posto libero')).join(' / ')}</p></div>`).join('') || 'Nessun iscritto.'}${entrants.controls}</section><section class="card fit-panel"><h3>Calendario ufficiale</h3>${data.schedule ? `<table><thead><tr><th>GP</th><th>Qualifiche</th><th>Gara</th></tr></thead><tbody>${calendar.items.map(({ at, i }) => `<tr><td>${esc(data.tracks[i][0])}</td><td>${date(at - 1800000)}</td><td>${date(at)}<br>${data.trackLaps?.[i] || data.laps} giri · ${i < data.round ? 'Conclusa' : i === data.round && data.race?.active ? 'LIVE' : 'In programma'}</td></tr>`).join('')}</tbody></table>${calendar.controls}` : '<p>Accetta proposta → Pronto! → Si parte!!</p>' + button('tab', 'Vai alla votazione', 'data-tab="Campionato"')}</section><section class="card fit-panel"><h3>Classifica piloti</h3>${standingsTable(t.drivers, true)}</section><section class="card fit-panel"><h3>Classifica scuderie</h3>${standingsTable(t.teams)}</section></div>`;
}

window.addEventListener('resize', () => {
  if (['Gara', 'Libere', 'Qualifiche'].includes(tab) && $('split-height') && !isCompact()) installSplitters();
});

// The host sends {system, content} objects, not a numeric inset. Keep both layers.
function applySimulatorInsets(insets = {}) {
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const value = insets[side],
      valid = n => (Number.isFinite(n) ? Math.max(0, Math.min(180, n)) : 0);
    const n = typeof value === 'number' ? valid(value) : valid(value?.system) + valid(value?.content);
    document.documentElement.style.setProperty('--safe-' + side, n + 'px');
  }
}
function fitSimulatorViewport() {
  const height = Math.min(innerHeight, window.visualViewport?.height || innerHeight);
  document.documentElement.style.setProperty('--simulator-height', Math.max(1, height) + 'px');
}
let navigatingBack = false;
async function exitGame() {
  persistView();
  persistAutoDrafts();
  await flushAutoSaves();
  await commandTail;
  persistAutoDrafts();
  if (token) api({ action: 'presence', visible: false }, { keepalive: true }).catch(() => {});
  parent.postMessage({ type: 'arcade:exit' }, location.origin);
}
async function navigateBack() {
  if (navigatingBack) return;
  navigatingBack = true;
  try {
    if ($('modal').open) {
      await flushAutoSaves();
      $('modal').close();
      return;
    }
    const connected = document.querySelector('.connected[open]');
    if (connected) {
      connected.open = false;
      return;
    }
    if (opened && tab !== 'Paddock') {
      await flushAutoSaves();
      tab = 'Paddock';
      render();
      return;
    }
    await exitGame();
  } finally {
    navigatingBack = false;
  }
}
$('modal').addEventListener('cancel', e => {
  e.preventDefault();
  navigateBack();
});
window.visualViewport?.addEventListener('resize', fitSimulatorViewport);
window.addEventListener('resize', fitSimulatorViewport);
fitSimulatorViewport();
