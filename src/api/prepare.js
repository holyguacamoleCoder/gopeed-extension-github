import { normalizeGithubPathSegments } from '../utils/normalizeGithubPathname.js';

/**
 * 解析 GitHub 页面 URL，提取 owner、repo、ref、path
 * 支持:
 *   - /owner/repo
 *   - /owner/repo/tree/ref
 *   - /owner/repo/tree/ref/path/to/dir（含 ref 含 / 时由 index 调用 API 解析）
 *   - /owner/repo/blob/ref/path/to/file
 * pathname 经 normalizeGithubPathSegments 规范化（合并重复斜杠、去空段）。
 * @param {URL} url
 * @returns {{ owner: string, repo: string, ref: string, path: string, isSingleFile: boolean, needsRefResolve?: boolean, segments?: string[] } | null}
 */
export default function prepare(url) {
  const pathParts = normalizeGithubPathSegments(url.pathname);

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
    const segments = pathParts.slice(3);
    if (segments.length === 1) {
      ref = segments[0];
      path = '';
    } else {
      return { owner, repo, ref: '', path: '', isSingleFile: false, needsRefResolve: true, segments };
    }
  } else if (pathParts[2] === 'blob' && pathParts.length >= 5) {
    const segments = pathParts.slice(3);
    if (segments.length === 2) {
      ref = segments[0];
      path = segments[1];
      isSingleFile = true;
    } else if (segments.length >= 3) {
      return { owner, repo, ref: '', path: '', isSingleFile: true, needsRefResolve: true, segments };
    }
  } else if (pathParts[2] === 'blob' && pathParts.length === 4) {
    ref = pathParts[3];
    path = '';
    isSingleFile = false;
  } else if (pathParts.length >= 3 && pathParts[2] !== '') {
    return null; // 非 tree/blob，如 issues、releases、commits 等，不解析为下载
  }
  // 否则: /owner/repo 或 /owner/repo/ -> ref=main, path=''

  gopeed.logger.debug('prepare:', { owner, repo, ref, path, isSingleFile });
  return { owner, repo, ref, path, isSingleFile };
}
