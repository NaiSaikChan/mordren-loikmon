# Loikmon CMS Module

Operator and engineer reference for the CMS shipped on `feat/cms-module`.
For the analysis that led to this design, see [`CMS-ARCHITECTURE.md`](./CMS-ARCHITECTURE.md).

- **Backend** — `packages/backend/src/domain/permissions.ts`, `src/services/rbac.ts`,
  `src/services/audit.ts`, `src/services/cms/*`, `src/http/routes/cms/*`, `src/http/routes/site.ts`
- **API client** — `packages/api/src/endpoints/cms.ts`, `src/cms-types.ts`
- **Web app** — `packages/web/src/cms/*`, mounted at `/cms`

---

## 1. Roles

Four roles are seeded. Permissions are a fixed vocabulary in the backend; the
role-to-permission mapping is data, so an administrator can build custom roles
from **Administration → Roles & permissions** without a deployment.

| Role | Rank | Scope | Summary |
| --- | --- | --- | --- |
| `admin` | 400 | all | Every permission, including roles, settings and the activity log. |
| `manager` | 300 | all | Catalogue, membership, coupons and community. **No** `roles.manage`, `settings.manage`, `audit.view` or `users.delete`. |
| `author` | 200 | own | Only content whose `author_id` is one of the account's author profiles, plus coupons for those items. |
| `user` | 100 | own | No CMS access. |

**Scope** is the second half of authorisation. A permission answers *may this
actor do this at all*; the scope answers *to which rows*. An `own`-scoped actor
is restricted in SQL to `author_id IN (their author profile ids)` — the filter is
part of the query, so a route that forgets a check still cannot leak rows.

### Linking an author account

An Author-role account reaches content through `authors.user_id`:

1. **Authors → New author** (or edit an existing one) and set **Linked account**
   to the user's id, found on **Users → the account**.
2. **Users → the account → Roles** and tick **Author**.

Until a profile is linked, an Author-role account has an empty scope and sees
nothing — the CMS says so when they try to create content.

### Custom roles

`scope: own` plus a narrow permission set builds things like a proofreader
(`articles.view`, `articles.edit`, no publish) or an audio editor
(`books.view`, `audiobooks.*`, `media.upload`). Two rules always hold regardless
of permissions: nobody can remove their own administrator role, and the last
administrator cannot be demoted or deleted.

---

## 2. Editorial workflow

`status` carries the workflow; `is_published` stays the flag the public
catalogue filters on and is written in the same statement, so the two can never
disagree.

```
draft ──▶ in_review ──▶ published ──▶ archived
  │           │             │            │
  │           └──▶ scheduled ┘            │
  └──────────◀──────────────────────────── ┘   (archived returns to draft only)
```

* `scheduled` + a future `published_at` goes live by itself: the reconciliation
  job calls `publishDue()` every `JOBS_RECONCILE_INTERVAL_MINUTES`.
* Publishing needs `books.publish` / `articles.publish`, or `own_content.publish`
  for an author. An editor without it can still save drafts and submit for
  review, which is what the **Submit for review** button does.
* Any other move returns `409 INVALID_TRANSITION`.

**Version history.** Every save snapshots the previous row into
`content_versions` (keyed by its `revision`). Restoring writes a snapshot of the
current state first, so a restore is itself undoable.

---

## 3. Coupon ownership model

```
Coupon
├─ code                 unique, immutable once created
├─ created_by_user_id   who made it
├─ author_id            owning author — NULL only for platform campaigns
├─ scope                global | subscription | book | article
├─ book_id / article_id / plan_code
├─ campaign_type        free-text label for reporting
├─ discount_type        percent | fixed        discount_value
├─ max_discount_cents / min_order_cents / currency
├─ usage_limit / usage_limit_per_user / used_count
├─ starts_at / ends_at / status
└─ created_at, updated_at  (+ audit_logs entries)
```

`author_id` is **derived from the item**, never taken from the request: picking
a book sets the coupon's author to that book's author. That is what makes "an
author cannot manage another author's coupons" enforceable rather than advisory.

Enforcement at four layers, as the specification requires:

| Layer | Mechanism |
| --- | --- |
| Database | FKs to `authors`, `books`, `articles`, `subscription_plans`; unique `code`; cascade delete with the owning author |
| Service | `CouponService` scopes every read with `author_id IN (...)` and checks `assertCanManage` / `assertCanAnalyse` before any write |
| API | `requireAnyPermission('coupons.*', 'author.coupons.*')`; `coupons.global.manage` is checked inside the service, where the payload's scope is known |
| UI | The scope selector offers only *book* and *article* without `coupons.global.manage`; the list and detail pages are already server-filtered |

**Redemption** (`CouponService.redeem`) validates the window, the item, the
total and per-user limits, then consumes one redemption inside a transaction
with `SELECT … FOR UPDATE`, so two concurrent checkouts cannot both take the
last one. A campaign with redemptions is **archived, never deleted** — the
history stays auditable.

**Printing and export.** Campaign detail renders a voucher card; *Print / PDF*
prints just that fragment through the browser, whose print dialog offers *Save
as PDF*. CSV export is available from the list (client-side) and from
`GET /cms/coupons/export` (server-side, same ownership scope).

