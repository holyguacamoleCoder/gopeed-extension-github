/**
 * Build request headers for GitHub HTTP/API calls inside Gopeed extension.
 * @param {string} [token]
 * @returns {Record<string, string>}
 */
export function buildGithubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github.v3+json, text/html',
  };
  const ua = gopeed.settings && gopeed.settings.ua;
  headers['User-Agent'] =
    (typeof ua === 'string' && ua.trim()) || 'gopeed-extension-github';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function githubFetch(url, init = {}, timeoutMs = 12000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer;
  if (controller && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    return await fetch(url, {
      ...init,
      ...(controller && { signal: controller.signal }),
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Request timeout (${timeoutMs}ms): ${url}`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fetch GitHub REST API (never proxied by extension proxyPrefix).
 * @param {string} path - Path after https://api.github.com/ (no leading slash)
 * @param {string} [token]
 * @returns {Promise<unknown>}
 */
export async function githubApi(path, token) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const url = `https://api.github.com/${normalized}`;
  gopeed.logger.info('[GitHub 扩展] GitHub API:', url);

  const resp = await githubFetch(url, { headers: buildGithubHeaders(token) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
  return resp.json();
}

/**
 * Fetch a github.com HTML page (release page fallback).
 * @param {string} url
 * @param {string} [token]
 * @returns {Promise<string>}
 */
export async function githubPage(url, token) {
  gopeed.logger.info('[GitHub 扩展] GitHub page:', url);
  const headers = buildGithubHeaders(token);
  headers.Accept = 'text/html,application/xhtml+xml';
  const resp = await githubFetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub page ${resp.status}: ${text}`);
  }
  return resp.text();
}
