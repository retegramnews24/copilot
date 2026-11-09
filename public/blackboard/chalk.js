export const BOARD_WIDTH = 1440;
export const BOARD_HEIGHT = 1080;
export const CHALKS = [
  ['Bianco', '#f0ead7', -4], ['Giallo', '#f3cf73', 3],
  ['Corallo', '#e98483', -2], ['Azzurro', '#88bfdc', 4],
  ['Verde', '#a9cc83', -4], ['Lilla', '#c3a4d8', 2]
];
export const MAX_POINTS = 64;
export const ERASER = CHALKS.length;
export const SIZES = [5, 9, 16, 26];
export const DEFAULT_SIZE = 9;

export function validStroke(stroke) {
  return typeof stroke?.id === 'string' && /^[a-f0-9-]{36}$/.test(stroke.id)
    && Number.isInteger(stroke.color) && (stroke.color === ERASER || !!CHALKS[stroke.color])
    && (stroke.size === undefined || SIZES.includes(stroke.size))
    && Array.isArray(stroke.points) && stroke.points.length > 0 && stroke.points.length <= MAX_POINTS
    && stroke.points.every(point => Array.isArray(point) && point.length === 2
      && Number.isInteger(point[0]) && point[0] >= 0 && point[0] <= BOARD_WIDTH
      && Number.isInteger(point[1]) && point[1] >= 0 && point[1] <= BOARD_HEIGHT);
}
