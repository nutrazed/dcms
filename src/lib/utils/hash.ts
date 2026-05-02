/**
 * Compute SHA-256 of an ArrayBuffer.
 * Works in Node.js (via globalThis.crypto), Edge Runtime, and browsers.
 */
export async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Hash a plain string (for e-sig token storage) */
export async function hashString(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  return hashFile(encoded.buffer as ArrayBuffer)
}
