import { githubApi } from '../utils/githubFetch.js';
import buildDownloadReq from '../utils/buildDownloadReq.js';
import { fetchContentLength } from '../utils/fetchContentLength.js';
import { buildCodeloadArchiveUrl } from '../utils/codeloadUrl.js';
import { throwResolveError } from '../utils/throwResolveError.js';
import { resolveReleaseFromPage } from './resolveReleasePage.js';

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag
 * @returns {string}
 */
function releaseTagApiPath(owner, repo, tag) {
  if (tag === 'latest') {
    return `repos/${owner}/${repo}/releases/latest`;
  }
  const encodedTag = tag
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `repos/${owner}/${repo}/releases/tags/${encodedTag}`;
}

function encodeRefPath(ref) {
  return ref
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} tagName
 * @returns {Array<{ name: string, url: string }>}
 */
function buildSourceArchives(owner, repo, tagName) {
  const safeTag = tagName.replace(/[^\w.\-]+/g, '_');
  const encodedTag = encodeRefPath(tagName);
  return [
    {
      name: `${repo}-${safeTag}-source.zip`,
      url: buildCodeloadArchiveUrl(owner, repo, `refs/tags/${encodedTag}.zip`),
    },
    {
      name: `${repo}-${safeTag}-source.tar.gz`,
      url: buildCodeloadArchiveUrl(owner, repo, `refs/tags/${encodedTag}.tar.gz`),
    },
  ];
}

/**
 * Resolve a GitHub release into downloadable assets.
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag
 * @param {string} [token]
 * @returns {Promise<{ name: string, files: Array }>}
 */
export async function resolveRelease(owner, repo, tag, token) {
  let data;
  try {
    data = await githubApi(releaseTagApiPath(owner, repo, tag), token);
  } catch (apiErr) {
    gopeed.logger.warn(
      '[GitHub 扩展] Release API 失败，改用页面解析:',
      (apiErr && apiErr.message) || String(apiErr),
    );
    return resolveReleaseFromPage(owner, repo, tag, token);
  }

  const tagName = data.tag_name || tag;
  const assets = Array.isArray(data.assets) ? data.assets : [];

  const files = assets.map((item) => ({
    name: item.name,
    size: item.size,
    req: buildDownloadReq(item.browser_download_url, token),
  }));

  if (files.length === 0) {
    for (const src of buildSourceArchives(owner, repo, tagName)) {
      const size = await fetchContentLength(src.url, token);
      files.push({
        name: src.name,
        ...(size != null && { size }),
        req: buildDownloadReq(src.url, token),
      });
    }
  }

  if (files.length === 0) {
    throwResolveError(`Error: Release has no downloadable assets (${repo} ${tagName})`);
  }

  gopeed.logger.info('[GitHub 扩展] Release 资产数:', String(files.length), 'tag:', tagName);

  return {
    name: `GitHub: ${repo}-releases-${tagName}`,
    files,
  };
}
