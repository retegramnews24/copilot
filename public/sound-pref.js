// Global "Suoni" setting (Settings → Preferenze), shared by the games through localStorage.
export const SOUND_KEY = 'binottoland-sound';
export function soundAllowed() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
