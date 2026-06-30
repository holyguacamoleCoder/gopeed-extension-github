/** Bump when verifying which build is loaded in Gopeed. */
export const EXT_VERSION = '1.2.3';

/** Shown in task name so you can tell this extension handled the URL (not a competitor). */
export const EXT_MARKER = `github-ext-v${EXT_VERSION}`;

/**
 * @param {{ name?: string, files?: Array } | undefined} res
 * @returns {typeof res}
 */
export function stampExtensionMarker(res) {
  if (!res || !res.name || res.name.startsWith('Error:')) return res;
  if (res.name.includes(EXT_MARKER)) return res;
  return { ...res, name: `${EXT_MARKER}: ${res.name}` };
}
