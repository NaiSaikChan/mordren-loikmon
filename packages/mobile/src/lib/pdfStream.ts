/**
 * Helpers for streaming a PDF into the in-app viewer WebView.
 *
 * The file is never handed to the WebView as a URL — native reads it in slices
 * and pushes the bytes across the bridge, so the document has no address the
 * page (or the user) could download. The file itself stays in the app's
 * private document cache (see `documentCache.ts`) so reopening, or a WebView
 * reload, does not download it again.
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

export interface StreamOptions {
  size: number
  /** Page to open at (1-based); 1 or less starts at the top. */
  startPage?: number
  /** Reads `length` bytes at `position` as base64. */
  readSlice: (position: number, length: number) => Promise<string>
  inject: (code: string) => void
  signal?: AbortSignal
  chunk?: number
}

/**
 * Streams a file into the viewer: `__pdfBegin` (preallocates the buffer and
 * sets the page to open at), the slices, then `__pdfDone`. Returns false when
 * aborted part-way (unmount, WebView restart) — the viewer then simply never
 * receives `__pdfDone` and is reset by the next `__pdfBegin`.
 */
export async function streamToViewer(options: StreamOptions): Promise<boolean> {
  const { size, readSlice, inject, signal, chunk = PDF_CHUNK_BYTES } = options
  if (!Number.isFinite(size) || size <= 0) throw new Error('The file is empty')
  const requested = options.startPage ?? 1
  const page = Number.isFinite(requested) && requested > 1 ? Math.floor(requested) : 1
  if (signal?.aborted) return false
  inject(`window.__pdfBegin&&window.__pdfBegin(${size},${page});true;`)
  for (const range of chunkRanges(size, chunk)) {
    if (signal?.aborted) return false
    const base64 = await readSlice(range.position, range.length)
    if (signal?.aborted) return false
    inject(`window.__pdfChunk(${JSON.stringify(base64)});true;`)
  }
  inject(`window.__pdfDone(${size});true;`)
  return true
}

