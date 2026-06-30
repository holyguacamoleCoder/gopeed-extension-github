import { normalizeGithubPathSegments } from '../utils/normalizeGithubPathname.js';

/**
 * Parse gist.github.com and gist.githubusercontent.com URLs.
 * @param {URL} url
 * @returns {object | null}
 */
export default function parseGistHost(url) {
  const host = url.hostname.replace(/^www\./, '');
  const pathParts = normalizeGithubPathSegments(url.pathname);

  if (host === 'gist.githubusercontent.com') {
    return parseGistRawUrl(pathParts, url.href);
  }

  if (host === 'gist.github.com') {
    return parseGistPage(pathParts);
  }

  return null;
}

/**
 * gist.githubusercontent.com/{user}/{gistId}/raw/{commit}/{filename}
 * @param {string[]} pathParts
 * @param {string} href
 */
function parseGistRawUrl(pathParts, href) {
  if (pathParts.length < 5 || pathParts[2] !== 'raw') return null;

  const gistId = pathParts[1];
  const filename = pathParts[pathParts.length - 1];

  return {
    type: 'gist_raw',
    gistId,
    filename,
    downloadUrl: href.split('?')[0],
  };
}

/**
 * gist.github.com/{user}/{gistId} or gist.github.com/{gistId}
 * @param {string[]} pathParts
 */
function parseGistPage(pathParts) {
  if (pathParts.length === 0) return null;

  let gistId;
  if (pathParts.length === 1) {
    gistId = pathParts[0];
  } else if (pathParts.length >= 2) {
    gistId = pathParts[1];
  } else {
    return null;
  }

  if (!gistId) return null;

  return { type: 'gist', gistId };
}
