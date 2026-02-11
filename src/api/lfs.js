/**
 * Git LFS 支持：解析指针文件，通过 Batch API 获取真实下载地址
 */

const LFS_VERSION_PREFIX = 'version https://git-lfs.github.com/spec/v1';
const CONCURRENCY = 6;
const RANGE_SIZE = 512;

/**
 * 解析 LFS 指针内容，提取 oid 和 size
 * @param {string} text - 文件前几百字节的文本
 * @returns {{ oid: string, size: number } | null}
 */
export function parseLfsPointer(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith(LFS_VERSION_PREFIX)) return null;
  let oid = '';
  let size = 0;
  const lines = trimmed.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('oid ')) {
      oid = line.slice(4).trim();
      break;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('size ')) {
      const n = parseInt(line.slice(5).trim(), 10);
      if (!isNaN(n)) size = n;
      break;
    }
  }
  if (!oid) return null;
  return { oid, size };
}

/**
 * Base64 编码（兼容无 btoa 的运行环境）
 */
function base64Encode(str) {
  if (typeof btoa !== 'undefined') return btoa(str);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  const len = str.length;
  while (i < len) {
    const a = str.charCodeAt(i++);
    const b = i < len ? str.charCodeAt(i++) : 0;
    const c = i < len ? str.charCodeAt(i++) : 0;
    const n = (a << 16) | (b << 8) | c;
    result += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  const r = len % 3;
  const outLen = r === 0 ? result.length : r === 1 ? result.length - 2 : result.length - 1;
  return result.slice(0, outLen) + (r === 1 ? '==' : r === 2 ? '=' : '');
}

/**
 * 调用 GitHub LFS Batch API，获取一批对象的下载地址
 * GitHub LFS 推荐使用 Basic 认证（username:token）
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref - 分支名如 main，或 tag、commit sha
 * @param {Array<{ oid: string, size: number }>} objects
 * @param {string} [token]
 * @param {string} [commitSha] - 当前 ref 对应的 commit SHA（40 位），部分服务端需用 commit 作 ref
 * @returns {Promise<Map<string, { href: string, header?: Record<string, string> }>>} oid -> { href, header }
 */
export async function fetchLfsBatch(owner, repo, ref, objects, token, commitSha) {
  if (!objects || objects.length === 0) return new Map();

  const lfsUrl = `https://github.com/${owner}/${repo}.git/info/lfs/objects/batch`;
  const baseHeaders = {
    Accept: 'application/vnd.git-lfs+json',
    'Content-Type': 'application/vnd.git-lfs+json',
  };
  // GitHub 可能期望 oid 为纯 64 位 hex，不含 "sha256:" 前缀（与指针文件格式不同）
  const toBatchOid = (oid) => (oid.startsWith('sha256:') ? oid.slice(7) : oid);
  const payload = {
    operation: 'download',
    transfers: ['basic'],
    hash_algo: 'sha256',
    objects: objects.map((o) => ({ oid: toBatchOid(o.oid), size: o.size })),
  };
  const refsToTry = [];
  if (commitSha && /^[0-9a-fA-F]{40}$/.test(commitSha)) refsToTry.push(commitSha);
  const branchRef = ref.startsWith('refs/') ? ref : `refs/heads/${ref}`;
  refsToTry.push(branchRef);

  const tryRequest = async (authHeader, refName) => {
    const headers = { ...baseHeaders };
    if (authHeader) headers.Authorization = authHeader;
    const body = refName != null ? { ...payload, ref: { name: refName } } : payload;
    return fetch(lfsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  };

  const has404 = (data) => Array.isArray(data?.objects) && data.objects.some((o) => o.error && o.error.code === 404);

  gopeed.logger.debug('[LFS] Batch request:', lfsUrl, 'objects:', objects.length);

  // 认证方式顺序：先无认证（公开仓库），再 Bearer，再两种 Basic
  const authVariants = [
    null,
    ...(token
      ? [
          'Bearer ' + token,
          'Basic ' + base64Encode('token:' + token),
          'Basic ' + base64Encode('x-oauth-basic:' + token),
        ]
      : []),
  ];
  let data = null;
  let resp = null;
  // 先试无 ref，再试 commit SHA，再试 refs/heads/xxx
  const refOptions = [null, ...refsToTry];

  for (const auth of authVariants) {
    for (const refName of refOptions) {
      resp = await tryRequest(auth, refName);
      if (!resp.ok) continue;
      const parsed = await resp.json();
      if (!has404(parsed)) {
        data = parsed;
        break;
      }
      data = parsed;
    }
    if (data && !has404(data)) break;
  }

  if (!resp || !resp.ok) {
    if (resp) {
      const text = await resp.text();
      gopeed.logger.warn('[LFS] Batch API error:', resp.status, text);
    }
    return new Map();
  }

  const result = new Map();
  const list = data && Array.isArray(data.objects) ? data.objects : [];

  for (let i = 0; i < list.length; i++) {
    const obj = list[i];
    if (obj.error) {
      const errCode = obj.error.code;
      const errMsg = obj.error.message || '';
      gopeed.logger.warn('[LFS] Object error:', obj.oid, 'code:', errCode, 'message:', errMsg);
      continue;
    }
    const actions = obj.actions;
    const download = actions && actions.download;
    if (!download || !download.href) continue;
    result.set(obj.oid, {
      href: download.href,
      header: download.header || undefined,
    });
  }
  return result;
}

/**
 * 对文件列表做 Range 请求，检测 LFS 指针并收集 oid/size
 * @param {Array<{ path: string, name: string, size: number }>} data
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref
 * @param {string} [token]
 * @returns {Promise<Map<string, { oid: string, size: number }>>} path -> { oid, size }
 */
async function detectLfsPointers(data, owner, repo, ref, token) {
  const pointers = new Map();
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/`;

  const runOne = async (item) => {
    const rawUrl = rawBase + item.path;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    headers.Range = `bytes=0-${RANGE_SIZE - 1}`;
    try {
      const resp = await fetch(rawUrl, { headers });
      if (!resp.ok) return;
      const text = await resp.text();
      const parsed = parseLfsPointer(text);
      if (parsed) pointers.set(item.path, parsed);
    } catch (_) {
      // 忽略单文件失败，继续用 raw URL
    }
  };

  for (let i = 0; i < data.length; i += CONCURRENCY) {
    const chunk = data.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(runOne));
  }

  return pointers;
}

/**
 * 解析文件列表中的 LFS 指针，返回「已解析」与「未解析」的 LFS 路径
 * 识别方式：对每个文件发 Range 请求取前 512 字节，若以 version https://git-lfs.github.com/spec/v1 开头则视为 LFS 指针
 * @param {Array<{ path: string, name: string, size: number }>} data
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref
 * @param {string} [token]
 * @returns {Promise<{ resolved: Map<string, { href: string, header?: Record<string, string> }>, unresolved: Set<string> }>}
 *   resolved: 成功拿到真实下载地址的 path -> { href, header }
 *   unresolved: 检测到是 LFS 指针但服务器返回错误（如 404 对象不存在）的 path 集合，用于在列表中提醒用户
 */
export async function resolveLfsUrls(data, owner, repo, ref, token, commitSha) {
  const empty = { resolved: new Map(), unresolved: new Set() };
  if (!data || data.length === 0) return empty;

  const pathToLfs = await detectLfsPointers(data, owner, repo, ref, token);
  if (pathToLfs.size === 0) return empty;

  const objects = Array.from(pathToLfs.values());
  const oidToAction = await fetchLfsBatch(owner, repo, ref, objects, token, commitSha);

  const resolved = new Map();
  const unresolved = new Set();
  for (const [path, { oid }] of pathToLfs) {
    const action = oidToAction.get(oid) || oidToAction.get(oid.startsWith('sha256:') ? oid.slice(7) : oid);
    if (action) resolved.set(path, action);
    else unresolved.add(path);
  }
  gopeed.logger.debug('[LFS] Resolved', resolved.size, 'unresolved', unresolved.size);
  return { resolved, unresolved };
}
