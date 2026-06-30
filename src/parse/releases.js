/**
 * Parse releases URLs: /owner/repo/releases[/latest|/tag/{tag}|/expanded_assets/{tag}|/download/{tag}/...]
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} rest - path segments after 'releases'
 * @returns {object}
 */
export default function parseReleases(owner, repo, rest) {
  if (rest.length >= 3 && rest[0] === 'download') {
    const tag = rest[1];
    const assetName = rest.slice(2).join('/');
    const downloadUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${assetName}`;
    return {
      type: 'release_asset',
      owner,
      repo,
      tag,
      assetName,
      downloadUrl,
    };
  }

  let tag = 'latest';

  if (rest.length === 0 || rest[0] === 'latest') {
    tag = 'latest';
  } else if (rest[0] === 'tag' && rest.length >= 2) {
    tag = rest.slice(1).join('/');
  } else if (rest[0] === 'expanded_assets' && rest.length >= 2) {
    tag = rest.slice(1).join('/');
  } else if (rest[0] === 'tag' || rest[0] === 'latest') {
    tag = 'latest';
  } else if (rest[0] === 'download') {
    tag = 'latest';
  } else {
    tag = rest.join('/');
  }

  return { type: 'releases', owner, repo, tag };
}
