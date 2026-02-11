/**
 * 获取仓库文件列表：根目录用 Git Tree API（一次拿整棵树），子目录用 Contents API 递归
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

  if (!path) {
    return await getMetaDataViaTree(owner, repo, ref, headers);
  }
  const data = await getMetaDataViaContents(owner, repo, ref, path, headers);
  return { data, commitSha: undefined };
}

/**
 * 通过 Git Tree API 获取整棵文件树，再过滤出根目录下所有文件（含子目录内）
 */
async function getMetaDataViaTree(owner, repo, ref, headers) {
  const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  gopeed.logger.debug('getMetaDataViaTree commit:', commitUrl);
  const commitResp = await fetch(commitUrl, { headers });
  if (!commitResp.ok) {
    const text = await commitResp.text();
    throw new Error(`GitHub API ${commitResp.status}: ${text}`);
  }
  const commitData = await commitResp.json();
  const treeSha = commitData.commit?.tree?.sha;
  const commitSha = commitData.sha; // 用于 LFS Batch 的 ref（部分服务端按 commit 解析）
  if (!treeSha) throw new Error('No tree sha in commit response');

  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
  gopeed.logger.debug('getMetaDataViaTree tree:', treeUrl);
  const treeResp = await fetch(treeUrl, { headers });
  if (!treeResp.ok) {
    const text = await treeResp.text();
    throw new Error(`GitHub API ${treeResp.status}: ${text}`);
  }
  const treeData = await treeResp.json();
  const tree = treeData.tree;
  if (!Array.isArray(tree)) return { data: [], commitSha };

  const data = tree
    .filter((item) => item.type === 'blob')
    .map((item) => ({
      path: item.path,
      name: item.path.split('/').pop(),
      size: item.size || 0,
      type: 'blob',
    }));
  return { data, commitSha };
}

/**
 * 子目录用 Contents API 递归
 */
async function getMetaDataViaContents(owner, repo, ref, path, headers) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  gopeed.logger.debug('getMetaDataViaContents:', apiUrl);
  const resp = await fetch(apiUrl, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data)) return [];

  const result = await Promise.all(
    data.map(async (item) => {
      if (item.type === 'dir') {
        const subPath = `${path}/${item.name}`;
        return await getMetaDataViaContents(owner, repo, ref, subPath, headers);
      }
      return [
        {
          path: item.path,
          name: item.name,
          size: item.size || 0,
          type: item.type,
        },
      ];
    })
  );
  return result.flat(Infinity);
}
