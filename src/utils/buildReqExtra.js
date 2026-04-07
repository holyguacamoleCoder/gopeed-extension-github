/**
 * Optional fetch `extra` with Bearer token for raw.githubusercontent.com.
 * @param {string} [token]
 * @returns {{ header: { Authorization: string } } | undefined}
 */
export default function buildReqExtra(token) {
  if (!token) return undefined;
  return {
    header: {
      Authorization: `Bearer ${token}`,
    },
  };
}
