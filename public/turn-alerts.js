// "Tocca a te" messages from the bot: the Lobby invite to turn them on, the Settings switch, and opening a table
// straight from the message button (Mini App link with start parameter "t-<room>").
// Telegram lets a bot write privately only to people who started its chat: turning them on means pressing
// Start in the bot's chat, which the server records.
const $ = id => document.getElementById(id);
const SNOOZE = 'binottoland-alerts-later';
const START_ROOM = /^t-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;

// request(path, data?) is the app's authenticated fetch (GET without data, POST with data).
export function initTurnAlerts({ tg, request, onError = () => {}, now = () => Date.now() }) {
  let status = null,
    startUsed = false;
  const bot = () => status?.bot || 'checkmategame_bot';
  const snoozed = () => {
    try {
      return Number(localStorage.getItem(SNOOZE) || 0) > now();
    } catch {
      return false;
    }
  };
  function openBot() {
    const link = 'https://t.me/' + bot() + '?start=avvisi';
    if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else window.open(link, '_blank', 'noopener');
  }
  function render() {
    const card = $('alerts-card'),
      toggle = $('setting-turn-alerts');
    if (toggle) {
      toggle.checked = status?.enabled === true;
      toggle.disabled = !status;
    }
    if (card) card.hidden = !status || status.enabled || snoozed();
  }
  async function refresh() {
    try {
      status = await request('/api/notices');
    } catch {
      status = null;
    }
    render();
    return status;
  }
  $('alerts-enable')?.addEventListener('click', openBot);
  $('alerts-later')?.addEventListener('click', () => {
    try {
      localStorage.setItem(SNOOZE, String(now() + 7 * 86400000));
    } catch {}
    render();
  });
  $('setting-turn-alerts')?.addEventListener('change', async event => {
    const wanted = event.target.checked;
    // Never started the bot's chat: Telegram needs the Start button there first.
    if (wanted && !status?.started) {
      event.target.checked = false;
      openBot();
      return;
    }
    try {
      status = await request('/api/notices', { enabled: wanted });
    } catch (error) {
      onError(error.message);
    }
    render();
  });
  // Back from the bot's chat: read the new state.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && status && !status.enabled) refresh();
  });
  // The table to open when the app was launched from a "tocca a te" message (only once per launch).
  function startRoom() {
    if (startUsed) return null;
    startUsed = true;
    const match = String(tg?.initDataUnsafe?.start_param || '').match(START_ROOM);
    return match ? match[1] : null;
  }
  return { refresh, startRoom, status: () => status };
}
