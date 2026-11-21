(() => {
  const $ = id => document.getElementById(id),
    plain = $('radio-audio'),
    screen = $('radio-panel'),
    toggle = $('radio-toggle'),
    play = $('radio-play'),
    bigPlay = $('radio-play-big'),
    label = $('radio-label'),
    status = $('radio-status'),
    star = $('radio-favorite'),
    volume = $('radio-volume'),
    list = $('radio-list'),
    search = $('radio-search'),
    more = $('radio-more');
  // Second player for stations that allow analysis (CORS): its sound goes through Web Audio, so the
  // equaliser follows the music. Other stations keep the plain player: routing them would mute them.
  const fx = document.createElement('audio');
  fx.preload = 'none';
  fx.setAttribute('playsinline', '');
  fx.crossOrigin = 'anonymous';
  plain.after(fx);
  let audio = plain,
    ctx = null,
    analyser = null,
    bins = null,
    bands = [],
    fxFailed = new Set();
  // HLS (.m3u8): the browser's own HLS player hands Web Audio only silence (desktop Chrome). Played through
  // hls.js (Media Source) the analyser receives the real sound. Loaded on demand; plain player if it fails.
  const isHls = url => /\.m3u8?($|[?#])/i.test(url);
  let hls = null,
    hlsLoader = null;
  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!window.MediaSource) return Promise.reject(Error('no MSE'));
    hlsLoader ??= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/hls.min.js?v=7c47cd97d7';
      s.async = true;
      s.onload = () => (window.Hls ? resolve(window.Hls) : reject(Error()));
      s.onerror = () => {
        hlsLoader = null;
        reject(Error());
      };
      document.head.append(s);
    });
    return hlsLoader;
  }
  function dropHls() {
    if (hls) {
      try {
        hls.destroy();
      } catch {}
      hls = null;
    }
  }
  const CENTERS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const hosts = [
    'https://de1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info'
  ];
  function readLocal(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
  function saveLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
  function normalize(raw) {
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null;
    // The page is HTTPS, so only HTTPS audio can play. Stations listed as http:// are tried as https://
    // on the same address: many servers answer both (Rai, 105, R101…). Real https URLs come first.
    const candidates = [...(Array.isArray(raw.urls) ? raw.urls : []), raw.url_resolved, raw.url].filter(
      x => typeof x === 'string' && x.length <= 2048
    );
    const secure = x => {
      try {
        const u = new URL(x);
        if (u.protocol === 'https:') return u.href;
        if (u.protocol === 'http:') {
          u.protocol = 'https:';
          return u.href;
        }
      } catch {}
      return null;
    };
    const urls = [
      ...new Set(
        [...candidates.filter(x => /^https:/i.test(x)), ...candidates.filter(x => /^http:/i.test(x))]
          .map(secure)
          .filter(Boolean)
      )
    ];
    if (!urls.length) return null;
    const tags = (
      typeof raw.tags === 'string' ? raw.tags.split(',') : Array.isArray(raw.tags) ? raw.tags : []
    )
      .map(t => String(t).trim())
      .filter(Boolean)
      .slice(0, 3);
    return {
      id: String(raw.id || raw.stationuuid || urls[0]),
      name: raw.name.trim().slice(0, 80),
      urls,
      country: String(raw.country || raw.countrycode || '').slice(0, 40),
      tags,
      // Radio Browser's last check failed: still listed (it may be back), marked in the list.
      down: raw.down === true || raw.lastcheckok === 0
    };
  }
  const stored = readLocal('binottoland-radio-favorites', []);
  let favorites = (Array.isArray(stored) ? stored : []).map(normalize).filter(Boolean),
    current = normalize(readLocal('binottoland-radio-last', null));
  // Lists: Italy and world loaded on demand; search results replace the list while the field has text.
  const lists = { it: [], world: [] },
    loadedList = { it: false, world: false };
  let tab = readLocal('binottoland-radio-tab', favorites.length ? 'fav' : 'it'),
    results = null,
    shown = 60,
    searchTimer = null,
    searchSerial = 0;
  let loading = false,
    streamIndex = 0,
    attempt = 0,
    watchdog,
    wantsPlay = false,
    pending = false,
    playbackMessage = '',
    directoryMessage = '';
  const saved = Number(readLocal('binottoland-radio-volume', 0.7)),
    startVolume = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.7;
  plain.volume = fx.volume = startVolume;
  volume.value = String(startVolume);
  let track = '',
    metadataEpoch = 0,
    metadataTimer = null,
    metadataPending = false,
    metadataMisses = 0;
  const trackBox = $('radio-now-playing'),
    trackLabel = $('radio-track'),
    nowName = $('radio-now-name'),
    nowTrack = $('radio-now-track');
  // Radio bar: one scrolling line with station · song · description · genre (whatever the stream sends).
  let streamInfo = null;
  function showTrack(data) {
    const title = typeof data === 'string' ? data : data?.title;
    track = typeof title === 'string' ? title.trim().slice(0, 240) : '';
    trackLabel.textContent = track;
    streamInfo = data && typeof data === 'object' ? data : null;
    nowTrack.textContent = [track, streamInfo?.description, streamInfo?.genre].filter(Boolean).join(' · ');
    trackBox.hidden = true;
    renderMarquee();
  }
  function renderMarquee() {
    const seen = new Set(),
      parts = [];
    // Catalogue info (country, genres) is always there, so the line has content even without a song.
    const catalogue = current
      ? [current.country, (current.tags || []).join(', ')].filter(Boolean).join(' · ')
      : '';
    for (const part of [
      current?.name || 'Radio',
      wantsPlay ? track : '',
      wantsPlay ? streamInfo?.name : '',
      wantsPlay ? streamInfo?.description : '',
      wantsPlay && streamInfo?.genre ? 'Genere: ' + streamInfo.genre : '',
      catalogue
    ])
      if (part && !seen.has(part.toLowerCase())) {
        seen.add(part.toLowerCase());
        parts.push(part);
      }
    const text = parts.join('   •   ');
    if (label.dataset.text === text) return;
    label.dataset.text = text;
    const inner = document.createElement('span');
    inner.className = 'marquee-inner';
    inner.textContent = text;
    label.replaceChildren(inner);
    // Scroll only when it does not fit; the text is doubled so the loop is seamless.
    const fit = () => {
      label.classList.remove('marquee');
      inner.textContent = text;
      const overflow = inner.scrollWidth > label.clientWidth + 2;
      label.classList.toggle('marquee', overflow);
      if (overflow) {
        inner.textContent = text + '   •   ' + text + '   •   ';
        label.style.setProperty('--marquee-duration', Math.max(10, text.length * 0.28) + 's');
      }
    };
    fit();
    requestAnimationFrame(fit);
  }
  function stopMetadata(clear = true) {
    metadataEpoch++;
    metadataMisses = 0;
    clearTimeout(metadataTimer);
    metadataTimer = null;
    metadataPending = false;
    if (clear) showTrack('');
  }
  async function loadMetadata() {
    clearTimeout(metadataTimer);
    metadataTimer = null;
    if (
      !wantsPlay ||
      document.hidden ||
      !allowed() ||
      !current ||
      metadataPending ||
      typeof window.binottolandRadioMetadata !== 'function'
    )
      return;
    const epoch = metadataEpoch,
      station = current.id;
    metadataPending = true;
    try {
      const data = await window.binottolandRadioMetadata(station);
      if (epoch === metadataEpoch && current?.id === station && wantsPlay) showTrack(data);
    } catch {
      if (epoch === metadataEpoch) showTrack('');
    } finally {
      // No song yet (just connected, or a request too close to the previous one): retry soon, then every minute.
      if (epoch === metadataEpoch) {
        metadataPending = false;
        metadataMisses = track ? 0 : metadataMisses + 1;
        if (wantsPlay && !document.hidden)
          metadataTimer = setTimeout(loadMetadata, !track && metadataMisses <= 4 ? 15000 : 60000);
      }
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMetadata(false);
    else if (wantsPlay) {
      loadMetadata();
      startViz();
    }
  });
  const allowed = () => !$('app-shell').hidden;

  // Equaliser: 10 octave bands (bass left, treble right) in the character's shirt and shorts colours.
  const vizzes = [...document.querySelectorAll('.radio-viz')],
    bars = vizzes.map(v => [...v.children]);
  function applyColors() {
    const outfit = readLocal('labyrinth-appearance', null),
      hex = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
    for (const v of vizzes) {
      v.style.setProperty('--viz-a', hex(outfit?.shirt) || '#66b8cf');
      v.style.setProperty('--viz-b', hex(outfit?.shorts) || '#3c62a3');
    }
  }
  applyColors();
  addEventListener('storage', applyColors);
  let frame = 0,
    tick = 0,
    silentFrames = 0;
  const peaks = CENTERS.map(() => 0.12),
    floors = CENTERS.map(() => 0);
  const setBars = values => {
    for (const set of bars) set.forEach((bar, i) => (bar.style.transform = `scaleY(${values[i]})`));
  };
  // When the sound cannot be analysed: a simulated spectrum shaped like music, a kick every beat (~120 bpm)
  // in the bass, a snare on the off-beat in the mids, lively treble; fast rise and slow fall like a real meter.
  const fake = CENTERS.map(() => 0.2);
  let beatAt = 0,
    nextBeat = 0,
    period = 500;
  function fakeBars(now) {
    if (now >= nextBeat) {
      beatAt = now;
      period = 480 + Math.random() * 60;
      nextBeat = now + period;
    }
    const since = now - beatAt,
      kick = Math.exp(-since / 120),
      snare = Math.exp(-Math.abs(since - period / 2) / 90);
    return fake.map((v, i) => {
      const low = Math.max(0, 1 - i / 4),
        mid = Math.max(0, 1 - Math.abs(i - 5) / 2.5),
        high = Math.max(0, (i - 5) / 4);
      const target = Math.min(
        1,
        0.16 +
          0.72 * low * kick +
          0.5 * mid * snare +
          Math.random() * (0.12 + 0.22 * mid + 0.3 * high) +
          0.1 * low * (1 - kick)
      );
      fake[i] = target > v ? v + (target - v) * 0.55 : v + (target - v) * 0.1;
      return fake[i].toFixed(3);
    });
  }
  function drawViz() {
    frame = 0;
    if (!vizzes.length) return;
    if (++tick % 60 === 0) applyColors();
    const live = wantsPlay && !pending && !document.hidden;
    if (live && audio === fx && analyser) {
      analyser.getByteFrequencyData(bins);
      // Some streams (e.g. HLS on desktop Chrome) reach Web Audio as pure zeros: after ~2 s switch to the beat animation.
      let any = false;
      for (let k = 1; k < bins.length; k += 8)
        if (bins[k]) {
          any = true;
          break;
        }
      silentFrames = any ? 0 : silentFrames + 1;
    }
    if (live && audio === fx && analyser && silentFrames < 45) {
      // Each band is scaled to its own recent range (slow-falling peak, slow-rising floor), so mids and
      // treble move as much as the bass even on stations with little high-frequency energy.
      setBars(
        bands.map(([a, b], i) => {
          let sum = 0;
          for (let k = a; k <= b; k++) sum += bins[k];
          const v = sum / (b - a + 1) / 255;
          peaks[i] = Math.max(v, peaks[i] * 0.996, 0.12);
          floors[i] = v < floors[i] ? v : floors[i] + (v - floors[i]) * 0.003;
          const level = Math.max(0, Math.min(1, (v - floors[i]) / Math.max(0.08, peaks[i] - floors[i])));
          return (0.18 + 0.82 * Math.pow(level, 1.3)).toFixed(3);
        })
      );
      for (const v of vizzes) v.dataset.mode = 'live';
    } else if (live) {
      setBars(fakeBars(performance.now()));
      for (const v of vizzes) v.dataset.mode = 'beat';
    } else {
      setBars(CENTERS.map(() => 0.25));
      for (const v of vizzes) v.dataset.mode = '';
      return;
    }
    frame = requestAnimationFrame(drawViz);
  }
  function startViz() {
    applyColors();
    if (!frame) frame = requestAnimationFrame(drawViz);
  }
  window.binottolandRadioLevels = () =>
    audio === fx && analyser ? (analyser.getByteFrequencyData(bins), [...bins]) : null;
  function ensureGraph() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const source = ctx.createMediaElementSource(fx);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      bins = new Uint8Array(analyser.frequencyBinCount);
      const hz = ctx.sampleRate / analyser.fftSize;
      bands = CENTERS.map(c => {
        const a = Math.max(1, Math.floor(c / Math.SQRT2 / hz)),
          b = Math.min(bins.length - 1, Math.max(a, Math.ceil((c * Math.SQRT2) / hz)));
        return [a, b];
      });
      return true;
    } catch {
      ctx = null;
      analyser = null;
      return false;
    }
  }

  // Full-screen radio: search, tabs, station list with favourites. No pop-ups.
  const isFav = station => !!station && favorites.some(s => s.id === station.id);
  function toggleFav(station) {
    if (!station) return;
    favorites = isFav(station) ? favorites.filter(s => s.id !== station.id) : [...favorites, station];
    saveLocal('binottoland-radio-favorites', favorites);
    renderList();
    update();
  }
  function stationsInView() {
    if (results) return results;
    return tab === 'fav' ? favorites : lists[tab];
  }
  function renderList() {
    for (const b of document.querySelectorAll('[data-radio-tab]')) {
      const on = !results && b.dataset.radioTab === tab;
      b.setAttribute('aria-selected', String(on));
      b.classList.toggle('active', on);
    }
    const all = stationsInView(),
      page = all.slice(0, shown);
    list.replaceChildren(
      ...page.map(station => {
        const row = document.createElement('div');
        row.className = 'radio-row' + (current?.id === station.id ? ' playing' : '');
        row.setAttribute('role', 'listitem');
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'radio-pick';
        const name = document.createElement('strong');
        name.textContent = station.name;
        const info = document.createElement('small');
        info.textContent =
          (station.down ? '⚠ ultimo controllo non riuscito · ' : '') +
          ([station.country, ...(station.tags || [])].filter(Boolean).join(' · ') || 'Radio');
        if (station.down) row.classList.add('down');
        pick.append(name, info);
        pick.onclick = () => {
          current = station;
          saveLocal('binottoland-radio-last', current);
          streamIndex = 0;
          startStream();
          renderList();
        };
        const fav = document.createElement('button');
        fav.type = 'button';
        fav.className = 'radio-star';
        fav.textContent = isFav(station) ? '★' : '☆';
        fav.setAttribute(
          'aria-label',
          (isFav(station) ? 'Rimuovi dai' : 'Aggiungi ai') + ' preferiti: ' + station.name
        );
        fav.onclick = () => toggleFav(station);
        row.append(pick, fav);
        return row;
      })
    );
    // More is available while there are unseen stations loaded, or further pages on Radio Browser.
    const morePages = results
      ? !searchDone
      : tab !== 'fav' && !!paging[tab] && !paging[tab].done && loadedList[tab];
    more.hidden = all.length <= shown && !morePages;
    if (!all.length && !loading) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = results
        ? 'Nessuna radio trovata.'
        : tab === 'fav'
          ? 'Nessun preferito: tocca ☆ accanto a una radio.'
          : 'Elenco vuoto: tocca Aggiorna elenco.';
      list.append(p);
    }
  }
  async function query(path) {
    for (const host of hosts) {
      try {
        const r = await fetch(host + path, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw Error();
        const data = await r.json();
        if (!Array.isArray(data)) throw Error();
        const unique = new Map();
        for (const raw of data) {
          const s = normalize(raw);
          if (s && !unique.has(s.id)) unique.set(s.id, s);
        }
        return [...unique.values()];
      } catch {}
    }
    throw Error('Elenco non raggiungibile.');
  }
  // Pages of 500 from Radio Browser, most listened first; "Mostra altre" fetches the next page at the end.
  // Every station of the catalogue: http ones are upgraded to https, those failing the last check are marked.
  const PAGE = 500,
    base = 'order=clickcount&reverse=true&limit=' + PAGE;
  const QUERY = {
    it: offset => `/json/stations/search?countrycode=IT&${base}&offset=${offset}`,
    world: offset => `/json/stations/search?${base}&offset=${offset}`
  };
  const paging = { it: { offset: 0, done: false }, world: { offset: 0, done: false } };
  const addUnique = (into, items) => {
    const seen = new Set(into.map(s => s.id));
    for (const s of items)
      if (!seen.has(s.id)) {
        seen.add(s.id);
        into.push(s);
      }
    return into;
  };
  async function loadList(which, force = false) {
    if (which === 'fav' || (loadedList[which] && !force) || loading || !allowed()) return;
    if (force) {
      lists[which] = [];
      paging[which] = { offset: 0, done: false };
      shown = 60;
    }
    await nextPage(which);
    loadedList[which] = true;
  }
  async function nextPage(which) {
    const p = paging[which];
    if (!p || p.done || loading) return;
    loading = true;
    directoryMessage = 'Caricamento radio…';
    update();
    renderList();
    try {
      const page = await query(QUERY[which](p.offset));
      p.offset += PAGE;
      p.done = page.length === 0;
      addUnique(lists[which], page);
      directoryMessage = lists[which].length + ' radio';
    } catch (e) {
      directoryMessage = e.message + ' Riprova.';
    } finally {
      loading = false;
      update();
      renderList();
    }
  }
  // Search by name and by genre/tag, merged, also in pages.
  let searchQuery = '',
    searchOffset = 0,
    searchDone = false;
  async function searchPage(serial) {
    const enc = encodeURIComponent(searchQuery),
      off = searchOffset;
    const [byName, byTag] = await Promise.all([
      query(
        `/json/stations/search?name=${enc}&${base.replace('limit=' + PAGE, 'limit=300')}&offset=${off}`
      ).catch(() => []),
      query(
        `/json/stations/search?tag=${enc}&${base.replace('limit=' + PAGE, 'limit=300')}&offset=${off}`
      ).catch(() => [])
    ]);
    if (serial !== searchSerial) return;
    searchOffset += 300;
    searchDone = byName.length < 300 && byTag.length < 300;
    addUnique(results, [...byName, ...byTag]);
  }
  async function runSearch(text) {
    const serial = ++searchSerial,
      q = text.trim();
    if (q.length < 2) {
      results = null;
      directoryMessage = '';
      shown = 60;
      update();
      renderList();
      return;
    }
    searchQuery = q;
    searchOffset = 0;
    searchDone = false;
    results = [];
    shown = 60;
    directoryMessage = 'Ricerca…';
    update();
    renderList();
    try {
      await searchPage(serial);
    } catch {
      if (serial === searchSerial) directoryMessage = 'Ricerca non riuscita. Riprova.';
    }
    if (serial === searchSerial) {
      directoryMessage = results.length
        ? results.length + (searchDone ? '' : '+') + ' radio trovate'
        : 'Nessuna radio trovata.';
      update();
      renderList();
    }
  }
  // Quick genres: one tap searches by tag.
  for (const b of document.querySelectorAll('[data-radio-genre]'))
    b.onclick = () => {
      search.value = b.dataset.radioGenre;
      clearTimeout(searchTimer);
      runSearch(search.value);
    };
  search.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(search.value), 400);
  };
  search.onkeydown = e => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimer);
      runSearch(search.value);
      search.blur();
    }
  };
  for (const b of document.querySelectorAll('[data-radio-tab]'))
    b.onclick = () => {
      tab = b.dataset.radioTab;
      saveLocal('binottoland-radio-tab', tab);
      search.value = '';
      results = null;
      shown = 60;
      directoryMessage = '';
      renderList();
      update();
      loadList(tab);
    };
  // Show 60 more; at the end of what is loaded, fetch the next page first.
  more.onclick = async () => {
    const all = stationsInView();
    if (shown >= all.length) {
      if (results && !searchDone) {
        const serial = searchSerial;
        directoryMessage = 'Ricerca…';
        update();
        await searchPage(serial);
        directoryMessage = results.length + (searchDone ? '' : '+') + ' radio trovate';
      } else if (!results && paging[tab]) await nextPage(tab);
    }
    shown += 60;
    renderList();
    update();
  };
  $('radio-reload').onclick = () => {
    if (results) runSearch(search.value);
    else loadList(tab, true);
  };
  function openScreen() {
    if (!allowed()) return;
    screen.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('radio-open');
    renderList();
    loadList(tab);
  }
  function closeScreen() {
    screen.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('radio-open');
  }
  toggle.onclick = () => (screen.hidden ? openScreen() : closeScreen());
  $('radio-close').onclick = closeScreen;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !screen.hidden) closeScreen();
  });

  function update() {
    renderMarquee();
    nowName.textContent = current ? current.name : 'Scegli una radio';
    const favorite = isFav(current);
    star.textContent = favorite ? '★' : '☆';
    star.setAttribute('aria-pressed', String(favorite));
    star.setAttribute('aria-label', favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti');
    star.disabled = !current;
    for (const b of [play, bigPlay]) {
      b.textContent = wantsPlay ? 'Ⅱ' : '▶';
      b.setAttribute('aria-label', wantsPlay ? 'Pausa radio' : 'Avvia radio');
      b.setAttribute('aria-pressed', String(wantsPlay));
      b.setAttribute('aria-busy', String(pending));
    }
    status.textContent = playbackMessage || directoryMessage;
    trackBox.hidden = true;
    document.documentElement.classList.toggle('radio-playing', wantsPlay && !pending);
    if (wantsPlay && !pending) startViz();
    else if (!frame) drawViz();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState =
          wantsPlay && !pending ? 'playing' : current ? 'paused' : 'none';
      } catch {}
    }
  }
  function silence(el) {
    if (el === fx) dropHls();
    el.pause();
    el.removeAttribute('src');
    el.load();
  }
  function stop(message = 'Radio in pausa.') {
    stopMetadata();
    wantsPlay = false;
    pending = false;
    attempt++;
    clearTimeout(watchdog);
    audio.pause();
    if (hls) silence(fx);
    playbackMessage = message;
    update();
  }
  function nextStream(serial = attempt) {
    if (serial !== attempt || !wantsPlay) return;
    clearTimeout(watchdog);
    // The analysable player failed (often: no CORS). Retry the same stream on the plain player first.
    const url = current?.urls[streamIndex];
    if (audio === fx && url && !fxFailed.has(url)) {
      fxFailed.add(url);
      startStream();
      return;
    }
    if (current && streamIndex + 1 < current.urls.length) {
      streamIndex++;
      startStream();
      return;
    }
    stop('Radio non raggiungibile. Scegli un’altra stazione.');
  }
  function armWatchdog(serial) {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (serial === attempt && wantsPlay && pending) nextStream(serial);
    }, 12000);
  }
  async function startStream() {
    if (!current || !allowed()) return;
    stopMetadata();
    const serial = ++attempt;
    clearTimeout(watchdog);
    wantsPlay = true;
    pending = true;
    dropHls();
    silentFrames = 0;
    const url = current.urls[streamIndex];
    let useFx = !fxFailed.has(url) && ensureGraph(),
      Hls = null;
    peaks.fill(0.12);
    floors.fill(0);
    if (useFx) ctx.resume?.().catch(() => {});
    playbackMessage = 'Connessione…';
    update();
    armWatchdog(serial);
    // HLS on the analysable player only through hls.js; otherwise the browser's own player.
    if (useFx && isHls(url)) {
      try {
        Hls = await loadHls();
        if (!Hls.isSupported()) Hls = null;
      } catch {
        Hls = null;
      }
      if (serial !== attempt) return;
      if (!Hls) useFx = false;
    }
    const next = useFx ? fx : plain,
      other = useFx ? plain : fx;
    silence(other);
    audio = next;
    audio.pause();
    if (Hls) {
      hls = new Hls({ lowLatencyMode: false, backBufferLength: 30 });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal && serial === attempt && wantsPlay) nextStream(serial);
      });
      hls.loadSource(url);
      hls.attachMedia(fx);
    } else {
      audio.src = url;
      audio.load();
    }
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.name,
          artist: 'Binottoland · Radio'
        });
      } catch {}
    }
    try {
      await audio.play();
      if (serial !== attempt) return;
      update();
    } catch (error) {
      if (serial !== attempt || !wantsPlay) return;
      if (error.name === 'NotAllowedError') stop('Tocca Play per avviare la radio.');
      else nextStream(serial);
    }
  }
  function resume() {
    if (!allowed() || !current) return;
    streamIndex = 0;
    startStream();
  }
  const playPause = () => {
    if (!allowed()) return;
    if (wantsPlay) {
      stop();
      return;
    }
    if (!current) {
      openScreen();
      return;
    }
    resume();
  };
  play.onclick = playPause;
  bigPlay.onclick = playPause;
  star.onclick = () => {
    if (allowed()) toggleFav(current);
  };
  volume.oninput = () => {
    const value = Number(volume.value);
    if (!Number.isFinite(value)) return;
    plain.volume = fx.volume = Math.min(1, Math.max(0, value));
    saveLocal('binottoland-radio-volume', plain.volume);
  };
  // Events from the player that is not in use are ignored.
  for (const el of [plain, fx]) {
    const mine = fn => event => {
      if (event.target === audio) fn(event);
    };
    el.addEventListener(
      'playing',
      mine(() => {
        if (!wantsPlay) {
          audio.pause();
          return;
        }
        pending = false;
        clearTimeout(watchdog);
        playbackMessage = 'In ascolto · ' + current.name;
        update();
        renderList();
        if (!metadataTimer && !metadataPending) loadMetadata();
      })
    );
    el.addEventListener(
      'pause',
      mine(() => {
        if (!pending && wantsPlay) {
          wantsPlay = false;
          stopMetadata();
          playbackMessage = 'Radio in pausa.';
          clearTimeout(watchdog);
        }
        update();
      })
    );
    const buffering = mine(() => {
      if (!wantsPlay) return;
      pending = true;
      playbackMessage = 'Buffering…';
      update();
      armWatchdog(attempt);
    });
    el.addEventListener('waiting', buffering);
    el.addEventListener('stalled', buffering);
    el.addEventListener(
      'error',
      mine(() => {
        if (audio.getAttribute('src') && wantsPlay) nextStream();
      })
    );
    el.addEventListener(
      'ended',
      mine(() => {
        if (wantsPlay) nextStream();
      })
    );
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', resume);
      navigator.mediaSession.setActionHandler('pause', () => stop());
      navigator.mediaSession.setActionHandler('stop', () => stop());
    } catch {}
  }
  update();
  renderList();
  // Last station is HLS: fetch hls.js now, so Play starts right away.
  if (current?.urls.some(isHls)) loadHls().catch(() => {});
})();
