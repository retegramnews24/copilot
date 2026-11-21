// Swipe left/right to move between Lobby, Giochi and Settings.
// Like Android: the page follows the finger and the next one slides in beside it.
// Ignored inside a game table, on controls that already use a horizontal drag and on rows that scroll sideways.
const ORDER = ['game', 'games', 'settings'];
const SUBPAGES = ['debug', 'archive', 'info'];

export function installSwipe({ selectPage, beforeShow = () => {}, haptic = () => {} }) {
  const $ = id => document.getElementById(id);
  const openPage = () => document.querySelector('.page:not([hidden])');
  const current = () => {
    const open = openPage()?.id?.replace('page-', '');
    return SUBPAGES.includes(open) ? 'settings' : open;
  };
  // Swipe starts anywhere: a tap still presses buttons, a horizontal drag becomes a swipe.
  const blocked = el =>
    !!el.closest('input[type=range],[role=slider],canvas,iframe,dialog,#board,[data-no-swipe]');
  // A row that can still scroll sideways in that direction scrolls first; at its edge the page swipes.
  const scrollsSideways = (el, dx) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.scrollWidth <= e.clientWidth + 4 || !/(auto|scroll)/.test(getComputedStyle(e).overflowX))
        continue;
      if (dx < 0 ? e.scrollLeft + e.clientWidth < e.scrollWidth - 2 : e.scrollLeft > 2) return true;
    }
    return false;
  };
  let start = null,
    drag = null,
    busy = false;
  const pageEl = name => $('page-' + name);
  const place = (el, x, animate) => {
    el.style.transition = animate ? 'transform .26s cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = x ? `translate3d(${x}px,0,0)` : '';
  };
  const showPeer = (peer, cur) => {
    if (peer.dataset.peer) return;
    beforeShow(peer.id.replace('page-', ''));
    peer.dataset.peer = '1';
    peer.hidden = false;
    peer.classList.add('swipe-peer');
    Object.assign(peer.style, {
      top: cur.offsetTop + 'px',
      left: cur.offsetLeft + 'px',
      width: cur.offsetWidth + 'px',
      height: cur.offsetHeight + 'px'
    });
  };
  const clearPeer = peer => {
    if (!peer) return;
    delete peer.dataset.peer;
    peer.classList.remove('swipe-peer');
    Object.assign(peer.style, { top: '', left: '', width: '', height: '', transform: '', transition: '' });
  };
  document.addEventListener(
    'touchstart',
    e => {
      start = null;
      if (busy || e.touches.length !== 1 || $('app-shell').hidden || !$('table').hidden || blocked(e.target))
        return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, at: Date.now() };
      drag = null;
    },
    { passive: true }
  );
  document.addEventListener(
    'touchmove',
    e => {
      if (!start || busy) return;
      const t = e.touches[0],
        dx = t.clientX - start.x,
        dy = t.clientY - start.y;
      if (!drag) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          start = null;
          return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (scrollsSideways(e.target, dx)) {
          start = null;
          return;
        }
        const i = ORDER.indexOf(current());
        if (i < 0) {
          start = null;
          return;
        }
        drag = { cur: openPage(), i, peer: null, dir: 0 };
      }
      e.preventDefault();
      const w = drag.cur.offsetWidth,
        dir = dx < 0 ? 1 : -1,
        nextName = ORDER[drag.i + dir];
      if (dir !== drag.dir) {
        clearPeer(drag.peer);
        if (drag.peer) drag.peer.hidden = true;
        drag.peer = nextName ? pageEl(nextName) : null;
        drag.dir = dir;
        if (drag.peer) showPeer(drag.peer, drag.cur);
      }
      // No page on that side: a little rubber-band resistance.
      const x = drag.peer ? dx : dx * 0.25;
      place(drag.cur, x, false);
      if (drag.peer) place(drag.peer, x + dir * w, false);
      drag.dx = x;
      drag.w = w;
    },
    { passive: false }
  );
  // After a swipe that began on a button, swallow the click the browser may still send.
  let swallowUntil = 0;
  document.addEventListener(
    'click',
    e => {
      if (Date.now() < swallowUntil) {
        e.preventDefault();
        e.stopPropagation();
        swallowUntil = 0;
      }
    },
    true
  );
  document.addEventListener('touchend', () => {
    if (!drag) {
      start = null;
      return;
    }
    swallowUntil = Date.now() + 500;
    const { cur, peer, dx, w, dir } = drag,
      speed = Math.abs(dx) / Math.max(1, Date.now() - start.at);
    drag = null;
    start = null;
    const go = !!peer && (Math.abs(dx) > w * 0.3 || (speed > 0.45 && Math.abs(dx) > 40));
    busy = true;
    place(cur, go ? -dir * w : 0, true);
    if (peer) place(peer, go ? 0 : dir * w, true);
    setTimeout(() => {
      place(cur, 0, false);
      if (go) {
        clearPeer(peer);
        selectPage(peer.id.replace('page-', ''));
        haptic();
      } else if (peer) {
        clearPeer(peer);
        peer.hidden = true;
      }
      busy = false;
    }, 270);
  });
}
