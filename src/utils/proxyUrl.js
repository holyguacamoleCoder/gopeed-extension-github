/**
 * Wrap a final download URL with the configured proxy prefix when enabled.
 * Does not apply to GitHub API or LFS batch endpoints.
 * @param {string} url
 * @returns {string}
 */
export function wrapDownloadUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!/^https?:\/\//i.test(url)) return url;

  const enabled = gopeed.settings.useProxy === true || gopeed.settings.useProxy === 'true';
  if (!enabled) return url;

  const rawPrefix = gopeed.settings.proxyPrefix;
  if (!rawPrefix || typeof rawPrefix !== 'string' || !rawPrefix.trim()) {
    gopeed.logger.warn('[GitHub 扩展] useProxy enabled but proxyPrefix is empty; download URL not proxied');
    return url;
  }

  let prefix = rawPrefix.trim();
  if (!prefix.endsWith('/')) prefix += '/';
  if (url.startsWith(prefix)) return url;

  return prefix + url;
}
