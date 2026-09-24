# @loikmon/backend

Core API for the Loikmon web app and the Android/iOS apps: accounts, the
book/article/audio catalogue, **subscriptions verified with Google Play Billing
and the Apple App Store**, and file delivery from **MinIO**.

- **Runtime**: Node 22, Express 5, TypeScript (ESM)
- **Data**: MySQL 8 via Kysely; Better Auth for accounts and sessions
- **Storage**: MinIO (S3) — public bucket for images, private bucket for PDF/EPUB/audio served through short-lived presigned URLs
- **Payments**: `@apple/app-store-server-library` (JWS verification + App Store Server API), Play Developer API `subscriptionsv2` + Pub/Sub RTDN

## Business model

The coin wallet and per-item purchases of the legacy API are gone. One active
subscription unlocks **every** book, audiobook and article:

| Plan | Price | Period |
|------|-------|--------|
| monthly | $4 | 1 month |
| quarterly | $10 | 3 months |
| semiannual | $20 | 6 months |
| yearly | $45 | 12 months |

Items flagged `is_free` are open to everyone. Everything else requires a signed-in
user whose **entitlement** is active: a store subscription in `active`,
`canceled` (until its period ends) or `grace_period`, an admin grant, or the
admin role. Access is always decided by the server (`src/domain/access.ts`).

## Layout

```
src/
  index.ts                 boot: config → migrations → app → jobs, graceful shutdown
  container.ts             dependency wiring (overridable in tests)
  config/env.ts            zod-validated env; refuses unsafe production config
  auth/auth.ts             Better Auth (email+password, bearer tokens, UUID user ids)
  db/                      Kysely client, table types, migrations
  domain/                  pure rules: plans, entitlement, access
  payments/                apple.ts, google.ts → store-agnostic snapshots
  services/                subscriptions, catalog, engagement, legacyAuth
  storage/storage.ts       MinIO buckets, public + presigned URLs
  http/                    app, middleware (auth, errors, rate limits), routes, serializers
  jobs/scheduler.ts        hourly subscription reconciliation (MySQL advisory lock)
  cli/                     migrate, seed, storage-init, reconcile, import-legacy
tests/
  unit/                    no database needed
  integration/             real MySQL; fake MinIO/Google, Apple test PKI
  fixtures/apple-test-pki/ test-only certificate chain for real JWS verification
certs/apple/               Apple root CAs used in production
```

## API (`/api/v1`)

