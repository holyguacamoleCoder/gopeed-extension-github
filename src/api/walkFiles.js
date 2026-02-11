/**
 * 将 getMetaData 返回的扁平文件列表转为 GoPeed 所需的 files 格式
 * @param {Array<{ path: string, name: string, size: number }>} data
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref
 * @param {string} basePath - 当前解析的目录路径，用于计算保存路径
 * @param {{ resolved: Map<string, { href: string, header?: Record<string, string> }>, unresolved: Set<string> }} [lfs] - LFS 已解析与未解析路径
 * @returns {import('@gopeed/types').FileInfo[]}
 */
export default function walkFiles(data, owner, repo, ref, basePath, lfs) {
  if (!data || !Array.isArray(data)) return [];

  const token = gopeed.settings.token;
  const defaultExtra = token ? { header: { Authorization: `Bearer ${token}` } } : undefined;
  const lfsResolved = lfs && lfs.resolved ? lfs.resolved : new Map();
  const lfsUnresolved = lfs && lfs.unresolved ? lfs.unresolved : new Set();

  return data.map((item) => {
    const resolved = lfsResolved.get(item.path);
    const isUnresolvedLfs = lfsUnresolved.has(item.path);
    const url = resolved ? resolved.href : `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${item.path}`;
    const extra =
      resolved && resolved.header
        ? { header: { ...(defaultExtra && defaultExtra.header), ...resolved.header } }
        : defaultExtra;
    const dirPath = item.path.includes('/') ? item.path.split('/').slice(0, -1).join('/') : '';
    const savePath = dirPath ? `${repo}/${dirPath}` : repo;
    const labels = {};
    if (resolved) labels.LFS = '是';
    else if (isUnresolvedLfs) labels.LFS = '对象不存在(将下到指针文件)';
    return {
      name: item.name,
      path: savePath,
      size: item.size,
      ...(Object.keys(labels).length > 0 && { labels }),
      req: {
        url,
        ...(extra && { extra }),
      },
    };
  });
}
