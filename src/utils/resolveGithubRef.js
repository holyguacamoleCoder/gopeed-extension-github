/**
 * Resolve ambiguous tree/blob URLs where ref and path may contain slashes:
 * try longest ref prefix first via GitHub commits API.
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} segments - pathParts.slice(3) after tree/blob
 * @param {Record<string, string>} headers
 * @returns {Promise<{ ref: string, path: string } | null>}
 */
export async function resolveRefAndPath(owner, repo, segments, headers) {
  if (!segments || segments.length === 0) return null;
  if (segments.length === 1) return { ref: segments[0], path: '' };

  // Longest ref first: k = segment count used as ref (e.g. both parts → branch "a/b")
  for (let k = segments.length; k >= 1; k--) {
    const ref = segments.slice(0, k).join('/');
    const path = segments.slice(k).join('/');
    if (await refExists(owner, repo, ref, headers)) {
      return { ref, path };
    }
  }
  return null;
}

/**
 * @param {string} ref - branch, tag, or SHA (slashes allowed)
 */
async function refExists(owner, repo, ref, headers) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}?per_page=1`;
  const resp = await fetch(url, { headers });
  return resp.ok;
}