---

## 4. Module reference

| Module | Route | Notes |
| --- | --- | --- |
| Dashboard | `/cms` | Platform or author view, decided by the server from `analytics.view` |
| Books | `/cms/books`, `/cms/books/:id` | Details, files, audiobook chapters, version history |
| Audiobooks | `/cms/audiobooks` | Books with/without narration; chapters are edited on the book |
| Articles | `/cms/articles`, `/cms/articles/:id` | Rich text, scheduling, versions |
| Authors | `/cms/authors` | Profiles, account linking, verification |
| Categories | `/cms/categories` | Nested tree, drag-and-drop **and** keyboard reordering |
| Collections | `/cms/collections` | Curated and featured lists with an item picker |
| Membership | `/cms/membership` | Plans, store product ids, live subscriptions, manual reconciliation |
| Coupons | `/cms/coupons`, `/cms/coupons/:id` | Campaigns, performance, printable voucher |
| Reviews | `/cms/reviews` | Moderation queue and reader reports |
| Feedback | `/cms/feedback` | Ticket queue, public replies and internal notes |
| Sliders | `/cms/sliders` | Scheduling and audience rules |
| Policies | `/cms/policies` | Versioned legal text |
| Settings | `/cms/settings` | Branding, SEO, social, e-mail, feature toggles |
| Users | `/cms/users` | Accounts, role assignment, complimentary access |
| Roles | `/cms/roles` | Role editor over the permission catalogue |
| Activity log | `/cms/audit` | Append-only trail with before/after values |

