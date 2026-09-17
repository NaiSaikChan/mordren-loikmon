import type { MediaFormatId } from '@loikmon/media-standards'

/**
 * Content sniffing for non-image uploads. The client's MIME type and file
 * extension are hints; these magic-byte checks decide. Images are identified
 * by decoding them (see imageProcessor.ts).
 */

const ascii = (buffer: Buffer, start: number, end: number) => buffer.subarray(start, end).toString('latin1')

export function sniffFormat(buffer: Buffer): MediaFormatId | null {
  if (buffer.length < 12) return null
  if (ascii(buffer, 0, 5) === '%PDF-') return 'pdf'
  // EPUB: a ZIP whose first entry is the uncompressed `mimetype` file.
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return ascii(buffer, 30, 58) === 'mimetypeapplication/epub+zip' ? 'epub' : null
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WAVE') return 'wav'
  if (ascii(buffer, 4, 8) === 'ftyp') return 'm4a'
  if (ascii(buffer, 0, 3) === 'ID3') return 'mp3'
  // ADTS AAC: 12-bit sync word, layer 00.
  if (buffer[0] === 0xff && (buffer[1]! & 0xf6) === 0xf0) return 'aac'
  // MPEG audio frame sync (MP3 without an ID3 tag).
  if (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return 'mp3'
  return null
}

/** SVG files are text; they are recognised by their root element, not by bytes. */
export function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart()
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)
}
