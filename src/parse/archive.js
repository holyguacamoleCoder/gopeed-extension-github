/**
 * Parse archive URLs: /owner/repo/archive/{archiveRef}
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} rest - path segments after 'archive'
 * @returns {{ type: 'archive', owner: string, repo: string, archiveRef: string } | null}
 */
export default function parseArchive(owner, repo, rest) {
  if (!rest || rest.length === 0) return null;

  const archiveRef = rest.join('/');
  return { type: 'archive', owner, repo, archiveRef };
}
