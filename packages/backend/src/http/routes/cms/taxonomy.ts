import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../../context.js'
import { requireAnyPermission, requirePermission } from '../../middleware/permissions.js'
import { idParam, pagination, parse } from '../../validate.js'
import { cmsContext, foreignKey, idsBody, itemType, optionalText, storageKey } from './shared.js'

/** Authors, categories, collections and sliders. */

const AuthorInput = z.object({
  name: z.string().trim().min(1).max(255),
  bio: optionalText,
  avatar_key: storageKey,
  user_id: z.string().uuid().nullable().optional(),
  website: z.string().trim().max(1024).nullable().optional(),
  facebook: z.string().trim().max(1024).nullable().optional(),
  youtube: z.string().trim().max(1024).nullable().optional(),
  instagram: z.string().trim().max(1024).nullable().optional(),
})

const CategoryInput = z.object({
  type: z.enum(['book', 'article', 'all']).optional(),
  name: z.string().trim().min(1).max(255),
  parent_id: foreignKey,
  thumbnail_key: storageKey,
  display_order: z.number().int().min(0).max(10_000).optional(),
})

const CollectionInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: optionalText,
  thumbnail_key: storageKey,
  display_order: z.number().int().min(0).max(10_000).optional(),
  is_published: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  slug: z.string().trim().max(160).nullable().optional(),
})

const SliderInput = z.object({
  title: z.string().trim().max(255).nullable().optional(),
  image_key: z.string().trim().min(1).max(1024),
  link: z.string().trim().max(1024).nullable().optional(),
  display_order: z.number().int().min(0).max(10_000).optional(),
  is_active: z.boolean().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  audience: z.enum(['all', 'guests', 'members', 'subscribers', 'non_subscribers']).optional(),
  placement: z.string().trim().max(32).optional(),
})

