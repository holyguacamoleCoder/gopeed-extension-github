/**
 * Normalize GitHub archive path segments to a valid download ref (with archive extension).
 * @param {string} archiveRef
 * @returns {string}
 */
export function normalizeArchiveRef(archiveRef) {
  if (!archiveRef) return archiveRef;

  const trimmed = archiveRef.replace(/\/+$/, '');
  if (/\.(zip|tar\.gz|tgz)$/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('refs/tags/') || trimmed.startsWith('refs/heads/')) {
    return `${trimmed}.zip`;
  }

  if (/^v[\d.]/i.test(trimmed) && !trimmed.includes('/')) {
    return `refs/tags/${trimmed}.zip`;
  }

  if (!trimmed.includes('/')) {
    return `refs/heads/${trimmed}.zip`;
  }

  return `${trimmed}.zip`;
}
