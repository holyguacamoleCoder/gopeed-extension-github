import { normalizeGithubPathSegments } from '../utils/normalizeGithubPathname.js';

/**
 * Parse raw.githubusercontent.com URLs.
 * @param {URL} url
 * @returns {{ type: 'raw', owner: string, repo: string, ref: string, path: string, downloadUrl: string } | null}
 */
export default function parseRawHost(url) {
  const pathParts = normalizeGithubPathSegments(url.pathname);
  if (pathParts.length < 4) return null;

  const owner = pathParts[0];
  let repo = pathParts[1];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  const ref = pathParts[2];
  const path = pathParts.slice(3).join('/');
  const downloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

  return { type: 'raw', owner, repo, ref, path, downloadUrl };
}
