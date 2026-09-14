# @loikmon/backend

Core backend for **Loikmon** — Node.js + Express + MySQL. Replaces the legacy
coin-based, per-item purchase model with a **flat subscription** that unlocks
**all** books and articles while active. Handles native IAP verification
(Google Play / Apple), Stripe web subscriptions, and protected content delivery
via MinIO signed URLs.

## Why this exists

The Flutter app (`loikmon-zcro`) previously charged coins per book/article
(`purchasebook`, `getusercoins`, ...). This backend implements the replacement:
one active subscription → access to the entire catalogue.

## Subscription plans

| Code         | Name     | Price | Duration |
|--------------|----------|-------|----------|
| `monthly`    | Monthly  | $4    | 30 days  |
| `quarterly`  | 3 Months | $10   | 90 days  |
| `semiannual` | 6 Months | $20   | 180 days |
| `yearly`     | Yearly   | $45   | 365 days |

Source of truth: `src/domain/plans.ts` (mirrored into the `subscription_plans` table).

## Architecture

```
mobile (Expo)  ──native purchase──▶  POST /api/subscriptions/verify
   │                                    │
   │                                    ├─ Android → Google Play Developer API v2
   │                                    └─ iOS     → Apple verifyReceipt / StoreKit2
   │
web (Vue)      ──Stripe Checkout──▶  POST /api/subscriptions/checkout
                                        │
                                        └─ Stripe webhook → /api/webhooks/stripe

All providers write to ONE unified `subscriptions` table.
Access = MAX(expires_at) among status IN ('active','grace_period').

reader ─▶ GET /api/content/:type/:id/url  ──requireSubscription──▶ MinIO signed URL
```

### Layers

- `domain/` — pure business rules (plan catalogue, expiry math)
- `repositories/` — SQL data access (users, subscriptions, payment events)
- `services/` — orchestration (verify→persist→entitlement), payments/*, storage
- `services/payments/` — one verifier per provider, normalised to `VerifiedPurchase`
- `middleware/` — auth (JWT), entitlement gate, rate limiting, error envelope
- `routes/` — HTTP surface (auth, subscriptions, content, webhooks, health)

## API surface

| Method | Path                                     | Auth        | Purpose |
|--------|------------------------------------------|-------------|---------|
| POST   | `/api/auth/register`                     | –           | Create account |
| POST   | `/api/auth/login`                        | –           | Get JWT |
| GET    | `/api/auth/me`                           | Bearer      | Current user |
| GET    | `/api/subscriptions/plans`               | –           | Plan catalogue |
| GET    | `/api/subscriptions/me`                  | Bearer      | Entitlement + history |
| POST   | `/api/subscriptions/verify`              | Bearer      | Verify native IAP (iOS/Android) |
| POST   | `/api/subscriptions/checkout`            | Bearer      | Create Stripe Checkout session |
| GET    | `/api/content/:type/:id/url`             | Bearer + sub| Signed URL for protected asset |
| GET    | `/api/content/:type/:id/cover`           | –           | Public cover image URL |
| POST   | `/api/webhooks/stripe`                   | signature   | Stripe subscription lifecycle |
| POST   | `/api/webhooks/apple`                    | JWS         | App Store Server Notifications v2 |
| POST   | `/api/webhooks/google`                   | token       | Play Real-Time Developer Notifications |
| GET    | `/health` · `/health/ready`              | –           | Liveness / readiness |

## Local development

```bash
# 1. Start infra (MySQL + MinIO)
docker compose -f packages/backend/docker-compose.dev.yml up -d

# 2. Configure env
cp packages/backend/.env.example packages/backend/.env
#   set DB_HOST=localhost, MINIO_ENDPOINT=localhost for local dev

# 3. Install (repo root; --legacy-peer-deps due to pre-existing web vite conflict)
npm install --legacy-peer-deps

# 4. Migrate + seed
npm run db:migrate -w @loikmon/backend
npm run db:seed    -w @loikmon/backend

# 5. Run
npm run dev -w @loikmon/backend      # http://localhost:4001/health
```

## Build & test

```bash
npm run build -w @loikmon/backend    # tsc → dist/
npm test      -w @loikmon/backend    # vitest (22 tests)
```

## Production deployment (Hostinger VPS)

Uses the shared Traefik reverse proxy + Let's Encrypt (see the
`docker-traefik-vps-deploy` runbook).

```bash
docker network create traefik                     # once, shared across stacks
cp packages/backend/.env.example packages/backend/.env   # fill ALL secrets
docker compose -f packages/backend/docker-compose.prod.yml up -d --build
curl https://api.loikmon.com/health
```

Set `RUN_MIGRATIONS_ON_BOOT=true` to auto-apply migrations on container start.

## Security notes

- Passwords hashed with scrypt + per-user salt (constant-time verify).
- JWT signed with `AUTH_SECRET` — the app refuses to boot in production with the
  dev placeholder.
- Protected content (books/audio) is **never** public: access is gated by an
  active subscription and delivered through short-lived MinIO signed URLs.
  Only cover/thumbnail images are public.
- Stripe webhooks verified via signature; Apple/Google notifications de-duplicated
  in `payment_events` (idempotent processing).
- Helmet + CORS allow-list + tiered rate limiting (strict on auth/verify).

## Hardening TODO (flagged, not blocking)

- Apple StoreKit2 JWS: verify the x5c certificate chain against Apple's root CA
  (use `@apple/app-store-server-library` `SignedDataVerifier`). Current code
  decodes + verifies via `verifyReceipt`; JWS signature-chain check is a TODO.
- Apple/Google webhook handlers record events; wiring full transaction extraction
  to status transitions is stubbed where the signed inner payload is required.
