import { wrapDownloadUrl } from './proxyUrl.js';

/**
 * Build a GoPeed download request with optional proxy and auth headers.
 * @param {string} url - Final download URL (not API)
 * @param {string} [token]
 * @param {Record<string, string>} [actionHeaders] - e.g. LFS download headers
 * @returns {{ url: string, extra?: { header: Record<string, string> } }}
 */
export default function buildDownloadReq(url, token, actionHeaders) {
  const header = {};
  if (token) header.Authorization = `Bearer ${token}`;
  if (actionHeaders) Object.assign(header, actionHeaders);

  const req = { url: wrapDownloadUrl(url) };
  if (Object.keys(header).length > 0) {
    req.extra = { header };
  }
  return req;
}
