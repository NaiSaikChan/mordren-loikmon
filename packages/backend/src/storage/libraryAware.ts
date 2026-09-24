import type { Readable } from 'node:stream'
import type { Kysely } from 'kysely'
import type { Database } from '../db/types.js'
import type { Logger } from '../lib/logger.js'
import type { AssetKind, PresignedUpload, StorageService } from './storage.js'

/**
 * The storage every entity service and route uses.
 *
 * Content services "release" a file when a record replaces or loses it
 * (`removeObject`). Files registered in the media library are reusable — the
 * same cover may sit on a book and a collection — so releasing them must not
 * delete them: they stay in the library, where unused-asset detection
 * surfaces them for review. Unregistered files (legacy uploads, profile
 * pictures) are deleted as before.
 *
 * Only MediaService deletes library assets, through the underlying store.
 */
export class LibraryAwareStorage implements StorageService {
  constructor(
    private readonly inner: StorageService,
    private readonly db: Kysely<Database>,
    private readonly logger: Logger,
  ) {}

  isAbsoluteUrl(value: string) {
    return this.inner.isAbsoluteUrl(value)
  }

  publicUrl(key: string | null | undefined) {
    return this.inner.publicUrl(key)
  }

  signedUrl(key: string, options?: { ttlSeconds?: number; downloadName?: string }) {
    return this.inner.signedUrl(key, options)
  }

  presignUpload(kind: AssetKind, contentType: string, filename?: string): Promise<PresignedUpload> {
    return this.inner.presignUpload(kind, contentType, filename)
  }

  putObject(kind: AssetKind, body: Buffer | Readable, size: number, contentType: string, filename?: string) {
    return this.inner.putObject(kind, body, size, contentType, filename)
  }

  putObjectAt(key: string, body: Buffer | Readable, size: number, contentType: string) {
    return this.inner.putObjectAt(key, body, size, contentType)
  }

  statObject(key: string) {
    return this.inner.statObject(key)
  }

  async removeObject(key: string): Promise<void> {
    const registered = await this.db.selectFrom('media_assets').select('id').where('storage_key', '=', key).executeTakeFirst()
    if (registered) {
      this.logger.debug({ key, assetId: registered.id }, 'kept released file: it belongs to the media library')
      return
    }
    await this.inner.removeObject(key)
  }

  ensureBuckets() {
    return this.inner.ensureBuckets()
  }

  ping() {
    return this.inner.ping()
  }
}
