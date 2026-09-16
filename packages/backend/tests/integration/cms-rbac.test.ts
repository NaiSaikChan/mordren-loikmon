import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

/**
 * Role-based access control end to end: which permissions a role carries, how
 * the API refuses what a session may not do, and the two rules that protect the
 * platform from being locked out.
 */
describe.skipIf(!hasTestDatabase)('CMS role-based access control (MySQL)', () => {
  let t: TestApp
  let admin: string
  let reader: string
  let readerId: string
  let roleIds: Record<string, number> = {}

  beforeAll(async () => {
    t = await createTestApp({ database: 'loikmon_test_cms_rbac' })
    ;({ token: admin } = await registerUser(t.app, 'admin@loikmon.test'))
    ;({ token: reader, user: { id: readerId } } = await registerUser(t.app, 'reader@example.com'))

    const roles = await request(t.app).get('/api/v1/cms/roles').set(bearer(admin))
    expect(roles.status).toBe(200)
    roleIds = Object.fromEntries(roles.body.roles.map((r: { role_key: string; id: number }) => [r.role_key, r.id]))
  })
  afterAll(async () => t?.close())

  it('reports the administrator as holding every permission', async () => {
    const res = await request(t.app).get('/api/v1/cms/me').set(bearer(admin))
    expect(res.status).toBe(200)
    expect(res.body.can_access).toBe(true)
    expect(res.body.scope).toBe('all')
    expect(res.body.permissions).toContain('roles.manage')
    expect(res.body.permissions).toContain('coupons.global.manage')
  })

  it('tells a plain reader they have no CMS access without failing the request', async () => {
    const res = await request(t.app).get('/api/v1/cms/me').set(bearer(reader))
    expect(res.status).toBe(200)
    expect(res.body.can_access).toBe(false)
    expect(res.body.permissions).toEqual([])
  })

  it('refuses every CMS endpoint to a reader', async () => {
    for (const path of ['/api/v1/cms/books', '/api/v1/cms/users', '/api/v1/cms/settings', '/api/v1/cms/audit-logs']) {
      const res = await request(t.app).get(path).set(bearer(reader))
      expect(res.status).toBe(403)
    }
  })

  it('refuses anonymous callers', async () => {
    const res = await request(t.app).get('/api/v1/cms/books')
    expect(res.status).toBe(401)
  })

  it('names the missing permission so the UI can explain the refusal', async () => {
    // Promote the reader to manager, which excludes settings and roles.
    const assign = await request(t.app)
      .put(`/api/v1/cms/users/${readerId}/roles`)
      .set(bearer(admin))
      .send({ role_ids: [roleIds.manager] })
    expect(assign.status).toBe(200)
    expect(assign.body.primary_role).toBe('manager')

    const res = await request(t.app).get('/api/v1/cms/settings').set(bearer(reader))
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('PERMISSION_DENIED')
    expect(res.body.details.required).toContain('settings.manage')
  })

  it('lets a manager run the catalogue but not system configuration', async () => {
    const me = await request(t.app).get('/api/v1/cms/me').set(bearer(reader))
    expect(me.body.permissions).toContain('books.publish')
    expect(me.body.permissions).not.toContain('settings.manage')
    expect(me.body.permissions).not.toContain('roles.manage')

    expect((await request(t.app).get('/api/v1/cms/books').set(bearer(reader))).status).toBe(200)
    expect((await request(t.app).get('/api/v1/cms/roles').set(bearer(reader))).status).toBe(403)
    expect((await request(t.app).get('/api/v1/cms/audit-logs').set(bearer(reader))).status).toBe(403)
  })

  it('keeps users.role in step with the assigned roles, so the legacy admin guard still works', async () => {
    const before = await request(t.app).get('/api/v1/admin/users').set(bearer(reader))
    expect(before.status).toBe(403) // manager is not admin

    await request(t.app).put(`/api/v1/cms/users/${readerId}/roles`).set(bearer(admin)).send({ role_ids: [roleIds.admin] })
    const after = await request(t.app).get('/api/v1/admin/users').set(bearer(reader))
    expect(after.status).toBe(200)

    // Put them back for the remaining tests.
    await request(t.app).put(`/api/v1/cms/users/${readerId}/roles`).set(bearer(admin)).send({ role_ids: [roleIds.user] })
  })

  it('refuses to remove the last administrator', async () => {
    const me = await request(t.app).get('/api/v1/cms/me').set(bearer(admin))
    const adminId = me.body.user.id
    const res = await request(t.app).put(`/api/v1/cms/users/${adminId}/roles`).set(bearer(admin)).send({ role_ids: [roleIds.user] })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/own administrator role/i)
  })

  it('creates a custom role with a chosen permission set', async () => {
    const created = await request(t.app)
      .post('/api/v1/cms/roles')
      .set(bearer(admin))
      .send({
        key: 'audio-editor',
        name: 'Audio editor',
        description: 'Manages audiobook chapters only',
        scope: 'all',
        rank: 180,
        permissions: ['books.view', 'audiobooks.view', 'audiobooks.create', 'audiobooks.edit', 'media.upload'],
      })
    expect(created.status).toBe(201)
    expect(created.body.role.permissions).toHaveLength(5)

    await request(t.app).put(`/api/v1/cms/users/${readerId}/roles`).set(bearer(admin)).send({ role_ids: [created.body.role.id] })
    const me = await request(t.app).get('/api/v1/cms/me').set(bearer(reader))
    expect(me.body.permissions).toEqual(['audiobooks.create', 'audiobooks.edit', 'audiobooks.view', 'books.view', 'media.upload'])

    // The role grants book *reading*, not book writing.
    expect((await request(t.app).get('/api/v1/cms/books').set(bearer(reader))).status).toBe(200)
    expect((await request(t.app).post('/api/v1/cms/books').set(bearer(reader)).send({ title: 'Nope' })).status).toBe(403)
  })

  it('rejects an unknown permission rather than storing it', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/roles')
      .set(bearer(admin))
      .send({ key: 'bogus', name: 'Bogus', scope: 'all', permissions: ['books.teleport'] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('protects system roles from deletion and from losing their scope', async () => {
    const del = await request(t.app).delete(`/api/v1/cms/roles/${roleIds.manager}`).set(bearer(admin))
    expect(del.status).toBe(409)
    expect(del.body.code).toBe('ROLE_PROTECTED')

    const patch = await request(t.app).patch(`/api/v1/cms/roles/${roleIds.author}`).set(bearer(admin)).send({ scope: 'all' })
    expect(patch.status).toBe(409)
  })

  it('never lets the administrator role lose a permission', async () => {
    const res = await request(t.app).patch(`/api/v1/cms/roles/${roleIds.admin}`).set(bearer(admin)).send({ permissions: ['books.view'] })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ROLE_PROTECTED')
  })

  it('refuses to delete a role somebody still holds', async () => {
    const roles = await request(t.app).get('/api/v1/cms/roles').set(bearer(admin))
    const custom = roles.body.roles.find((r: { role_key: string }) => r.role_key === 'audio-editor')
    expect(custom.users_count).toBe(1)
    const res = await request(t.app).delete(`/api/v1/cms/roles/${custom.id}`).set(bearer(admin))
    expect(res.status).toBe(409)
  })

  it('writes an audit entry for every role change', async () => {
    const res = await request(t.app).get('/api/v1/cms/audit-logs?action=role.assign').set(bearer(admin))
    expect(res.status).toBe(200)
    expect(res.body.logs.length).toBeGreaterThan(0)
    const entry = res.body.logs[0]
    expect(entry).toMatchObject({ action: 'role.assign', entity_type: 'user' })
    expect(entry.actor_email).toBe('admin@loikmon.test')
    expect(entry.before_data).toBeTruthy()
    expect(entry.after_data).toBeTruthy()
  })
})
