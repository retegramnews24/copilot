// Lobby chat, as in a messaging app: oldest at the top, newest at the bottom next to the input.
// Game notices ("Sara ha aperto UNO · Entra") can be mixed in: they live only in this browser, not on the server.
import { makeAvatar } from './avatar.js?v=7a059821b4';
const $ = id => document.getElementById(id);

// me(): the signed-in user; request/onError: app helpers; refresh(): re-renders people and chat together.
export function createChat({ me, request, onError, refresh }) {
  let messages = [],
    notices = [],
    sending = false;
  // Kept for callers: the list now fills the space given by the layout, no row limit.
  function limit() {}
  function scrollToLatest() {
    const list = $('chat-messages');
    list.scrollTop = list.scrollHeight;
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
  }
  function messageRow(message, identity) {
    const row = document.createElement('article');
    row.className = 'chat-message' + (message.userId === identity?.id ? ' mine' : '');
    row.append(makeAvatar(message));
    const copy = document.createElement('div');
    copy.className = 'chat-copy';
    const header = document.createElement('small');
    header.textContent =
      message.name +
      ' · ' +
      new Date(message.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const text = document.createElement('p');
    text.textContent = message.text;
    copy.append(header, text);
    row.append(copy);
    return row;
  }
  function noticeRow(notice) {
    const row = document.createElement('article');
    row.className = 'chat-notice' + (notice.urgent ? ' urgent' : '');
    const text = document.createElement('span');
    text.textContent = notice.text;
    row.append(text);
    if (notice.label) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = notice.label + ' ›';
      button.onclick = () => notice.action?.();
      row.append(button);
    }
    return row;
  }
  function render(connected) {
    const list = $('chat-messages'),
      identity = me();
    const signature = messages.map(m => m.id).join(',') + '|' + notices.map(n => n.id).join(',');
    if (list.dataset.signature !== signature) {
      list.dataset.signature = signature;
      list.replaceChildren();
      if (!messages.length && !notices.length) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Il posto per due parole tra una partita e l’altra.';
        list.append(p);
      }
      const items = [
        ...messages.map(m => ({ at: m.at, row: () => messageRow(m, identity) })),
        ...notices.map(n => ({ at: n.at, row: () => noticeRow(n) }))
      ].sort((a, b) => a.at - b.at);
      for (const item of items) list.append(item.row());
      scrollToLatest();
    }
    $('chat-send').disabled = sending || !identity || !connected;
  }
  $('chat-form').onsubmit = async event => {
    event.preventDefault();
    if (sending) return;
    const input = $('chat-input'),
      text = input.value.trim();
    if (!text) return;
    sending = true;
    $('chat-send').disabled = true;
    try {
      const result = await request('/api/chat', { text });
      if (result.message && !messages.some(m => m.id === result.message.id))
        messages = [...messages, result.message].slice(-100);
      if (input.value.trim() === text) input.value = '';
      onError('');
      refresh();
      scrollToLatest();
    } catch (e) {
      onError(e.message);
    } finally {
      sending = false;
      refresh();
    }
  };
  let noticeId = 0;
  return {
    set: list => {
      messages = list || [];
    },
    // { text, label, action, urgent }: shown in the chat at the current time; the last 20 are kept.
    notice: item => {
      notices = [...notices, { ...item, id: 'n' + ++noticeId, at: Date.now() }].slice(-20);
      refresh();
    },
    render,
    limit,
    scrollToLatest
  };
}
