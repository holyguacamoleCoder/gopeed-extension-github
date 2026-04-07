/**
 * Map thrown errors to user-facing English task names.
 * @param {unknown} err
 * @returns {string}
 */
export function formatResolveError(err) {
  const msg = (err && err.message) || String(err);
  if (msg.indexOf('403') !== -1 && msg.indexOf('rate limit') !== -1) {
    return 'Error: API rate limit exceeded. Add a GitHub token in extension settings.';
  }
  if (msg.indexOf('401') !== -1) {
    return 'Error: Unauthorized (401). Check that your GitHub token is valid.';
  }
  if (msg.indexOf('404') !== -1) {
    return 'Error: Repository, branch, or file not found (404), or access denied.';
  }
  if (msg.indexOf('GitHub API') !== -1) {
    const short = msg.length > 180 ? msg.slice(0, 177) + '…' : msg;
    return `Error: ${short}`;
  }
  if (msg && msg !== 'undefined') {
    const short = msg.length > 180 ? msg.slice(0, 177) + '…' : msg;
    return `Error: ${short}`;
  }
  return 'Error: Resolution failed';
}
