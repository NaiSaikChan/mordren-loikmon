import express from 'express'
import multer from 'multer'
import request from 'supertest'
import { APIError } from 'better-auth/api'
import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../../src/config/env.js'
import { AppError, errors } from '../../src/lib/errors.js'
import { makeExcerpt, normalizeLegacyUrl } from '../../src/lib/text.js'
import { errorHandler, notFoundHandler, toAppError } from '../../src/http/middleware/error.js'
import { likePattern, pageInfo } from '../../src/http/validate.js'
import { LegacyAuthService } from '../../src/services/legacyAuth.js'
import { buildObjectKey, MinioStorageService, visibilityOfKey } from '../../src/storage/storage.js'
import { silentLogger } from '../helpers/fakes.js'

const validProd = {
  NODE_ENV: 'production',
  AUTH_SECRET: 'x'.repeat(48),
  DB_PASSWORD: 'db-pass',
  MINIO_ACCESS_KEY: 'loikmon',
  MINIO_SECRET_KEY: 'minio-secret-value',
  PUBLIC_API_URL: 'https://api.loikmon.org',
}

describe('loadConfig', () => {
  it('provides development defaults', () => {
    const config = loadConfig({})
    expect(config).toMatchObject({ env: 'development', port: 4001, apple: undefined, google: undefined })
    expect(config.corsOrigins).toContain('http://localhost:5173')
  })

  it('accepts a complete production configuration', () => {
    expect(() => loadConfig(validProd)).not.toThrow()
  })

  it.each([
    ['weak AUTH_SECRET', { AUTH_SECRET: 'short' }],
    ['default MinIO credentials', { MINIO_ACCESS_KEY: 'minioadmin' }],
    ['plain-http public URL', { PUBLIC_API_URL: 'http://api.loikmon.org' }],
    ['Apple without APPLE_APP_APPLE_ID', { APPLE_BUNDLE_ID: 'org.loikmon.mobile' }],
  ])('refuses to boot production with %s', (_label, override) => {
    expect(() => loadConfig({ ...validProd, ...override })).toThrow(ConfigError)
  })

  it('parses a base64 Google service account and requires push authentication in production', () => {
    const sa = Buffer.from(JSON.stringify({ client_email: 'svc@x.iam.gserviceaccount.com', private_key: 'KEY' })).toString('base64')
    const google = { GOOGLE_PLAY_PACKAGE_NAME: 'org.loikmon.mobile', GOOGLE_SERVICE_ACCOUNT_JSON: sa }
    expect(() => loadConfig({ ...validProd, ...google })).toThrow(/GOOGLE_PUBSUB_AUDIENCE/)
    const config = loadConfig({ ...validProd, ...google, GOOGLE_PUBSUB_AUDIENCE: 'https://api.loikmon.org/api/v1/webhooks/google' })
    expect(config.google?.serviceAccount.client_email).toBe('svc@x.iam.gserviceaccount.com')
    expect(() => loadConfig({ ...google, GOOGLE_SERVICE_ACCOUNT_JSON: '{"nope":1}' })).toThrow(ConfigError)
  })

  it('resolves the real client IP behind Traefik → nginx without trusting spoofed headers', async () => {
    const app = express()
    app.set('trust proxy', loadConfig({}).trustProxy)
    app.get('/ip', (req, res) => res.json({ ip: req.ip }))
    // supertest connects from loopback, like a proxy container on a private network would.
    const viaTwoProxies = await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.9, 172.18.0.5')
    expect(viaTwoProxies.body.ip).toBe('203.0.113.9')
    const spoofed = await request(app).get('/ip').set('X-Forwarded-For', '6.6.6.6, 203.0.113.9, 172.18.0.5')
    expect(spoofed.body.ip).toBe('203.0.113.9')
    expect(loadConfig({ TRUST_PROXY: '2' }).trustProxy).toBe(2)
  })

  it('unescapes the App Store Connect private key', () => {
    const config = loadConfig({ APPLE_BUNDLE_ID: 'b', APPLE_ISSUER_ID: 'i', APPLE_KEY_ID: 'k', APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----' })
    expect(config.apple?.api?.privateKey).toContain('\nABC\n')
  })
})

describe('error handling', () => {
  function appThrowing(err: unknown, production = false) {
    const app = express()
    app.use(express.json())
    app.post('/boom', () => {
      throw err
    })
    app.get('/async', async () => {
      await Promise.resolve()
      throw err
    })
    app.use(notFoundHandler)
    app.use(errorHandler(silentLogger, { exposeInternalErrors: !production }))
    return app
  }

  it('returns the AppError status, code and details', async () => {
    const res = await request(appThrowing(errors.validation([{ path: 'email' }]))).post('/boom')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ status: 'error', code: 'VALIDATION_ERROR', details: [{ path: 'email' }] })
  })

  it('catches errors thrown by async handlers (Express 5)', async () => {
    const res = await request(appThrowing(errors.subscriptionRequired())).get('/async')
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED')
  })

  it('hides internal error details in production only', async () => {
    const dev = await request(appThrowing(new Error('db exploded'))).post('/boom')
    expect(dev.status).toBe(500)
    expect(dev.body.message).toContain('db exploded')
    const prod = await request(appThrowing(new Error('db exploded'), true)).post('/boom')
    expect(prod.body).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' })
  })

  it('reports malformed JSON and unknown routes as client errors', async () => {
    const app = appThrowing(new Error('unused'))
    const bad = await request(app).post('/boom').set('content-type', 'application/json').send('{oops')
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('BAD_REQUEST')
    const missing = await request(app).get('/nowhere')
    expect(missing.status).toBe(404)
  })

  it('maps Better Auth and multer errors', () => {
    expect(toAppError(new APIError('UNAUTHORIZED', { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' })).code).toBe('INVALID_CREDENTIALS')
    expect(toAppError(new APIError('UNPROCESSABLE_ENTITY', { code: 'USER_ALREADY_EXISTS', message: 'exists' })).code).toBe('EMAIL_TAKEN')
    expect(toAppError(new APIError('FORBIDDEN', { code: 'SOMETHING', message: 'nope' }))).toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(toAppError(new multer.MulterError('LIMIT_FILE_SIZE')).status).toBe(413)
    expect(toAppError(Object.assign(new Error('Duplicate entry'), { errno: 1062 })).status).toBe(409)
    expect(toAppError(Object.assign(new Error('FK fails'), { errno: 1452 })).code).toBe('BAD_REQUEST')
    expect(toAppError(errors.notFound('Book'))).toBeInstanceOf(AppError)
  })
})

describe('storage', () => {
  const storage = new MinioStorageService(
    {
      endpoint: 'minio',
      port: 9000,
      useSSL: false,
      accessKey: 'access',
      secretKey: 'secret-secret',
      region: 'us-east-1',
      publicBucket: 'loikmon-public',
      privateBucket: 'loikmon-private',
      publicUrl: 'https://storage.loikmon.org',
      signedUrlTtlSeconds: 900,
      uploadMaxBytes: 1024,
    },
    silentLogger,
  )

  it('builds public URLs and passes absolute legacy URLs through', () => {
    expect(storage.publicUrl('cover/2026-09/a b.jpg')).toBe('https://storage.loikmon.org/loikmon-public/cover/2026-09/a%20b.jpg')
    expect(storage.publicUrl('https://loikmon.org/webapis/uploads/x.png')).toBe('https://loikmon.org/webapis/uploads/x.png')
    expect(storage.publicUrl(null)).toBeNull()
  })

  it('presigns private objects for the public host without network access', async () => {
    const { url, expiresAt } = await storage.signedUrl('epub/2026-09/book.epub', { downloadName: 'ဇာတ်.epub' })
    const parsed = new URL(url)
    expect(parsed.host).toBe('storage.loikmon.org')
    expect(parsed.pathname).toBe('/loikmon-private/epub/2026-09/book.epub')
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(parsed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('derives the bucket from the key prefix', () => {
    expect(visibilityOfKey(buildObjectKey('cover', 'x.JPG'))).toBe('public')
    expect(visibilityOfKey(buildObjectKey('audio', 'x.mp3'))).toBe('private')
    expect(visibilityOfKey('unknown/thing')).toBe('private')
    expect(buildObjectKey('pdf', 'My Book.PDF')).toMatch(/^pdf\/\d{4}-\d{2}\/[0-9a-f-]{36}\.pdf$/)
  })
})

describe('text and query helpers', () => {
  it('builds excerpts from HTML', () => {
    expect(makeExcerpt('<p>Hello&nbsp;<b>Mon</b></p><script>alert(1)</script> world', 11)).toBe('Hello Mon w…')
  })
  it('normalises legacy upload URLs', () => {
    expect(normalizeLegacyUrl('https://loikmon.org/webapis/uploads/books/My Book.pdf')).toBe('https://loikmon.org/webapis/uploads/books/My%20Book.pdf')
    expect(normalizeLegacyUrl('https:\\/\\/loikmon.org\\/a%20b.png')).toBe('https://loikmon.org/a%20b.png')
    expect(normalizeLegacyUrl('')).toBeNull()
    expect(normalizeLegacyUrl('uploads/relative.png')).toBeNull()
  })
  it('escapes LIKE wildcards and computes pagination', () => {
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%')
    expect(pageInfo(2, 20, 41)).toEqual({ page: 2, limit: 20, total: 41, total_pages: 3, has_more: true })
    expect(pageInfo(1, 20, 0)).toMatchObject({ total_pages: 1, has_more: false })
  })
})

describe('LegacyAuthService', () => {
  const respond = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('returns the legacy profile for valid credentials', async () => {
    const service = new LegacyAuthService('https://legacy.test', silentLogger, respond({ status: 'ok', user: { email: 'a@b.c', firstname: 'Nai', lastname: 'Mon', phone: '' } }))
    await expect(service.verifyCredentials('A@b.c', 'pw')).resolves.toEqual({ firstname: 'Nai', lastname: 'Mon', name: 'Nai Mon', phone: null })
  })

  it('returns null for rejected credentials, mismatched emails and outages', async () => {
    expect(await new LegacyAuthService('x', silentLogger, respond({ status: 'error' })).verifyCredentials('a@b.c', 'pw')).toBeNull()
    expect(await new LegacyAuthService('x', silentLogger, respond({ status: 'ok', user: { email: 'other@b.c' } })).verifyCredentials('a@b.c', 'pw')).toBeNull()
    expect(await new LegacyAuthService('x', silentLogger, respond({}, 500)).verifyCredentials('a@b.c', 'pw')).toBeNull()
    const failing = (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch
    expect(await new LegacyAuthService('x', silentLogger, failing).verifyCredentials('a@b.c', 'pw')).toBeNull()
  })
})
