/**
 * Copy a Uint8Array view into a standalone ArrayBuffer of exact length.
 * Avoids passing `view.buffer` (which may include unrelated bytes when
 * byteOffset ≠ 0 or the underlying buffer is larger than the view).
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}
