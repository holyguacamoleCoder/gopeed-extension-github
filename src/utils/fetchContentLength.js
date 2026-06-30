/**
 * Try to get file size in bytes via HEAD or a Range response.
 * @param {string} url
 * @param {string} [token]
 * @param {Response} [existingResponse]
 * @returns {Promise<number | undefined>}
 */
export async function fetchContentLength(url, token, existingResponse) {
  if (existingResponse) {
    const fromExisting = readLengthFromResponse(existingResponse);
    if (fromExisting != null) return fromExisting;
  }

  const headers = { 'User-Agent': 'gopeed-extension-github' };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const method of ['HEAD', 'GET']) {
    try {
      const reqHeaders = { ...headers };
      if (method === 'GET') reqHeaders.Range = 'bytes=0-0';
      const resp = await fetch(url, { method, headers: reqHeaders, redirect: 'follow' });
      if (resp.ok || resp.status === 206) {
        const len = readLengthFromResponse(resp);
        if (len != null) return len;
      }
    } catch (_) {
      // try next method
    }
  }

  return undefined;
}

/**
 * @param {Response} resp
 * @returns {number | undefined}
 */
function readLengthFromResponse(resp) {
  const fromRange = parseContentRangeTotal(resp.headers.get('Content-Range'));
  if (fromRange != null) return fromRange;
  return parseContentLengthHeader(resp.headers.get('Content-Length'));
}

/**
 * @param {string | null} value
 * @returns {number | undefined}
 */
function parseContentLengthHeader(value) {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * @param {string | null} value
 * @returns {number | undefined}
 */
function parseContentRangeTotal(value) {
  if (!value) return undefined;
  const m = value.match(/\/(\d+)\s*$/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
