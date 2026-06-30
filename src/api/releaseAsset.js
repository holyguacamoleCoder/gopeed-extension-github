import buildDownloadReq from '../utils/buildDownloadReq.js';
import { fetchContentLength } from '../utils/fetchContentLength.js';

/**
 * Single release asset from releases/download/{tag}/{name} URL.
 * @param {object} parsed
 * @param {string} [token]
 * @returns {Promise<{ name: string, files: Array }>}
 */
export async function resolveReleaseAsset(parsed, token) {
  const size = await fetchContentLength(parsed.downloadUrl, token);
  return {
    name: `GitHub: ${parsed.repo}-releases-${parsed.tag}`,
    files: [
      {
        name: parsed.assetName,
        ...(size != null && { size }),
        req: buildDownloadReq(parsed.downloadUrl, token),
      },
    ],
  };
}
