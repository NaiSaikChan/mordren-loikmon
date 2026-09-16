# Backend Implementation Plan: Node.js + MySQL + Better Auth — Subscriptions Edition

> Status: **implemented on branch `feat/backend-subscription-iap`**.
> Reference docs: [`packages/backend/README.md`](packages/backend/README.md) (architecture, API, testing) and
> [`DEPLOYMENT.md`](DEPLOYMENT.md) (Hostinger VPS, store setup, operations).

## Executive summary

Loikmon moves off the legacy PHP API (`https://loikmon.org/webapis/`) to its own
backend in this monorepo (`packages/backend`), and from a **coin / per-item
purchase** model to **subscriptions**:

| Plan | Price |
|------|-------|
| Monthly | **$4** / month |
| 3 months | **$10** |
| 6 months | **$20** |
| Yearly | **$45** / year |

A subscriber can open **all books, audiobooks and articles**. Payments use the
platforms' native billing only — **Google Play Billing** on Android and **Apple
In-App Purchase (StoreKit 2)** on iOS, integrated in the Expo app with
[`expo-iap`](https://docs.expo.dev/guides/in-app-purchases/) — and every purchase
is verified server-side. The web app, which has no native gateway, shows plans
and status and sends users to the apps; the entitlement belongs to the account,
so it applies on the web as well. Files (books, images, audio) live in **MinIO**.
Everything deploys with **Docker Compose on the Hostinger VPS** behind the
existing Traefik.

## Decisions vs. the original draft

| Original draft | Implemented | Why |
|----------------|-------------|-----|
| Coins, coin packages, coupons, bank-transfer proofs, per-item `purchases` | `subscription_plans`, `subscriptions`, `subscription_events`, `entitlement_grants` | Subscription business model; complimentary access via admin grants; store offer codes replace coupons |
| Stripe / PayPal / bank transfer | Google Play Billing + Apple IAP only | Requirement: native platform gateways |
| Drizzle ORM + drizzle-kit | Kysely (+ versioned migrations in code) | Better Auth uses Kysely natively for MySQL; one query layer, no codegen |
| Custom `users` / `user_sessions` tables, bcrypt + JWT | Better Auth tables (`users`, `sessions`, `accounts`, `verifications`), scrypt, bearer tokens | Session revocation, password reset, email verification out of the box; same token flow for web and mobile |
| Identity = `email` in POST body (legacy) | `Authorization: Bearer <token>` everywhere | The legacy scheme let anyone act as any email |
| File URLs in every response (legacy) | Private MinIO bucket + short-lived presigned URLs issued only to entitled users | Paid content was downloadable by anyone |
| S3 / CDN | MinIO (public bucket for images, private for PDF/EPUB/audio) | Self-hosted on the VPS |
| `packages/server` BFF proxying to the legacy API | Web nginx proxies `/api` straight to the backend; apps call `api.<domain>` | BFF no longer needed (package kept, unused by the new compose files) |
| AWS ECS / Fly.io | Docker Compose on Hostinger VPS + existing Traefik | Deployment target |
| Legacy RPC endpoints (`POST fetchbooks`, `{data: …}`) | REST `/api/v1/*`; `@loikmon/api` rewritten; payloads keep the legacy field names the UIs render | Clean API without rewriting every screen |

## Phases

### Phase 1 — Foundation & authentication ✅
- [x] `packages/backend` workspace: Express 5, TypeScript ESM, zod-validated config that refuses unsafe production settings
- [x] MySQL schema + migrations (Better Auth migrator, then Kysely migrations `0001_content`, `0002_subscriptions`) with an advisory lock
- [x] Better Auth: register/login/logout, bearer tokens, profile, avatar upload, change/reset password (SMTP), email verification (optional), account deletion (App Store requirement), admin role via `ADMIN_EMAILS`
- [x] Just-in-time migration of legacy accounts (credentials checked once against the old `loginapp`)
- [x] Structured logging with request ids, central error handler with stable codes, helmet, CORS allow-list, rate limits

### Phase 2 — Content ✅
- [x] Books (PDF/EPUB), audio chapters with previews, articles, authors (+follow), categories (shared book/article), collections, sliders, FAQs, notifications
- [x] Server-side access control: free items open; paid content → `LOGIN_REQUIRED` / `SUBSCRIPTION_REQUIRED`
- [x] Search (LIKE, works for Mon script), filters, sorting, 1-based pagination, view counters with throttling
- [x] Reviews (one per user, rating aggregates), synced library, reading progress
- [x] Admin API: CRUD, MinIO uploads (presigned PUT for large files), plan editing, grants, audit log
- [x] Legacy importer `import:legacy [--files] [--all-paid]` (idempotent, resumable file copy into MinIO)

### Phase 3 — Subscriptions & payments ✅
- [x] Plans endpoint with App Store product ids and Google product/base-plan ids
- [x] `POST /subscriptions/verify` + `/restore`: StoreKit 2 JWS verified against Apple root CAs (+ App Store Server API status), Play `subscriptionsv2` verification + acknowledgement
- [x] One store subscription ↔ one account (`appAccountToken` / `obfuscatedAccountId` = user id; `PURCHASE_ALREADY_LINKED`)
- [x] App Store Server Notifications V2 and Google RTDN (Pub/Sub push with OIDC), idempotent event log, upgrades/downgrades, grace period, billing retry, refunds/revocations
- [x] Hourly reconciliation job for missed notifications
- [x] Clients: `@loikmon/api` subscriptions module; mobile paywall with `expo-iap` (verify → then `finishTransaction`); web subscription status page

### Phase 4 — Search, reviews, notifications ✅ (baseline)
- [x] Reviews, notifications inbox (broadcast + per user), search across books/articles/authors
- [ ] Push notifications (Expo push / FCM) — not started
- [ ] Dedicated search engine (Typesense/Meilisearch) — only if the catalogue outgrows MySQL LIKE search

### Phase 5 — Testing & deployment ✅
- [x] Unit tests (domain rules, Apple JWS verification with a test PKI, Google mapping/push auth, config, errors, storage)
- [x] Integration tests against real MySQL (auth, catalogue & paywall, subscriptions & webhooks)
- [x] CI workflow with MySQL service; Docker images build
- [x] Multi-stage Dockerfile, `docker-compose.prod.yml` (backend, web, MySQL 8.4, MinIO, nightly DB backups), `.env.production.example`, `DEPLOYMENT.md`

## Schema overview

| Table | Purpose |
|-------|---------|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth (UUID user ids; extra fields `firstname`, `lastname`, `phone`, `role`) |
| `categories`, `authors`, `author_follows` | Catalogue structure |
| `books`, `book_audio_chapters`, `articles` | Content; `*_key` columns hold MinIO object keys (or legacy URLs until copied) |
| `collections`, `collection_items`, `sliders`, `faqs`, `notifications` | Curation & inbox |
| `reviews`, `library_items`, `reading_progress` | Per-user interactions |
| `subscription_plans` | The four plans and store product ids |
| `subscriptions` | One row per store subscription (Apple original transaction / Google purchase token) |
| `subscription_events` | Audit + idempotency for verifications and notifications |
| `entitlement_grants` | Complimentary access granted by admins |

## Known gaps

- **Not tested on real devices / stores**: purchases, restore, and Android base-plan offer selection are covered by unit tests and backend integration tests with a test PKI, but need sandbox (iOS) and license-tester (Android) runs on a development build.
- **Mon translations**: new subscription/paywall/account strings use English in `mon.json` (≈160 keys on web, ≈80 on mobile).
- **Clients**: reading-progress sync (`books.saveProgress`) and avatar upload exist in the API but are not wired into the web/mobile UI; mobile bookmarks stay on-device; some web labels are still hard-coded English.
- **Dependencies**: `epubjs` pulls `xmldom` with open advisories (only fix is a breaking downgrade); `minio` has moderate transitive advisories. Mobile installs need `--legacy-peer-deps` (pre-existing peer conflicts).
- **Links to confirm**: App Store listing URL (`APP_STORE_URL`), `https://loikmon.org/terms` and `/privacy`.

## Before going live — checklist

1. Store setup (DEPLOYMENT.md §4): App Store subscription group + 4 products, server notifications URL, In-App Purchase key; Play `loikmon_premium` with 4 base plans, service account permissions, Pub/Sub RTDN push subscription.
2. Decide which imported titles stay free (`--all-paid` makes everything subscriber-only).
3. Legal: Terms of Use / Privacy Policy pages (linked from the paywall), subscription disclosure text reviewed.
4. Run the importer with `--files`, verify books open from `storage.<domain>`.
5. Build mobile development/production binaries (expo-iap needs a dev build) and test with sandbox / license testers.
6. Point DNS, deploy, register the admin account, keep `LEGACY_API_BASE` until old users have signed in once.
