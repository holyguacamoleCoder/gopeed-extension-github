/**
 * 获取仓库文件列表：统一用 Git Tree API（commit + tree），根/子目录均一次拿树后按 path 过滤；支持 truncated 时递归拉取子树
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref - branch / tag / commit sha
 * @param {string} path - 仓库内路径，空表示根目录
 * @returns {Promise<{ data: Array<{ path: string, name: string, size: number, type: string }>, commitSha?: string }>}
 */
export default async function getMetaData(owner, repo, ref, path) {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  const token = gopeed.settings.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  gopeed.logger.debug('getMetaData commit:', commitUrl);
  const commitResp = await fetch(commitUrl, { headers });
  if (!commitResp.ok) {
    const text = await commitResp.text();
    throw new Error(`GitHub API ${commitResp.status}: ${text}`);
  }
  const commitData = await commitResp.json();
  const treeSha = commitData.commit?.tree?.sha;
  const commitSha = commitData.sha; // 用于 LFS Batch 的 ref（部分服务端按 commit 解析）
  if (!treeSha) throw new Error('No tree sha in commit response');

  const allBlobs = await fetchTreeBlobs(owner, repo, treeSha, '', headers);
  const data = path
    ? allBlobs.filter((item) => item.path.startsWith(path + '/'))
    : allBlobs;
  return { data, commitSha };
}

/**
 * 拉取一棵树下的所有 blob（递归）；若 API 返回 truncated 则改为非递归再逐棵拉取子树
 * @param {string} owner
 * @param {string} repo
 * @param {string} treeSha - 当前 tree 的 sha
 * @param {string} basePath - 当前树在仓库中的路径前缀，用于拼出 blob 的 path
 * @param {Record<string, string>} headers
 * @returns {Promise<Array<{ path: string, name: string, size: number, type: string }>>}
 */
async function fetchTreeBlobs(owner, repo, treeSha, basePath, headers) {
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
  gopeed.logger.debug('fetchTreeBlobs:', treeUrl);
  const resp = await fetch(treeUrl, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const tree = Array.isArray(data.tree) ? data.tree : [];

  const toBlobItem = (item, fullPath) => ({
    path: fullPath,
    name: fullPath.split('/').pop(),
    size: item.size || 0,
    type: 'blob',
  });

  if (!data.truncated) {
    return tree
      .filter((item) => item.type === 'blob')
      .map((item) => toBlobItem(item, basePath ? `${basePath}/${item.path}` : item.path));
  }

  // truncated（>100k 等）：改为非递归拉当前层，再对每个子树递归
  const nonRecUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}`;
  gopeed.logger.debug('fetchTreeBlobs truncated, fetching non-recursive:', nonRecUrl);
  const nonRecResp = await fetch(nonRecUrl, { headers });
  if (!nonRecResp.ok) {
    const text = await nonRecResp.text();
    throw new Error(`GitHub API ${nonRecResp.status}: ${text}`);
  }
  const nonRecData = await nonRecResp.json();
  const directTree = Array.isArray(nonRecData.tree) ? nonRecData.tree : [];
  const results = [];
  for (const item of directTree) {
    const fullPath = basePath ? `${basePath}/${item.path}` : item.path;
    if (item.type === 'blob') {
      results.push(toBlobItem(item, fullPath));
    } else if (item.type === 'tree') {
      const subBlobs = await fetchTreeBlobs(owner, repo, item.sha, fullPath, headers);
      results.push(...subBlobs);
    }
  }
  return results;
}
