import buildDownloadReq from '../utils/buildDownloadReq.js';
import { githubPage } from '../utils/githubFetch.js';
import { throwResolveError } from '../utils/throwResolveError.js';

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag
 * @returns {string}
 */
function releasePageUrl(owner, repo, tag) {
  if (tag === 'latest') {
    return `https://github.com/${owner}/${repo}/releases/latest`;
  }
  const encodedTag = tag
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `https://github.com/${owner}/${repo}/releases/tag/${encodedTag}`;
}

/**
 * @param {string} html
 * @param {string} owner
 * @param {string} repo
 * @param {string} [token]
 * @returns {Array<{ name: string, size?: number, req: object }>}
 */
export function parseReleaseAssetsFromHtml(html, owner, repo, token) {
  const files = [];
  const seen = new Set();

  const patterns = [
    new RegExp(`href="(https://github\\.com/${owner}/${repo}/releases/download/[^"]+)"`, 'gi'),
    new RegExp(`href="(/${owner}/${repo}/releases/download/[^"]+)"`, 'gi'),
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      const href = match[1].startsWith('http') ? match[1] : `https://github.com${match[1]}`;
      const name = decodeURIComponent(href.split('/').pop() || '');
      if (!name || seen.has(name)) continue;
      seen.add(name);
      files.push({
        name,
        req: buildDownloadReq(href, token),
      });
    }
  }

  const embedded = html.match(/<script[^>]*data-target="react-app\.embeddedData"[^>]*>([\s\S]*?)<\/script>/i);
  if (embedded) {
    try {
      const payload = JSON.parse(embedded[1]);
      const assets = findEmbeddedReleaseAssets(payload);
      for (const asset of assets) {
        const name = asset.name;
        const url = asset.browser_download_url;
        if (!name || !url || seen.has(name)) continue;
        seen.add(name);
        files.push({
          name,
          ...(asset.size != null && { size: asset.size }),
          req: buildDownloadReq(url, token),
        });
      }
    } catch (_) {
      // ignore malformed embedded JSON
    }
  }

  return files;
}

/**
 * @param {unknown} node
 * @returns {Array<{ name?: string, browser_download_url?: string, size?: number }>}
 */
function findEmbeddedReleaseAssets(node) {
  const found = [];
  walkEmbedded(node, found);
  return found;
}

/**
 * @param {unknown} node
 * @param {Array<{ name?: string, browser_download_url?: string, size?: number }>} out
 */
function walkEmbedded(node, out) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) walkEmbedded(item, out);
    return;
  }

  const record = /** @type {Record<string, unknown>} */ (node);
  if (Array.isArray(record.assets) && typeof record.tag_name === 'string') {
    for (const asset of record.assets) {
      if (asset && typeof asset === 'object') out.push(/** @type {typeof out[number]} */ (asset));
    }
  }

  for (const value of Object.values(record)) {
    walkEmbedded(value, out);
  }
}

/**
 * Fallback when api.github.com is slow/unreachable: parse release page HTML.
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag
 * @param {string} [token]
 * @returns {Promise<{ name: string, files: Array }>}
 */
export async function resolveReleaseFromPage(owner, repo, tag, token) {
  const pageUrl = releasePageUrl(owner, repo, tag);
  const html = await githubPage(pageUrl, token);
  const files = parseReleaseAssetsFromHtml(html, owner, repo, token);

  if (files.length === 0) {
    throwResolveError(
      `Error: Could not parse release assets from page (${owner}/${repo} ${tag}). Check network or GitHub token.`,
    );
  }

  const tagName = tag === 'latest' ? 'latest' : tag;
  gopeed.logger.info('[GitHub 扩展] Release 页面解析资产数:', String(files.length), 'tag:', tagName);

  return {
    name: `GitHub: ${repo}-releases-${tagName}`,
    files,
  };
}
