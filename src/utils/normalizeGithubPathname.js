/**
 * Normalize `URL.pathname` from github.com for stable parsing:
 * - collapse repeated slashes (`//`, `///`)
 * - trim leading/trailing slashes
 * - split and drop empty segments (handles trailing `/` and odd paste artifacts)
 *
 * @param {string} pathname - `url.pathname`
 * @returns {string[]} non-empty segments, e.g. `"/a//b/c/"` → `["a","b","c"]`
 */
export function normalizeGithubPathSegments(pathname) {
  if (!pathname || typeof pathname !== 'string') return [];
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  const trimmed = collapsed.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return [];
  return trimmed.split('/').filter(Boolean);
}
