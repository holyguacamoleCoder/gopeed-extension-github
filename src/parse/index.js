import parseGithubCom from './githubCom.js';
import parseRawHost from './raw.js';
import parseGistHost from './gist.js';

/**
 * Parse a GitHub-related URL into a typed result for onResolve routing.
 * @param {URL} url
 * @returns {object | null}
 */
export default function parseUrl(url) {
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'raw.githubusercontent.com') {
    return parseRawHost(url);
  }

  if (host === 'gist.github.com' || host === 'gist.githubusercontent.com') {
    return parseGistHost(url);
  }

  if (host === 'github.com') {
    return parseGithubCom(url);
  }

  return null;
}
