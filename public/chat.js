// Lobby chat: newest message first under the input, a box exactly 20 messages tall that scrolls for older ones.
import { makeAvatar } from './avatar.js?v=7a059821b4';
const $ = id => document.getElementById(id);

// me(): the signed-in user; request/onError: app helpers; refresh(): re-renders people and chat together.
export function createChat({ me, request, onError, refresh }) {
  let messages = [],
    sending = false;
  // Box height: exactly the first 20 messages; older ones are reached by scrolling inside it.
  function limit() {
    const list = $('chat-messages'),
      rows = [...list.children];
    if (rows.length <= 20 || list.offsetParent === null) {
      if (rows.length <= 20) list.style.maxHeight = '';
      return;
    }
    const top = list.getBoundingClientRect().top - list.scrollTop,
      bottom = rows[19].getBoundingClientRect().bottom;
    list.style.maxHeight = Math.ceil(bottom - top + 4) + 'px';
  }
  addEventListener('resize', limit);
  function scrollToLatest() {
    limit();
    requestAnimationFrame(() => {
      const list = $('chat-messages');
      limit();
      list.scrollTop = 0;
    });
  }
  function render(connected) {
    const list = $('chat-messages'),
      identity = me();
    const signature = messages.map(m => m.id).join(',');
    if (list.dataset.signature !== signature) {
      list.dataset.signature = signature;
      list.replaceChildren();
      if (!messages.length) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Il posto per due parole tra una partita e l’altra.';
        list.append(p);
      }
      // Newest first under the input; the box shows 20 messages and scrolls for the older ones.
      for (const message of messages.slice().reverse()) {
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
        list.append(row);
      }
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
      $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    } catch (e) {
      onError(e.message);
    } finally {
      sending = false;
      refresh();
    }
  };
  return {
    set: list => {
      messages = list || [];
    },
    render,
    limit,
    scrollToLatest
  };
}
