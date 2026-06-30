/*
 * GoPeed GitHub 扩展入口
 * 解析 GitHub 仓库 / 目录 / Releases / Archive / Gist / raw 链接，返回可下载文件列表；支持 Git LFS
 */
import parseUrl from './parse/index.js';
import getMetaData from './api/getMetaData.js';
import walkFiles, { LFS_LABEL_UNRESOLVED } from './api/walkFiles.js';
import { resolveRelease } from './api/releases.js';
import { resolveReleaseAsset } from './api/releaseAsset.js';
import { resolveArchive } from './api/archive.js';
import { resolveGist, resolveDirectUrl } from './api/gist.js';
import { resolveRefAndPath } from './utils/resolveGithubRef.js';
import { formatResolveError } from './utils/formatResolveError.js';
import buildDownloadReq from './utils/buildDownloadReq.js';
import { fetchContentLength } from './utils/fetchContentLength.js';
import { fetchRepoFileSize } from './utils/repoFileSize.js';
import { resolveLfsUrls, parseLfsPointer, fetchLfsBatch } from './api/lfs.js';
import { stampExtensionMarker, EXT_MARKER } from './utils/extensionMarker.js';
import { throwResolveError } from './utils/throwResolveError.js';

const UNSUPPORTED_MSG =
  `Error: Unsupported URL (${EXT_MARKER}; supported: tree, blob, releases, archive, gist, raw)`;

function ensureResolvableResult(res) {
  if (!res || !Array.isArray(res.files) || res.files.length === 0) {
    const msg = (res && res.name) || 'Error: No downloadable files';
    throwResolveError(msg.startsWith('Error:') ? msg : `Error: ${msg}`);
  }
}

gopeed.events.onResolve(async function (ctx) {
  const buildTag = `${EXT_MARKER} manifest=${gopeed.info && gopeed.info.version ? gopeed.info.version : '?'}`;
  gopeed.logger.info(`[GitHub 扩展] ===== ${buildTag} =====`);
  gopeed.logger.info(`[GitHub 扩展] 收到 URL: ${ctx.req.url}`);

  try {
    const url = new URL(ctx.req.url);
    const parsed = parseUrl(url);
    if (!parsed) {
      throwResolveError(UNSUPPORTED_MSG);
    }

    gopeed.logger.info(
      `[GitHub 扩展] 解析类型: ${parsed.type} owner=${parsed.owner} repo=${parsed.repo}` +
        (parsed.tag ? ` tag=${parsed.tag}` : '') +
        (parsed.archiveRef ? ` archiveRef=${parsed.archiveRef}` : ''),
    );

    const token = gopeed.settings.token;

    switch (parsed.type) {
      case 'releases':
        ctx.res = await resolveRelease(parsed.owner, parsed.repo, parsed.tag, token);
        break;

      case 'release_asset':
        ctx.res = await resolveReleaseAsset(parsed, token);
        break;

      case 'archive':
        ctx.res = await resolveArchive(parsed.owner, parsed.repo, parsed.archiveRef, token);
        break;

      case 'raw':
        ctx.res = await resolveDirectUrl(parsed, token);
        break;

      case 'gist_raw':
        ctx.res = await resolveDirectUrl(parsed, token);
        break;

      case 'gist':
        ctx.res = await resolveGist(parsed.gistId, token);
        break;

      case 'blob':
        ctx.res = await resolveBlob(parsed, token);
        break;

      case 'tree':
        ctx.res = await resolveTree(parsed, token);
        break;

      default:
        throwResolveError(UNSUPPORTED_MSG);
    }

    ensureResolvableResult(ctx.res);
    ctx.res = stampExtensionMarker(ctx.res);
    gopeed.logger.debug('ctx.res:', JSON.stringify(ctx.res));
  } catch (err) {
    gopeed.logger.error('[GitHub Parser]', err);
    if (err && err.name === 'MessageError') {
      throw err;
    }
    throwResolveError(formatResolveError(err));
  }
});

