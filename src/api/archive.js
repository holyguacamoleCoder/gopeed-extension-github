import { normalizeArchiveRef } from '../utils/normalizeArchiveRef.js';
import { buildCodeloadArchiveUrl, archiveDisplayName } from '../utils/codeloadUrl.js';
import buildDownloadReq from '../utils/buildDownloadReq.js';
import { fetchContentLength } from '../utils/fetchContentLength.js';

/**
 * Build a single archive download task (branch archives; tag archives route to releases in parser).
 * @param {string} owner
 * @param {string} repo
 * @param {string} archiveRef
 * @param {string} [token]
 * @returns {Promise<{ name: string, files: Array }>}
 */
export async function resolveArchive(owner, repo, archiveRef, token) {
  const normalizedRef = normalizeArchiveRef(archiveRef);
  const downloadUrl = buildCodeloadArchiveUrl(owner, repo, normalizedRef);
  const githubUrl = `https://github.com/${owner}/${repo}/archive/${normalizedRef}`;
  const name = archiveDisplayName(repo, normalizedRef);

  const size =
    (await fetchContentLength(downloadUrl, token)) ??
    (await fetchContentLength(githubUrl, token));

  return {
    name: `GitHub: ${repo}-${name}`,
    files: [
      {
        name,
        ...(size != null && { size }),
        req: buildDownloadReq(downloadUrl, token),
      },
    ],
  };
}
