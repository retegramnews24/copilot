// Round avatar: Telegram photo when there is one (https only), initials underneath as fallback.
export function makeAvatar(user) {
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = (user.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => [...word][0])
    .join('')
    .toUpperCase();
  const photo = user.photo || '';
  if (photo.startsWith('https://')) {
    const image = document.createElement('img');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.src = photo;
    image.onerror = () => image.remove();
    avatar.append(image);
  }
  return avatar;
}