Authenticate with `Authorization: Bearer <token>` (returned by login/register).
Successful responses contain `"status": "ok"`; errors look like
`{ "status": "error", "code": "SUBSCRIPTION_REQUIRED", "message": "…", "request_id": "…" }`.
Lists are paginated with `?page=1&limit=20` and return `pagination`.

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET/PATCH/DELETE /auth/me`, `POST /auth/me/avatar`, `POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /auth/password/change`, `POST /auth/email/resend-verification` |
| Subscriptions | `GET /subscriptions/plans`, `GET /subscriptions/me`, `POST /subscriptions/verify`, `POST /subscriptions/restore` |
| Webhooks | `POST /webhooks/apple` (App Store Server Notifications V2), `POST /webhooks/google` (Pub/Sub push, OIDC) |
| Books | `GET /books`, `GET /books/:id`, `GET /books/:id/related`, `GET /books/:id/file?format=pdf\|epub` 🔒, `GET /books/:id/chapters` (locked chapters have no URL), `POST /books/:id/views`, `GET/PUT /books/:id/progress` |
| Articles | `GET /articles` (no bodies), `GET /articles/:id` (body/audio only with access), `POST /articles/:id/views` |
| Catalogue | `GET /home`, `GET /categories`, `GET /categories/:id`, `GET /authors`, `GET /authors/:id`, `PUT/DELETE /authors/:id/follow`, `GET /collections`, `GET /collections/:id`, `GET /search?q=`, `GET /faqs`, `GET /notifications` |
| Me | `GET /library`, `PUT/DELETE /library/:type/:id`, `GET/POST /reviews`, `DELETE /reviews/:id` |
| Admin | CRUD `/admin/books`, `/admin/books/:id/chapters`, `/admin/chapters`, `/admin/articles`, `/admin/authors`, `/admin/categories`, `/admin/collections` (+`/items`), `/admin/sliders`, `/admin/faqs`; `POST /admin/uploads/presign`, `POST /admin/uploads`; `GET/PATCH /admin/plans`; `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/role`, `POST /admin/users/:id/grants`, `DELETE /admin/grants/:id`; `POST /admin/jobs/reconcile`; `GET /admin/subscription-events` |
| Health | `GET /health` (liveness), `GET /health/ready` (database + storage) |

Better Auth's native routes are mounted at `/api/auth/*` (email verification links).

### Purchase flow (mobile)

```
app ──GET /subscriptions/me──────────▶ account_token (= user id)
app ──StoreKit / Play Billing purchase (appAccountToken / obfuscatedAccountId = account_token)
app ──POST /subscriptions/verify─────▶ backend ──verify──▶ Apple JWS chain / Play subscriptionsv2
    { platform: 'ios', transaction_jws }                         │
    { platform: 'android', product_id, purchase_token }          ▼
app ◀────────────── entitlement ─────── subscriptions row (+ Play acknowledge)
app ──finishTransaction()  (only after verify succeeded)

Apple / Google ──webhooks──▶ backend  renewals, cancellations, grace periods, refunds (idempotent)
hourly job ──────────────▶ Apple/Google status APIs for subscriptions near expiry or stale
```

A store subscription can belong to one Loikmon account only
(`PURCHASE_ALREADY_LINKED`), so one Apple ID / Google account cannot unlock many
accounts.

## Local development

```bash
# repo root
docker compose up -d mysql minio
cp packages/backend/.env.example packages/backend/.env
npm install
npm run dev:backend                     # http://localhost:4001, migrates on boot
npm run db:seed -w @loikmon/backend     # admin@loikmon.local / admin-password-123 + sample catalogue
```

Useful scripts (`npm run <script> -w @loikmon/backend`):

| Script | Purpose |
|--------|---------|
| `dev` | watch mode (tsx) |
| `typecheck` / `build` / `start` | compile checks, `dist/` build, run the build |
| `test` | unit tests |
| `test:integration` | HTTP tests against real MySQL (`TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`; database `loikmon_test` is recreated) |
| `db:migrate`, `db:seed` | schema / development data |
| `storage:init` | create MinIO buckets + public-read policy |
| `jobs:reconcile` | re-check store subscriptions once |
| `import:legacy [--files] [--all-paid]` | import catalogue from the old PHP API (`LEGACY_API_BASE`) |

## Testing strategy

- **Unit** (`tests/unit`): entitlement/access rules, plan mapping, config safety,
  error handling, storage URL signing, Google state mapping and push auth, and
  **Apple JWS verification through Apple's real `SignedDataVerifier`** using a
  test certificate chain (tampered, unsigned, wrong-bundle and non-subscription
  tokens are rejected).
- **Integration** (`tests/integration`): the real Express app + MySQL + Better
  Auth — registration/login/logout/password reset/account deletion/legacy
  migration; catalogue filters and Mon-script search; paywall behaviour for
  anonymous, signed-in, free, granted users; iOS and Android verification,
  account-linking protection, App Store and Play notifications (renewal,
  auto-renew off, refund, upgrade, duplicates), reconciliation and restore.

CI (`.github/workflows/ci.yml`) runs both suites with a MySQL service container.

## Error handling & debugging

- Every request gets an id (`X-Request-Id`, echoed in error bodies) and one structured pino log line; secrets and tokens are redacted.
- `AppError` codes are stable and documented in `src/lib/errors.ts`; unknown errors become `INTERNAL_ERROR` (details only outside production).
- Express 5 forwards async errors to the central handler; Better Auth, multer and body-parser errors are mapped to the same format.
- Store calls fail as `STORE_UNAVAILABLE` (retryable) vs `PURCHASE_INVALID` (permanent). Webhooks return 5xx only for transient failures so Apple/Google retry.
- `subscription_events` keeps an audit trail of every verification and notification.
- `LOG_LEVEL=debug` for verbose logs; `GET /health/ready` shows which integrations are enabled.
