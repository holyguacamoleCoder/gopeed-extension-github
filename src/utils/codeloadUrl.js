/**
 * Build codeload.github.com URL (direct archive download, avoids redirect).
 * @param {string} owner
 * @param {string} repo
 * @param {string} archiveRef - normalized, e.g. refs/heads/main.zip
 * @returns {string}
 */
export function buildCodeloadArchiveUrl(owner, repo, archiveRef) {
  const isTar = /\.tar\.gz$/i.test(archiveRef) || /\.tgz$/i.test(archiveRef);
  let ref = archiveRef.replace(/\.(zip|tar\.gz|tgz)$/i, '');
  if (!ref.startsWith('refs/')) {
    ref = /^v[\d.]/i.test(ref) ? `refs/tags/${ref}` : `refs/heads/${ref}`;
  }
  const kind = isTar ? 'tar' : 'zip';
  return `https://codeload.github.com/${owner}/${repo}/${kind}/${ref}`;
}

/**
 * Display filename matching GitHub's archive naming: {repo}-{ref}.zip
 * @param {string} repo
 * @param {string} archiveRef - normalized
 * @returns {string}
 */
export function archiveDisplayName(repo, archiveRef) {
  const isTar = /\.tar\.gz$/i.test(archiveRef) || /\.tgz$/i.test(archiveRef);
  const ext = isTar ? '.tar.gz' : '.zip';
  let ref = archiveRef.replace(/\.(zip|tar\.gz|tgz)$/i, '');

  if (ref.startsWith('refs/heads/')) {
    return `${repo}-${ref.slice('refs/heads/'.length)}${ext}`;
  }
  if (ref.startsWith('refs/tags/')) {
    return `${repo}-${ref.slice('refs/tags/'.length)}${ext}`;
  }
  return `${repo}-${ref}${ext}`;
}

/**
 * If archive path points at a release tag, return tag name for Releases API.
 * @param {string} archiveRef
 * @returns {string | null}
 */
export function extractReleaseTagFromArchive(archiveRef) {
  if (!archiveRef) return null;
  const withoutExt = archiveRef.replace(/\.(zip|tar\.gz|tgz)$/i, '');
  const tagMatch = withoutExt.match(/^refs\/tags\/(.+)$/);
  if (tagMatch) return tagMatch[1];
  if (/^v[\d.]/i.test(withoutExt) && !withoutExt.includes('/')) {
    return withoutExt;
  }
  return null;
}
