import { normalizeGithubPathSegments } from '../utils/normalizeGithubPathname.js';
import { extractReleaseTagFromArchive } from '../utils/codeloadUrl.js';
import parseTreeBlob from './treeBlob.js';
import parseReleases from './releases.js';
import parseArchive from './archive.js';

/**
 * Parse github.com pathname into a typed result.
 * @param {URL} url
 * @returns {object | null}
 */
export default function parseGithubCom(url) {
  const pathParts = normalizeGithubPathSegments(url.pathname);
  if (pathParts.length < 2) return null;

  const owner = pathParts[0];
  let repo = pathParts[1];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  if (pathParts.length === 2) {
    return { type: 'tree', owner, repo, ref: 'main', path: '', autoMain: true };
  }

  const section = pathParts[2];

  if (section === 'releases') {
    return parseReleases(owner, repo, pathParts.slice(3));
  }

  if (section === 'archive') {
    const archiveRest = pathParts.slice(3);
    const archiveRef = archiveRest.join('/');
    const releaseTag = extractReleaseTagFromArchive(archiveRef);
    if (releaseTag) {
      return { type: 'releases', owner, repo, tag: releaseTag };
    }
    return parseArchive(owner, repo, archiveRest);
  }

  if (section === 'tree' || section === 'blob') {
    return parseTreeBlob(pathParts);
  }

  return null;
}
