/**
 * 解析 GitHub 页面 URL，提取 owner、repo、ref、path
 * 支持:
 *   - /owner/repo
 *   - /owner/repo/tree/ref
 *   - /owner/repo/tree/ref/path/to/dir
 *   - /owner/repo/blob/ref/path/to/file
 * @param {URL} url
 * @returns {{ owner: string, repo: string, ref: string, path: string, isSingleFile: boolean } | null}
 */
export default function prepare(url) {
  const pathname = url.pathname.replace(/^\/+|\/+$/g, '');
  const pathParts = pathname ? pathname.split('/') : [];

  // 至少需要 owner/repo
  if (pathParts.length < 2) return null;

  const owner = pathParts[0];
  let repo = pathParts[1];

  // 去掉 .git 后缀
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  let ref = 'main';
  let path = '';
  let isSingleFile = false;

  if (pathParts[2] === 'tree' && pathParts.length >= 4) {
    ref = pathParts[3];
    path = pathParts.slice(4).join('/');
  } else if (pathParts[2] === 'blob' && pathParts.length >= 5) {
    ref = pathParts[3];
    path = pathParts.slice(4).join('/');
    isSingleFile = true;
  } else if (pathParts[2] === 'blob' && pathParts.length === 4) {
    ref = pathParts[3];
    path = '';
    isSingleFile = false;
  }
  // 否则: /owner/repo 或 /owner/repo/ -> ref=main, path=''

  gopeed.logger.debug('prepare:', { owner, repo, ref, path, isSingleFile });
  return { owner, repo, ref, path, isSingleFile };
}
