/*
 * GoPeed GitHub 扩展入口
 * 解析 GitHub 仓库 / 目录 URL，返回可下载文件列表
 */
import prepare from './api/prepare.js';
import getMetaData from './api/getMetaData.js';
import walkFiles from './api/walkFiles.js';

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

    let files;
    if (isSingleFile) {
      // 单文件：直接构造一个文件项
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${repoPath}`;
      const name = repoPath.split('/').pop();
      files = [
        {
          name,
          path: repo,
          req: {
            url: rawUrl,
            extra: buildReqExtra(),
          },
        },
      ];
    } else {
      const data = await getMetaData(owner, repo, ref, repoPath);
      files = walkFiles(data, owner, repo, ref, repoPath);
    }

    // 任务名加前缀，便于确认是本扩展在处理（若看到「GitHub:」说明跑的是我们）
    const taskName = repoPath ? `${repo}/${repoPath}`.replace(/\/$/, '') : repo;
    ctx.res = {
      name: `GitHub: ${taskName}`,
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

function buildReqExtra() {
  const token = gopeed.settings.token;
  if (!token) return undefined;
  return {
    header: {
      Authorization: `Bearer ${token}`,
    },
  };
}
