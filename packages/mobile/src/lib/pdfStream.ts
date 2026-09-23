/**
 * Helpers for streaming a PDF into the in-app viewer WebView.
 *
 * The file is never handed to the WebView as a URL — native reads it in slices
 * and pushes the bytes across the bridge, so the document has no address the
 * page (or the user) could download, and nothing is left on disk afterwards.
 */

/**
 * Bytes per slice. A multiple of 3 so every base64 slice is unpadded and the
 * chunks concatenate cleanly; ~180 KB keeps each bridge message well under the
 * size where Android's JS bridge starts to stutter.
 */
export const PDF_CHUNK_BYTES = 180 * 1024

export interface ByteRange {
  position: number
  length: number
}

/** Split a file of `size` bytes into aligned read ranges. */
export function chunkRanges(size: number, chunk: number = PDF_CHUNK_BYTES): ByteRange[] {
  if (!Number.isFinite(size) || size <= 0 || chunk <= 0) return []
  const ranges: ByteRange[] = []
  for (let position = 0; position < size; position += chunk) {
    ranges.push({ position, length: Math.min(chunk, size - position) })
  }
  return ranges
}
