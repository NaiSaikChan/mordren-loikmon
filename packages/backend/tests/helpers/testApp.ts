import type { Express } from 'express'
import { createConnection } from 'mysql2/promise'
import request from 'supertest'
import { loadConfig } from '../../src/config/env.js'
import { createContainer, type Container } from '../../src/container.js'
import { createApp } from '../../src/http/app.js'
import type { MailMessage } from '../../src/lib/mailer.js'
import type { LegacyAuthService } from '../../src/services/legacyAuth.js'
import { createTestAppleService } from './apple.js'
import { createTestGoogleService, FakePlayApi, FakeStorage, silentLogger } from './fakes.js'

/**
 * Boots the real application against a real MySQL database. Only the
 * outside world is replaced: MinIO (FakeStorage), Apple (test PKI — real
 * signature verification), Google Play (in-memory API) and SMTP (captured).
 *
 * Configure with TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER / TEST_DB_PASSWORD.
 * The `loikmon_test` database is dropped and recreated for every test file.
 */

export const hasTestDatabase = Boolean(process.env.TEST_DB_HOST)

export interface TestApp {
  app: Express
  container: Container
  playApi: FakePlayApi
  storage: FakeStorage
  mail: MailMessage[]
  close: () => Promise<void>
}

export async function createTestApp(options: { legacyAuth?: LegacyAuthService | null; database?: string } = {}): Promise<TestApp> {
  const database = options.database ?? 'loikmon_test'
  const connection = {
    host: process.env.TEST_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT ?? 3306),
    user: process.env.TEST_DB_USER ?? 'root',
    password: process.env.TEST_DB_PASSWORD ?? '',
  }
  const admin = await createConnection(connection)
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await admin.end()

  const config = loadConfig({
    NODE_ENV: 'test',
    DB_HOST: connection.host,
    DB_PORT: String(connection.port),
    DB_USER: connection.user,
    DB_PASSWORD: connection.password,
    DB_NAME: database,
    AUTH_SECRET: 'integration-test-secret-integration-test-secret',
    PUBLIC_API_URL: 'http://localhost:4001',
    APP_WEB_URL: 'http://localhost:5173',
    ADMIN_EMAILS: 'admin@loikmon.test',
    JOBS_ENABLED: 'false',
  })

  const mail: MailMessage[] = []
  const playApi = new FakePlayApi()
  const storage = new FakeStorage()
  const container = await createContainer(
    config,
    {
      logger: silentLogger,
      storage,
      mailer: { send: async (m) => void mail.push(m) },
      apple: createTestAppleService(),
      google: createTestGoogleService(playApi),
      legacyAuth: options.legacyAuth ?? null,
    },
    { migrate: true },
  )
  const app = createApp(container.ctx)
  return { app, container, playApi, storage, mail, close: () => container.close() }
}

export async function registerUser(app: Express, email: string, password = 'password-123', extra: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/v1/auth/register').send({ email, password, name: email.split('@')[0], ...extra })
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.body.token as string, user: res.body.user as { id: string; email: string } }
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
