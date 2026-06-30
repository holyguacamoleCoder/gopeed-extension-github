import { githubApi } from './githubFetch.js';

/**
 * File size from GitHub Contents API (blob size on tree; LFS pointers return pointer size).
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref
 * @param {string} path - path inside repo
 * @param {string} [token]
 * @returns {Promise<number | undefined>}
 */
export async function fetchRepoFileSize(owner, repo, ref, path, token) {
  const encodedPath = path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  try {
    const data = await githubApi(
      `repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      token
    );
    if (data && typeof data.size === 'number' && data.size >= 0) {
      return data.size;
    }
  } catch (_) {
    // ignore
  }
  return undefined;
}
