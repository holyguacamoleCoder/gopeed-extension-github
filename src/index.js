/*
 * GoPeed GitHub 扩展入口
 * 解析 GitHub 仓库 / 目录 URL，返回可下载文件列表；支持 Git LFS
 */
import prepare from './api/prepare.js';
import getMetaData from './api/getMetaData.js';
import walkFiles from './api/walkFiles.js';
import { resolveLfsUrls, parseLfsPointer, fetchLfsBatch } from './api/lfs.js';

gopeed.events.onResolve(async function (ctx) {
  try {
    const url = new URL(ctx.req.url);
    gopeed.logger.info('[GitHub 扩展] 收到 URL:', ctx.req.url);

    const parsed = prepare(url);
    if (!parsed) {
      ctx.res = { name: 'Error', files: [] };
      return;
    }

    const { owner, repo, ref, path: repoPath, isSingleFile } = parsed;
    const token = gopeed.settings.token;

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

    // 任务名加前缀；若有 LFS 未解析（如 404 对象不存在）则在任务名中提醒
    const taskName = repoPath ? `${repo}/${repoPath}`.replace(/\/$/, '') : repo;
    const lfsUnresolvedHint =
      files && files.some((f) => f.labels && f.labels.LFS === '对象不存在(将下到指针文件)') ? ' (含 LFS 未解析)' : '';
    ctx.res = {
      name: `GitHub: ${taskName}${lfsUnresolvedHint}`,
      files,
    };
    gopeed.logger.debug('ctx.res:', JSON.stringify(ctx.res));
  } catch (err) {
    gopeed.logger.error('[GitHub Parser]', err);
    const msg = (err && err.message) || '';
    const isRateLimit = msg.indexOf('403') !== -1 && msg.indexOf('rate limit') !== -1;
    ctx.res = {
      name: isRateLimit ? 'Error: API 限流，请在扩展设置中配置 GitHub Token' : 'Error',
      files: [],
    };
  }
});

function buildReqExtra(token) {
  if (!token) return undefined;
  return {
    header: {
      Authorization: `Bearer ${token}`,
    },
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
        const action = oidMap.get(pointer.oid);
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
  const labels = lfsUnresolved ? { LFS: '对象不存在(将下到指针文件)' } : undefined;
  return [
    {
      name,
      path: repo,
      ...(labels && { labels }),
      req: { url, ...(extra && { extra }) },
    },
  ];
}
