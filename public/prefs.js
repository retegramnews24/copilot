// Small local settings (localStorage). Reads never throw; JSON helpers for structured values.
export const pref = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
export const setPref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
export function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
// Throws when storage is unavailable, so callers can tell the user.
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw Error('Abilita la memoria locale per conservare il tuo posto.');
  }
}
