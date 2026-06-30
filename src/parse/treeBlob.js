import { normalizeGithubPathSegments } from '../utils/normalizeGithubPathname.js';

/**
 * Parse tree/blob URLs from github.com pathname.
 * @param {string[]} pathParts
 * @returns {object | null}
 */
export default function parseTreeBlob(pathParts) {
  if (pathParts.length < 2) return null;

  const owner = pathParts[0];
  let repo = pathParts[1];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  let ref = 'main';
  let path = '';
  let isSingleFile = false;

  if (pathParts[2] === 'tree' && pathParts.length >= 4) {
    const segments = pathParts.slice(3);
    if (segments.length === 1) {
      ref = segments[0];
      path = '';
    } else {
      return {
        type: 'tree',
        owner,
        repo,
        ref: '',
        path: '',
        needsRefResolve: true,
        segments,
      };
    }
  } else if (pathParts[2] === 'blob' && pathParts.length >= 5) {
    const segments = pathParts.slice(3);
    if (segments.length === 2) {
      ref = segments[0];
      path = segments[1];
      isSingleFile = true;
    } else if (segments.length >= 3) {
      return {
        type: 'blob',
        owner,
        repo,
        ref: '',
        path: '',
        needsRefResolve: true,
        segments,
      };
    }
  } else if (pathParts[2] === 'blob' && pathParts.length === 4) {
    ref = pathParts[3];
    path = '';
    isSingleFile = false;
  } else if (pathParts.length >= 3 && pathParts[2] !== '') {
    return null;
  }

  const type = isSingleFile ? 'blob' : 'tree';
  return { type, owner, repo, ref, path };
}
