/**
 * 将 getMetaData 返回的扁平文件列表转为 GoPeed 所需的 files 格式
 * @param {Array<{ path: string, name: string, size: number }>} data
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref
 * @param {string} basePath - 当前解析的目录路径，用于计算保存路径
 * @returns {import('@gopeed/types').FileInfo[]}
 */
export default function walkFiles(data, owner, repo, ref, basePath) {
  if (!data || !Array.isArray(data)) return [];

  const token = gopeed.settings.token;
  const extra = token ? { header: { Authorization: `Bearer ${token}` } } : undefined;

  return data.map((item) => {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${item.path}`;
    // 保存到本地的目录：repo/ 下的父路径
    const dirPath = item.path.includes('/') ? item.path.split('/').slice(0, -1).join('/') : '';
    const savePath = dirPath ? `${repo}/${dirPath}` : repo;
    return {
      name: item.name,
      path: savePath,
      size: item.size,
      req: {
        url: rawUrl,
        ...(extra && { extra }),
      },
    };
  });
}