/**
 * @param {object} parsed
 * @param {string} [token]
 */
async function resolveBlob(parsed, token) {
  let { owner, repo, ref, path: repoPath } = parsed;

  if (parsed.needsRefResolve && parsed.segments) {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resolved = await resolveRefAndPath(parsed.owner, parsed.repo, parsed.segments, headers);
    if (!resolved) {
      throwResolveError(
        'Error: Could not resolve branch or path (check the URL, repository, or set a GitHub token)',
      );
    }
    ref = resolved.ref;
    repoPath = resolved.path;
  }

  const files = await buildSingleFile(owner, repo, ref, repoPath, token);
  return {
    name: `GitHub: ${repoPath.split('/').pop()}`,
    files,
  };
}

/**
 * @param {object} parsed
 * @param {string} [token]
 */
async function resolveTree(parsed, token) {
  let { owner, repo, ref, path: repoPath } = parsed;

  if (parsed.autoMain) {
    gopeed.logger.info('[GitHub 扩展] URL 未含 /tree/<分支>，默认按 main 分支解析');
  }

  if (parsed.needsRefResolve && parsed.segments) {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resolved = await resolveRefAndPath(parsed.owner, parsed.repo, parsed.segments, headers);
    if (!resolved) {
      throwResolveError(
        'Error: Could not resolve branch or path (check the URL, repository, or set a GitHub token)',
      );
    }
    ref = resolved.ref;
    repoPath = resolved.path;
  }

  const meta = await getMetaData(owner, repo, ref, repoPath);
  const data = meta.data || meta;
  const commitSha = meta.commitSha;
  const lfs = await resolveLfsUrls(data, owner, repo, ref, token, commitSha);
  const files = walkFiles(data, owner, repo, ref, repoPath, lfs);

  const taskName = repoPath ? `${repo}/${repoPath}`.replace(/\/$/, '') : repo;
  const lfsUnresolvedHint = files.some((f) => f.labels && f.labels.LFS === LFS_LABEL_UNRESOLVED)
    ? ' (LFS unresolved)'
    : '';

  return {
    name: `GitHub: ${taskName}${lfsUnresolvedHint}`,
    files,
  };
}

/**
 * 单文件：若为 LFS 指针则解析为真实下载地址；未解析时加 labels 提醒
 */
async function buildSingleFile(owner, repo, ref, repoPath, token) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${repoPath}`;
  const name = repoPath.split('/').pop();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Range = 'bytes=0-499';

  let downloadUrl = rawUrl;
  let actionHeaders;
  let lfsUnresolved = false;
  let size;
  let rangeResp;

  try {
    rangeResp = await fetch(rawUrl, { headers });
    if (rangeResp.ok) {
      const text = await rangeResp.text();
      const pointer = parseLfsPointer(text);
      if (pointer) {
        size = pointer.size;
        const oidMap = await fetchLfsBatch(owner, repo, ref, [pointer], token);
        const action =
          oidMap.get(pointer.oid) ||
          oidMap.get(pointer.oid.startsWith('sha256:') ? pointer.oid.slice(7) : pointer.oid);
        if (action) {
          downloadUrl = action.href;
          actionHeaders = action.header;
        } else {
          lfsUnresolved = true;
        }
      }
    }
  } catch (_) {
    // 失败则用 raw URL
  }

  if (size == null) {
    size =
      (await fetchContentLength(rawUrl, token, rangeResp)) ??
      (await fetchRepoFileSize(owner, repo, ref, repoPath, token));
  }

  const labels = lfsUnresolved ? { LFS: LFS_LABEL_UNRESOLVED } : undefined;
  return [
    {
      name,
      path: repo,
      ...(size != null && { size }),
      ...(labels && { labels }),
      req: buildDownloadReq(downloadUrl, token, actionHeaders),
    },
  ];
}