### Public endpoints this module adds

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/settings` | Public settings only (`is_public`), cached 60s |
| `GET /api/v1/policies`, `GET /api/v1/policies/:slug` | Published policy text |
| `POST /api/v1/feedback` | Contact form (guests allowed, rate-limited) |
| `GET /api/v1/feedback/me` | The signed-in reader's tickets, internal notes excluded |
| `POST /api/v1/reviews/:id/report` | Flag a review for moderation |

### Feature toggles

| Key | Effect |
| --- | --- |
| `features.reviews_enabled` | `POST /reviews` returns 503 when off |
| `features.reviews_require_approval` | New reviews are created `pending` and stay out of the public rating until approved |
| `features.feedback_enabled` | `POST /feedback` returns 503 when off |
| `features.coupons_enabled`, `features.registration_enabled` | Read by the storefront |

---

## 5. Security review

### What the module enforces

| Area | Control |
| --- | --- |
| Authentication | Every `/api/v1/cms/*` route requires a session (`requireAuth`), then `loadCmsActor` resolves permissions once per request |
| Authorisation | `requirePermission` / `requireAnyPermission` per route; row ownership decided inside the services, in SQL |
| Least privilege | `manager` has no `roles.manage`, `settings.manage`, `audit.view` or `users.delete`; `author` has no `coupons.global.manage`, no user management and no platform analytics |
| Lockout protection | An administrator cannot remove their own admin role; the last administrator cannot be demoted or deleted; the `admin` role cannot lose permissions; system roles cannot be deleted or re-scoped |
| Input validation | Every body, query and parameter goes through a Zod schema (`http/validate.ts#parse`), which returns a 400 listing each problem |
| XSS | `lib/sanitize.ts` allow-lists elements and attributes on write, drops every `on*` handler and `style`, and rejects non-`http(s)/mailto/tel/relative` URLs (control characters stripped first). DOMPurify sanitises again in the editor and at render time |
| SQL injection | Kysely parameterises everything; the few `sql` fragments interpolate bound values, never concatenated strings; `likePattern` escapes `%`, `_` and backslash |
| CSRF | The API authenticates with a bearer token from `localStorage`, not an ambient cookie, so a cross-site form post carries no credentials. CORS is an explicit origin allow-list with `credentials: true` |
| File uploads | Every upload names an asset type from `@loikmon/media-standards` ([MEDIA-STANDARDS.md](MEDIA-STANDARDS.md)), which decides the bucket, formats, byte limit and minimum dimensions; images are decoded server-side (real format and size, pixel-count cap) and SVGs with scriptable content are refused; documents and audio are identified by magic bytes; large files go straight to MinIO with a 15-minute presigned PUT and are verified on `/media/complete`; private assets are only ever served through short-lived signed GETs |
| Rate limiting | `express-rate-limit` on the API (300/min per user or IP), auth (30/15 min) and purchases; the public feedback form uses the API limiter |
| Audit | Every role, permission, publish, coupon, settings, grant and moderation action writes an `audit_logs` row with actor, IP, user agent, request id and the before/after values |
| Secret hygiene | `redactSnapshot` strips anything matching `password|token|secret|private_key|authorization` before it reaches the audit table; Pino redacts the same in logs |
| Error handling | One error model with stable codes; internal error details are only echoed outside production |

### Residual risks and accepted trade-offs

1. **Editors are trusted with HTML.** The sanitiser is an allow-list, but rich
   text remains the largest XSS surface. Mitigation is defence in depth (server
   allow-list + DOMPurify) plus the audit trail. Adding a Content-Security-Policy
   with `script-src 'self'` to the nginx config would close the residual gap and
   is the recommended next step; it is not enabled here because the storefront
   currently loads an inline-eval PDF worker (`vue3-pdf-app`).
2. **Revenue figures are estimates.** Purchases settle inside the App Store and
   Google Play. The dashboard labels the number as an estimate and the
   documentation repeats it; treat App Store Connect and Play Console as the
   books of record.
3. **Permission cache.** `RbacService` caches an actor's effective permissions
   for 30 seconds. A revoked role therefore keeps working for up to half a
   minute. `invalidate()` is called on every role change made through the CMS,
   so the window only applies to changes made directly in the database.
4. **`document.execCommand`** drives the rich-text editor. It is deprecated but
   still universally implemented, and it avoids adding an editor framework to
   the bundle. Output is sanitised on both ends regardless.
5. **Bulk actions are sequential.** They apply per row and report partial
   failure rather than running in one transaction, so a bulk publish can
   half-succeed. That is deliberate: one unpublishable row should not block the
   other forty-nine, and the response names the ones that failed.

### Checks worth repeating before each release

```bash
npm run typecheck -w @loikmon/backend && npm run typecheck -w @loikmon/web
npm run test -w @loikmon/backend            # unit
npm run test -w @loikmon/web
TEST_DB_HOST=127.0.0.1 npm run test:integration -w @loikmon/backend
npm audit --omit=dev
```

---

## 6. Deployment

The CMS adds **no new services and no new runtime dependencies**. It ships
inside the existing backend and web images, so the deployment is the standard
one described in [`DEPLOYMENT.md`](../DEPLOYMENT.md).

### 1. Migrate

`0003_cms` runs automatically on boot when `DB_MIGRATE_ON_BOOT=true` (the
default), guarded by the same MySQL advisory lock as the earlier migrations, so
rolling several backend replicas is safe. To run it by hand:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate
```

The migration is additive: it creates the CMS tables, adds columns to `books`,
`articles`, `authors`, `reviews`, `sliders` and `collections`, and backfills
them from the existing values (`status` from `is_published`,
`verification_status` from `is_verified`). No column changes meaning and nothing
is dropped, so a backend of the previous version keeps working against the new
schema.

### 2. Seed the first administrator

Existing accounts keep exactly the access they had: the migration gives every
`role = 'admin'` user the **admin** role and everyone else **user**.
`ADMIN_EMAILS` still promotes an address on sign-up. After that, manage roles
from **Administration → Roles & permissions**.

### 3. Deploy

```bash
git pull
docker compose -f docker-compose.prod.yml build backend web
docker compose -f docker-compose.prod.yml up -d backend web
curl -fsS https://api.loikmon.org/health/ready | jq
```

The web image needs no new build arguments; `/cms` is served by the same SPA
fallback as every other route.

### 4. Verify

1. Sign in as an administrator and open `/cms` — the dashboard should load.
2. **Roles & permissions** lists four system roles with a full permission grid.
3. Publish and unpublish a test book; confirm it appears and disappears on the
   storefront.
4. **Activity log** shows those actions with your account and a before/after diff.
5. `curl -fsS https://api.loikmon.org/api/v1/settings` returns the public settings.

### Rollback

Because the schema change is additive, **rolling back the application does not
require rolling back the database**:

```bash
# Application only — the recommended rollback.
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build backend web
docker compose -f docker-compose.prod.yml up -d backend web
```

The previous backend ignores the new tables and columns entirely. Content
published through the CMS stays published because `is_published` was kept
authoritative throughout.

If the schema itself must go, take a backup first — dropping these tables
destroys the audit trail, coupon history and policy versions permanently:

```bash
docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -u root -p loikmon > backup-before-cms-rollback.sql

docker compose -f docker-compose.prod.yml exec backend \
  npm run db:migrate:down -- --yes
```

That rolls back the most recent migration — `0003_cms` — whose `down()` drops
the CMS tables and removes the added columns in reverse dependency order, under
the same advisory lock. The confirmation flag is required on purpose. Set
`DB_MIGRATE_ON_BOOT=false` before restarting, or the next boot re-applies it.

### Operational notes

* **Jobs.** `publishDue()` (scheduled content) and `expireDue()` (lapsed
  campaigns) run on the existing reconciliation schedule under the same advisory
  lock — nothing new to configure.
* **Storage.** CMS uploads reuse the existing MinIO buckets. Processed images use the `<kind>/<yyyy-mm>/<uuid>/original.<ext>` layout with derived variants beside the original, and files registered in the media library are kept when content releases them (see [MEDIA-STANDARDS.md](MEDIA-STANDARDS.md)).
  No new bucket or policy is needed.
* **Growth.** `audit_logs` is append-only. It is indexed on
  `(entity_type, entity_id, created_at)`, `(actor_id, created_at)` and
  `(action, created_at)`. Plan a retention policy (for example, archive rows
  older than two years) once volume warrants it; the module does not delete
  audit rows on its own, by design.