export function taxonomyRouter(ctx: AppContext) {
  const router = Router()
  const taxonomy = ctx.services.cmsTaxonomy
  const withSliderImageUrl = <T extends { image_key: string }>(slider: T) => ({
    ...slider,
    image_url: ctx.storage.publicUrl(slider.image_key) ?? slider.image_key,
  })

  // ── Authors ────────────────────────────────────────────────────────────

  router.get('/authors', requirePermission('authors.view'), async (req, res) => {
    const q = parse(
      pagination.extend({
        q: z.string().trim().max(200).optional(),
        verification: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
      }),
      req.query,
    )
    const { rows, pagination: page } = await taxonomy.listAuthors(q)
    res.json({ status: 'ok', authors: rows, pagination: page })
  })

  router.get('/authors/:id', requirePermission('authors.view'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', author: await taxonomy.getAuthor(cmsContext(req).actor, id) })
  })

  router.post('/authors', requirePermission('authors.create'), async (req, res) => {
    const author = await taxonomy.createAuthor(cmsContext(req), parse(AuthorInput, req.body))
    res.status(201).json({ status: 'ok', author })
  })

  router.patch('/authors/:id', requirePermission('authors.edit'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const author = await taxonomy.updateAuthor(cmsContext(req), id, parse(AuthorInput.partial(), req.body))
    res.json({ status: 'ok', author })
  })

  router.delete('/authors/:id', requirePermission('authors.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await taxonomy.deleteAuthor(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  router.post('/authors/:id/verification', requirePermission('authors.verify'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(
      z.object({
        status: z.enum(['unverified', 'pending', 'verified', 'rejected']),
        note: z.string().trim().max(500).nullable().optional(),
      }),
      req.body,
    )
    res.json({ status: 'ok', author: await taxonomy.setVerification(cmsContext(req), id, body.status, body.note) })
  })

  // ── Categories ─────────────────────────────────────────────────────────

  router.get('/categories', requirePermission('categories.view'), async (_req, res) => {
    res.json({ status: 'ok', categories: await taxonomy.categoryTree() })
  })

  router.post('/categories', requirePermission('categories.create'), async (req, res) => {
    const category = await taxonomy.createCategory(cmsContext(req), parse(CategoryInput, req.body))
    res.status(201).json({ status: 'ok', category })
  })

  router.patch('/categories/:id', requirePermission('categories.edit'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const category = await taxonomy.updateCategory(cmsContext(req), id, parse(CategoryInput.partial(), req.body))
    res.json({ status: 'ok', category })
  })

  router.delete('/categories/:id', requirePermission('categories.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await taxonomy.deleteCategory(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  /** Drag-and-drop: the client sends the whole flattened tree with positions. */
  router.put('/categories/order', requirePermission('categories.edit'), async (req, res) => {
    const body = parse(
      z.object({
        items: z
          .array(
            z.object({
              id: z.number().int().positive(),
              parent_id: z.number().int().positive().nullable(),
              position: z.number().int().min(0).max(10_000),
            }),
          )
          .max(2000),
      }),
      req.body,
    )
    await taxonomy.reorderCategories(cmsContext(req), body.items)
    res.json({ status: 'ok', categories: await taxonomy.categoryTree() })
  })

  // ── Collections ────────────────────────────────────────────────────────

  router.get('/collections', requirePermission('collections.view'), async (req, res) => {
    const q = parse(pagination.extend({ q: z.string().trim().max(200).optional() }), req.query)
    const { rows, pagination: page } = await taxonomy.listCollections(q)
    res.json({ status: 'ok', collections: rows, pagination: page })
  })

  router.get('/collections/:id', requirePermission('collections.view'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', collection: await taxonomy.getCollection(id) })
  })

  router.post('/collections', requirePermission('collections.create'), async (req, res) => {
    const collection = await taxonomy.createCollection(cmsContext(req), parse(CollectionInput, req.body))
    res.status(201).json({ status: 'ok', collection })
  })

  router.patch('/collections/:id', requirePermission('collections.edit'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const collection = await taxonomy.updateCollection(cmsContext(req), id, parse(CollectionInput.partial(), req.body))
    res.json({ status: 'ok', collection })
  })

  router.delete('/collections/:id', requirePermission('collections.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await taxonomy.deleteCollection(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  router.put('/collections/:id/items', requirePermission('collections.edit'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(
      z.object({ items: z.array(z.object({ item_type: itemType, item_id: z.number().int().positive() })).max(500) }),
      req.body,
    )
    res.json({ status: 'ok', collection: await taxonomy.setCollectionItems(cmsContext(req), id, body.items) })
  })

  // ── Sliders ────────────────────────────────────────────────────────────

  router.get('/sliders', requirePermission('sliders.view'), async (req, res) => {
    const q = parse(z.object({ placement: z.string().trim().max(32).optional() }), req.query)
    const sliders = await taxonomy.listSliders(q)
    res.json({ status: 'ok', sliders: sliders.map(withSliderImageUrl) })
  })

  router.post('/sliders', requirePermission('sliders.create'), async (req, res) => {
    const slider = await taxonomy.createSlider(cmsContext(req), parse(SliderInput, req.body))
    res.status(201).json({ status: 'ok', slider: withSliderImageUrl(slider) })
  })

  router.put('/sliders/order', requirePermission('sliders.edit'), async (req, res) => {
    const { ids } = parse(idsBody, req.body)
    await taxonomy.reorderSliders(cmsContext(req), ids)
    const sliders = await taxonomy.listSliders()
    res.json({ status: 'ok', sliders: sliders.map(withSliderImageUrl) })
  })

  router.patch('/sliders/:id', requirePermission('sliders.edit'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const slider = await taxonomy.updateSlider(cmsContext(req), id, parse(SliderInput.partial(), req.body))
    res.json({ status: 'ok', slider: withSliderImageUrl(slider) })
  })

  router.delete('/sliders/:id', requirePermission('sliders.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await taxonomy.deleteSlider(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  return router
}
