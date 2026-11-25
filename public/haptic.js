// Vibrazione di Telegram chiesta da un gioco in un riquadro (F1, Biliardo, Acquedotto…): un solo pezzo di codice
// invece di quattro copie. kind: selection | impact (light, medium, heavy) | notification (error, success, warning).
export function telegramHaptic(tg, kind, style) {
  const hf = tg?.HapticFeedback;
  try {
    if (kind === 'selection') hf?.selectionChanged();
    else if (kind === 'impact' && ['light', 'medium', 'heavy'].includes(style)) hf?.impactOccurred(style);
    else if (kind === 'notification' && ['error', 'success', 'warning'].includes(style)) hf?.notificationOccurred(style);
  } catch {}
}
