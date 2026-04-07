/*
 * GoPeed GitHub 扩展入口
 * 解析 GitHub 仓库 / 目录 URL，返回可下载文件列表；支持 Git LFS
 */
import prepare from './api/prepare.js';
import getMetaData from './api/getMetaData.js';
import walkFiles, { LFS_LABEL_UNRESOLVED } from './api/walkFiles.js';
import { resolveRefAndPath } from './utils/resolveGithubRef.js';
import { formatResolveError } from './utils/formatResolveError.js';
import buildReqExtra from './utils/buildReqExtra.js';
import { resolveLfsUrls, parseLfsPointer, fetchLfsBatch } from './api/lfs.js';

gopeed.events.onResolve(async function (ctx) {
  try {
    const url = new URL(ctx.req.url);
    gopeed.logger.info('[GitHub 扩展] 收到 URL:', ctx.req.url);

    let parsed = prepare(url);
    if (!parsed) {
      ctx.res = {
        name: 'Error: Unsupported GitHub URL (only repository, tree, and blob links are supported)',
        files: [],
      };
      return;
    }

    const token = gopeed.settings.token;
    if (parsed.needsRefResolve && parsed.segments) {
      const headers = { Accept: 'application/vnd.github.v3+json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resolved = await resolveRefAndPath(parsed.owner, parsed.repo, parsed.segments, headers);
      if (!resolved) {
        ctx.res = {
          name: 'Error: Could not resolve branch or path (check the URL, repository, or set a GitHub token)',
          files: [],
        };
        return;
      }
      parsed = {
        owner: parsed.owner,
        repo: parsed.repo,
        ref: resolved.ref,
        path: resolved.path,
        isSingleFile: parsed.isSingleFile,
      };
    }

    const { owner, repo, ref, path: repoPath, isSingleFile } = parsed;

    let files;
    if (isSingleFile) {
      files = await buildSingleFile(owner, repo, ref, repoPath, token);
    } else {
      const meta = await getMetaData(owner, repo, ref, repoPath);
      const data = meta.data || meta;
      const commitSha = meta.commitSha;
      const lfs = await resolveLfsUrls(data, owner, repo, ref, token, commitSha);
      files = walkFiles(data, owner, repo, ref, repoPath, lfs);
    }

    const taskName = repoPath ? `${repo}/${repoPath}`.replace(/\/$/, '') : repo;
    const lfsUnresolvedHint =
      files && files.some((f) => f.labels && f.labels.LFS === LFS_LABEL_UNRESOLVED) ? ' (LFS unresolved)' : '';
    ctx.res = {
      name: `GitHub: ${taskName}${lfsUnresolvedHint}`,
      files,
    };
    gopeed.logger.debug('ctx.res:', JSON.stringify(ctx.res));
  } catch (err) {
    gopeed.logger.error('[GitHub Parser]', err);
    ctx.res = {
      name: formatResolveError(err),
      files: [],
    };
  }
});

/**
 * 单文件：若为 LFS 指针则解析为真实下载地址；未解析时加 labels 提醒
 */
async function buildSingleFile(owner, repo, ref, repoPath, token) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${repoPath}`;
  const name = repoPath.split('/').pop();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Range = 'bytes=0-499';
  let url = rawUrl;
  let extra = buildReqExtra(token);
  let lfsUnresolved = false;
  try {
    const resp = await fetch(rawUrl, { headers });
    if (resp.ok) {
      const text = await resp.text();
      const pointer = parseLfsPointer(text);
      if (pointer) {
        const oidMap = await fetchLfsBatch(owner, repo, ref, [pointer], token);
        const action =
          oidMap.get(pointer.oid) ||
          oidMap.get(pointer.oid.startsWith('sha256:') ? pointer.oid.slice(7) : pointer.oid);
        if (action) {
          url = action.href;
          extra = action.header
            ? { header: { ...(token && { Authorization: `Bearer ${token}` }), ...action.header } }
            : buildReqExtra(token);
        } else lfsUnresolved = true;
      }
    }
  } catch (_) {
    // 失败则用 raw URL
  }
  const labels = lfsUnresolved ? { LFS: LFS_LABEL_UNRESOLVED } : undefined;
  return [
    {
      name,
      path: repo,
      ...(labels && { labels }),
      req: { url, ...(extra && { extra }) },
    },
  ];
}
