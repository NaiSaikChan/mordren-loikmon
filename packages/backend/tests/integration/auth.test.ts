import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LegacyAuthService } from '../../src/services/legacyAuth.js'
import { silentLogger } from '../helpers/fakes.js'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

describe.skipIf(!hasTestDatabase)('auth (MySQL)', () => {
  let t: TestApp
  const legacyUsers = new Map([['old.reader@loikmon.org', 'legacy1']]) // legacy passwords may be short

  beforeAll(async () => {
    const legacyFetch = (async (_url: string, init?: RequestInit) => {
      const { data } = JSON.parse(String(init?.body)) as { data: { email: string; password: string } }
      const ok = legacyUsers.get(data.email) === data.password
      return new Response(JSON.stringify(ok ? { status: 'ok', user: { email: data.email, firstname: 'Old', lastname: 'Reader' } } : { status: 'error' }))
    }) as typeof fetch
    t = await createTestApp({ legacyAuth: new LegacyAuthService('https://legacy.test', silentLogger, legacyFetch) })
  })
  afterAll(async () => t?.close())

  it('registers, returns a bearer token and resolves the session from it', async () => {
    const res = await request(t.app).post('/api/v1/auth/register').send({ email: 'Nai@Example.com', password: 'password-123', firstname: 'Nai', lastname: 'Mon', phone: '+66 800' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      status: 'ok',
      user: { email: 'nai@example.com', name: 'Nai Mon', firstname: 'Nai', lastname: 'Mon', phone: '+66 800', role: 'user' },
      entitlement: { active: false },
      requires_email_verification: false,
    })
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/)

    const me = await request(t.app).get('/api/v1/auth/me').set(bearer(res.body.token))
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe('nai@example.com')
  })

  it('does not expose Better Auth native POST endpoints (validation cannot be bypassed)', async () => {
    const res = await request(t.app).post('/api/auth/sign-up/email').send({ email: 'raw@example.com', password: 'password-123', name: 'Raw' })
    expect(res.status).toBe(404)
  })

  it('rejects duplicate emails, weak passwords and bad credentials with stable codes', async () => {
    const dup = await request(t.app).post('/api/v1/auth/register').send({ email: 'nai@example.com', password: 'password-123' })
    expect([dup.status, dup.body.code]).toEqual([409, 'EMAIL_TAKEN'])
    const weak = await request(t.app).post('/api/v1/auth/register').send({ email: 'weak@example.com', password: 'short' })
    expect([weak.status, weak.body.code]).toEqual([400, 'VALIDATION_ERROR'])
    const wrong = await request(t.app).post('/api/v1/auth/login').send({ email: 'nai@example.com', password: 'wrong-password' })
    expect([wrong.status, wrong.body.code]).toEqual([401, 'INVALID_CREDENTIALS'])
  })

  it('treats missing, invalid and signed-out tokens as anonymous', async () => {
    expect((await request(t.app).get('/api/v1/auth/me')).status).toBe(401)
    expect((await request(t.app).get('/api/v1/auth/me').set(bearer('forged.token'))).status).toBe(401)

    const login = await request(t.app).post('/api/v1/auth/login').send({ email: 'nai@example.com', password: 'password-123' })
    expect(login.status).toBe(200)
    const token = login.body.token as string
    expect((await request(t.app).post('/api/v1/auth/logout').set(bearer(token))).status).toBe(200)
    expect((await request(t.app).get('/api/v1/auth/me').set(bearer(token))).status).toBe(401)
  })

  it('updates the profile', async () => {
    const { token } = await registerUser(t.app, 'profile@example.com')
    const res = await request(t.app).patch('/api/v1/auth/me').set(bearer(token)).send({ firstname: 'Mi', lastname: 'Chan', phone: '099' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ firstname: 'Mi', lastname: 'Chan', name: 'Mi Chan', phone: '099' })
  })

  it('changes and resets passwords, revoking old sessions', async () => {
    const { token } = await registerUser(t.app, 'pw@example.com', 'first-password')
    const changed = await request(t.app).post('/api/v1/auth/password/change').set(bearer(token)).send({ current_password: 'first-password', new_password: 'second-password' })
    expect(changed.status).toBe(200)
    expect((await request(t.app).post('/api/v1/auth/login').send({ email: 'pw@example.com', password: 'second-password' })).status).toBe(200)

    const forgot = await request(t.app).post('/api/v1/auth/password/forgot').send({ email: 'pw@example.com' })
    expect(forgot.status).toBe(200)
    const unknown = await request(t.app).post('/api/v1/auth/password/forgot').send({ email: 'nobody@example.com' })
    expect(unknown.body.message).toBe(forgot.body.message) // no account enumeration
    const email = t.mail.find((m) => m.to === 'pw@example.com')
    const resetToken = new URL(email!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!
    expect(resetToken).toBeTruthy()

    const reset = await request(t.app).post('/api/v1/auth/password/reset').send({ token: resetToken, new_password: 'third-password' })
    expect(reset.status).toBe(200)
    expect((await request(t.app).post('/api/v1/auth/login').send({ email: 'pw@example.com', password: 'third-password' })).status).toBe(200)
    expect((await request(t.app).post('/api/v1/auth/login').send({ email: 'pw@example.com', password: 'second-password' })).status).toBe(401)
  })

  it('grants the admin role to configured admin emails', async () => {
    const { user } = await registerUser(t.app, 'admin@loikmon.test')
    expect((user as unknown as { role: string }).role).toBe('admin')
  })

  it('migrates a legacy account on first sign-in, then authenticates locally', async () => {
    const first = await request(t.app).post('/api/v1/auth/login').send({ email: 'old.reader@loikmon.org', password: 'legacy1' })
    expect(first.status).toBe(200)
    expect(first.body.user).toMatchObject({ email: 'old.reader@loikmon.org', name: 'Old Reader', email_verified: true })

    legacyUsers.clear() // the legacy server is no longer needed for this user
    const second = await request(t.app).post('/api/v1/auth/login').send({ email: 'old.reader@loikmon.org', password: 'legacy1' })
    expect(second.status).toBe(200)

    const wrong = await request(t.app).post('/api/v1/auth/login').send({ email: 'ghost@loikmon.org', password: 'whatever' })
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS')
  })

  it('deletes the account (App Store requirement)', async () => {
    const { token } = await registerUser(t.app, 'bye@example.com')
    const res = await request(t.app).delete('/api/v1/auth/me').set(bearer(token)).send({ password: 'password-123' })
    expect(res.status).toBe(200)
    expect((await request(t.app).post('/api/v1/auth/login').send({ email: 'bye@example.com', password: 'password-123' })).status).toBe(401)
  })
})
