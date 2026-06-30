/**
 * Abort resolve with a user-visible error (prevents Gopeed HTTP fallback on empty files).
 * @param {string} message
 * @returns {never}
 */
export function throwResolveError(message) {
  throw new MessageError(message);
}
