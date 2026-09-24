import type { Kysely } from 'kysely'
import type { Database } from '../../db/types.js'
import { errors } from '../../lib/errors.js'
import { AuditService } from '../audit.js'
import type { CmsRequestContext } from './content.js'

/**
 * Website settings: branding, SEO, e-mail, social profiles and feature toggles.
 *
 * Values are JSON so a setting can hold a string, a flag or a list. The table
 * marks which keys are safe to serve unauthenticated (`is_public`), which is
 * what `GET /api/v1/settings` returns for the storefront; secrets such as the
 * support mailbox stay private.
 *
 * The whole table is small and read on nearly every storefront request, so the
 * public subset is cached in memory for a few seconds.
 */

export interface SettingRecord {
  key: string
  group: string
  value: unknown
  is_public: boolean
  updated_at: string | null
}

/** Keys an operator may not invent: writing an unknown key is rejected. */
const PUBLIC_CACHE_TTL_MS = 10_000

export class SettingsService {
  private publicCache: { expires: number; value: Record<string, unknown> } | null = null

  constructor(
    private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  /** Everything, for the settings screen. */
  async all(): Promise<SettingRecord[]> {
    const rows = await this.db.selectFrom('settings').selectAll().orderBy('group_key').orderBy('setting_key').execute()
    return rows.map((row) => ({
      key: row.setting_key,
      group: row.group_key,
      value: parseValue(row.value),
      is_public: row.is_public,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }))
  }

  /** Flat `{ key: value }` of the public subset, for the storefront. */
  async publicSettings(): Promise<Record<string, unknown>> {
    if (this.publicCache && this.publicCache.expires > Date.now()) return this.publicCache.value
    const rows = await this.db.selectFrom('settings').selectAll().where('is_public', '=', true).execute()
    const value = Object.fromEntries(rows.map((row) => [row.setting_key, parseValue(row.value)]))
    this.publicCache = { expires: Date.now() + PUBLIC_CACHE_TTL_MS, value }
    return value
  }

  /** One setting's value, or `fallback` when it is not set. */
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.selectFrom('settings').select('value').where('setting_key', '=', key).executeTakeFirst()
    if (!row) return fallback
    const value = parseValue(row.value)
    return (value === null || value === undefined ? fallback : value) as T
  }

  /** Feature toggle helper; treats a missing key as `fallback`. */
  async flag(key: string, fallback = false): Promise<boolean> {
    return Boolean(await this.get(key, fallback))
  }

  /**
   * Writes a batch of settings. Only keys that already exist may be written:
   * the seeded rows are the schema, so a typo cannot silently create a
   * setting nothing reads.
   */
  async update(ctx: CmsRequestContext, values: Record<string, unknown>): Promise<SettingRecord[]> {
    const keys = Object.keys(values)
    if (!keys.length) throw errors.badRequest('Nothing to update')
    const existing = await this.db.selectFrom('settings').selectAll().where('setting_key', 'in', keys).execute()
    const known = new Set(existing.map((row) => row.setting_key))
    const unknown = keys.filter((key) => !known.has(key))
    if (unknown.length) {
      throw errors.validation(unknown.map((key) => ({ path: key, message: `Unknown setting "${key}"` })))
    }

    const before = Object.fromEntries(existing.map((row) => [row.setting_key, parseValue(row.value)]))
    await this.db.transaction().execute(async (trx) => {
      for (const key of keys) {
        await trx
          .updateTable('settings')
          .set({ value: JSON.stringify(values[key] ?? null), updated_by: ctx.actor.userId })
          .where('setting_key', '=', key)
          .execute()
      }
    })
    this.publicCache = null

    await this.audit.record({
      actor: ctx.audit,
      action: 'settings.update',
      entityType: 'settings',
      entityId: null,
      summary: `Updated ${keys.length} setting${keys.length === 1 ? '' : 's'}`,
      before,
      after: values,
    })
    return this.all()
  }
}

function parseValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
