import { sql, type Kysely } from 'kysely'
import type { Database, Policy, PolicyKind, PolicyVersion } from '../../db/types.js'
import { errors } from '../../lib/errors.js'
import { sanitizeHtml, sanitizePlainText } from '../../lib/sanitize.js'
import { AuditService } from '../audit.js'
import type { CmsRequestContext } from './content.js'

/**
 * Policies and terms with version history.
 *
 * A policy is a stable slug (`terms`, `privacy`, …) whose text lives in
 * versions. Editing always produces a new draft version; publishing points
 * `policies.published_version` at it and archives the previous one, so the
 * text a reader agreed to on a given date can always be reproduced.
 */

export interface PolicyVersionInput {
  title?: string
  body: string
  summary?: string | null
  effective_at?: string | null
}

export class PolicyService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<Array<Policy & { versions_count: number; draft_version: number | null; updated_by_version_at: Date | null }>> {
    const rows = await this.db
      .selectFrom('policies')
      .selectAll('policies')
      .select((eb) => [
        eb.selectFrom('policy_versions as v').whereRef('v.policy_id', '=', 'policies.id').select(eb.fn.countAll().as('n')).as('versions_count'),
        eb
          .selectFrom('policy_versions as v')
          .whereRef('v.policy_id', '=', 'policies.id')
          .where('v.status', '=', 'draft')
          .select((ib) => ib.fn.max('v.version').as('n'))
          .as('draft_version'),
        eb
          .selectFrom('policy_versions as v')
          .whereRef('v.policy_id', '=', 'policies.id')
          .select((ib) => ib.fn.max('v.updated_at').as('n'))
          .as('updated_by_version_at'),
      ])
      .orderBy('policies.title')
      .execute()
    return rows.map((r) => ({
      ...r,
      versions_count: Number(r.versions_count ?? 0),
      draft_version: r.draft_version === null ? null : Number(r.draft_version),
      updated_by_version_at: (r.updated_by_version_at as Date | null) ?? null,
    }))
  }

  async get(slug: string) {
    const policy = await this.db.selectFrom('policies').selectAll().where('slug', '=', slug).executeTakeFirst()
    if (!policy) throw errors.notFound('Policy')
    const versions = await this.db
      .selectFrom('policy_versions')
      .select(['id', 'version', 'title', 'summary', 'status', 'effective_at', 'published_at', 'created_by', 'created_at', 'updated_at'])
      .where('policy_id', '=', policy.id)
      .orderBy('version', 'desc')
      .execute()
    const current = await this.currentVersion(policy)
    const draft = await this.db
      .selectFrom('policy_versions')
      .selectAll()
      .where('policy_id', '=', policy.id)
      .where('status', '=', 'draft')
      .orderBy('version', 'desc')
      .executeTakeFirst()
    return { ...policy, versions, current, draft: draft ?? null }
  }

  /** The published text, for the storefront. Never returns a draft. */
  async published(slug: string): Promise<(Policy & { content: PolicyVersion }) | null> {
    const policy = await this.db.selectFrom('policies').selectAll().where('slug', '=', slug).executeTakeFirst()
    if (!policy) return null
    const current = await this.currentVersion(policy)
    return current ? { ...policy, content: current } : null
  }

  async listPublished(): Promise<Array<{ slug: string; title: string; kind: PolicyKind; version: number; effective_at: string | null }>> {
    const rows = await this.db
      .selectFrom('policies as p')
      .innerJoin('policy_versions as v', (join) => join.onRef('v.policy_id', '=', 'p.id').onRef('v.version', '=', 'p.published_version'))
      .select(['p.slug', 'v.title', 'p.kind', 'v.version', 'v.effective_at'])
      .orderBy('p.title')
      .execute()
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      kind: r.kind,
      version: r.version,
      effective_at: r.effective_at ? new Date(r.effective_at).toISOString() : null,
    }))
  }

  async createPolicy(ctx: CmsRequestContext, input: { slug: string; title: string; kind?: PolicyKind }) {
    const slug = slugify(input.slug)
    if (!slug) throw errors.validation([{ path: 'slug', message: 'A slug is required' }])
    const inserted = await this.db
      .insertInto('policies')
      .values({ slug, title: sanitizePlainText(input.title), kind: input.kind ?? 'custom' })
      .executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor: ctx.audit, action: 'create', entityType: 'policy', entityId: id, summary: slug })
    return this.get(slug)
  }

  /**
   * Saves a draft. An existing draft is overwritten; otherwise a new version
   * number is allocated above the highest one.
   */
  async saveDraft(ctx: CmsRequestContext, slug: string, input: PolicyVersionInput) {
    const policy = await this.db.selectFrom('policies').selectAll().where('slug', '=', slug).executeTakeFirst()
    if (!policy) throw errors.notFound('Policy')
    const body = sanitizeHtml(input.body)
    const title = sanitizePlainText(input.title ?? policy.title)
    const summary = input.summary === null || input.summary === undefined ? null : sanitizePlainText(input.summary).slice(0, 500)
    const effectiveAt = input.effective_at ? new Date(input.effective_at) : null

    const existing = await this.db
      .selectFrom('policy_versions')
      .selectAll()
      .where('policy_id', '=', policy.id)
      .where('status', '=', 'draft')
      .orderBy('version', 'desc')
      .executeTakeFirst()

    if (existing) {
      await this.db
        .updateTable('policy_versions')
        .set({ title, body, summary, effective_at: effectiveAt })
        .where('id', '=', existing.id)
        .execute()
      await this.audit.record({
        actor: ctx.audit,
        action: 'update',
        entityType: 'policy',
        entityId: policy.id,
        summary: `${slug} draft v${existing.version}`,
      })
    } else {
      const max = await this.db
        .selectFrom('policy_versions')
        .select((eb) => eb.fn.coalesce(eb.fn.max('version'), sql<number>`0`).as('max'))
        .where('policy_id', '=', policy.id)
        .executeTakeFirst()
      const version = Number(max?.max ?? 0) + 1
      await this.db
        .insertInto('policy_versions')
        .values({
          policy_id: policy.id,
          version,
          title,
          body,
          summary,
          status: 'draft',
          effective_at: effectiveAt,
          created_by: ctx.actor.userId,
        })
        .execute()
      await this.audit.record({
        actor: ctx.audit,
        action: 'create',
        entityType: 'policy',
        entityId: policy.id,
        summary: `${slug} draft v${version}`,
      })
    }
    return this.get(slug)
  }

  /** Publishes a version and archives the one it replaces. */
  async publish(ctx: CmsRequestContext, slug: string, version: number) {
    const policy = await this.db.selectFrom('policies').selectAll().where('slug', '=', slug).executeTakeFirst()
    if (!policy) throw errors.notFound('Policy')
    const target = await this.db
      .selectFrom('policy_versions')
      .selectAll()
      .where('policy_id', '=', policy.id)
      .where('version', '=', version)
      .executeTakeFirst()
    if (!target) throw errors.notFound('Policy version')

    await this.db.transaction().execute(async (trx) => {
      if (policy.published_version !== null && policy.published_version !== version) {
        await trx
          .updateTable('policy_versions')
          .set({ status: 'archived' })
          .where('policy_id', '=', policy.id)
          .where('version', '=', policy.published_version)
          .execute()
      }
      await trx
        .updateTable('policy_versions')
        .set({ status: 'published', published_at: this.now(), effective_at: target.effective_at ?? this.now() })
        .where('id', '=', target.id)
        .execute()
      await trx.updateTable('policies').set({ published_version: version, title: target.title }).where('id', '=', policy.id).execute()
      await this.audit.record(
        {
          actor: ctx.audit,
          action: 'publish',
          entityType: 'policy',
          entityId: policy.id,
          summary: `${slug} v${version} published`,
          before: { published_version: policy.published_version },
          after: { published_version: version },
        },
        trx,
      )
    })
    return this.get(slug)
  }

  async deletePolicy(ctx: CmsRequestContext, slug: string): Promise<void> {
    const policy = await this.db.selectFrom('policies').selectAll().where('slug', '=', slug).executeTakeFirst()
    if (!policy) throw errors.notFound('Policy')
    if (policy.kind !== 'custom') throw errors.conflict('Built-in policies cannot be deleted; unpublish them instead')
    await this.db.deleteFrom('policies').where('id', '=', policy.id).execute()
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'policy', entityId: policy.id, summary: slug, before: policy })
  }

  private async currentVersion(policy: Policy): Promise<PolicyVersion | null> {
    if (policy.published_version === null) return null
    const row = await this.db
      .selectFrom('policy_versions')
      .selectAll()
      .where('policy_id', '=', policy.id)
      .where('version', '=', policy.published_version)
      .executeTakeFirst()
    return row ?? null
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}
