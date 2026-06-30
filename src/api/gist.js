import { githubApi } from '../utils/githubFetch.js';
import buildDownloadReq from '../utils/buildDownloadReq.js';
import { fetchContentLength } from '../utils/fetchContentLength.js';

/**
 * Resolve a gist page into downloadable files.
 * @param {string} gistId
 * @param {string} [token]
 * @returns {Promise<{ name: string, files: Array }>}
 */
export async function resolveGist(gistId, token) {
  const data = await githubApi(`gists/${gistId}`, token);
  const files = data.files || {};
  const entries = Object.entries(files);

  if (entries.length === 0) {
    return {
      name: `Error: Gist has no files (${gistId})`,
      files: [],
    };
  }

  const desc = data.description ? String(data.description).slice(0, 40) : gistId;
  return {
    name: `GitHub Gist: ${desc}`,
    files: entries.map(([name, file]) => ({
      name,
      size: file.size,
      req: buildDownloadReq(file.raw_url, token),
    })),
  };
}

/**
 * Build a single-file result from a direct raw or gist raw URL.
 * @param {{ downloadUrl: string, path?: string, filename?: string, owner?: string, repo?: string, gistId?: string }} parsed
 * @param {string} [token]
 * @returns {Promise<{ name: string, files: Array }>}
 */
export async function resolveDirectUrl(parsed, token) {
  const name =
    parsed.filename ||
    (parsed.path && parsed.path.split('/').pop()) ||
    parsed.downloadUrl.split('/').pop() ||
    'file';

  const path = parsed.repo || parsed.gistId || '';
  const size = await fetchContentLength(parsed.downloadUrl, token);

  return {
    name: `GitHub: ${name}`,
    files: [
      {
        name,
        ...(path && { path }),
        ...(size != null && { size }),
        req: buildDownloadReq(parsed.downloadUrl, token),
      },
    ],
  };
}
