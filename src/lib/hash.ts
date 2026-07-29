/** Deterministic, dependency-free, synchronous string hash (two independent
 * FNV-1a 32-bit passes concatenated into a 16-char hex id). Not
 * cryptographic — doesn't need to be, it's only used to give the same
 * dedupe key a stable row id across syncs, not for security. Sync (unlike
 * Web Crypto's async subtle.digest) so callers can stay simple. */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193 ^ 0xff;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return hex1 + hex2;
}
