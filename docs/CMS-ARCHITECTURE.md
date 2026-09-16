# Loikmon CMS Module — Architecture Review & Implementation Plan

> Status: implementation plan for the enterprise CMS module (branch `feat/cms-module`).
> Companion documents: [`DEPLOYMENT.md`](../DEPLOYMENT.md) (infrastructure) and
> [`IMPLEMENT-BACKEND-PLAN.md`](../IMPLEMENT-BACKEND-PLAN.md) (the API this builds on).

---

## 1. Codebase analysis (Phase 1)

### 1.1 Monorepo layout

| Package | Role | Stack |
| --- | --- | --- |
| `packages/backend` | Core API (`/api/v1`) | Node 22, Express 5, Kysely + MySQL 8, Better Auth, MinIO, Zod 4, Pino, Vitest |
| `packages/api` | Shared typed HTTP client | Axios, hand-written response types |
| `packages/web` | Storefront SPA | Vue 3 `<script setup>`, Vite, Pinia, vue-router, vue-i18n, Tailwind v4 |
| `packages/mobile` | Expo app | React Native (out of scope for this module) |
| `packages/server` | Legacy PHP-API BFF proxy | Express 4 — superseded, untouched |

### 1.2 Backend patterns reused

* **Composition root** — `src/container.ts` builds one `AppContext` (`src/http/context.ts`) holding
  config, logger, `db`, `auth`, `mailer`, `storage`, payment clients and a `services` bag. Tests swap
  external services through `ContainerOverrides`. Every new CMS service is registered there.
* **Error model** — `src/lib/errors.ts` exposes `AppError` with a stable machine-readable `code`;
  `middleware/error.ts` maps Better Auth, Multer, `body-parser` and MySQL errno failures onto it.
  New CMS failures get codes in `ErrorCode`, never ad-hoc strings.
* **Validation** — `http/validate.ts` `parse(schema, data)` throws a 400 `VALIDATION_ERROR` listing
  every Zod issue, plus `pagination`, `pageInfo`, `idParam`, `likePattern` helpers.
* **Migrations** — bundled in code (`db/migrate.ts` + `db/migrations/*`), guarded by a MySQL advisory
  lock, run after Better Auth's own schema diff. CMS tables land in `0003_cms.ts`.
* **Storage** — `storage/storage.ts` splits a public bucket (covers, thumbnails) from a private bucket
  (PDF/EPUB/audio) reachable only through short-lived presigned URLs. Asset kind to visibility and
  allowed content types are declared once in `ASSET_VISIBILITY` / `ASSET_CONTENT_TYPES`.
* **Access control today** — a single boolean: `middleware/auth.ts` `requireAdmin` tests
  `req.user.role === 'admin'`. `domain/access.ts` decides *content* access from the entitlement.

### 1.3 Frontend patterns reused

* Pinia setup stores with `ref` / `computed` (`stores/auth.ts` is the reference implementation).
* Route-level code splitting through `() => import(...)` in `router/index.ts`; `meta.requiresAuth`
  enforced in `router.beforeEach` after `auth.ensureRestored()`.
* Tailwind v4 design system in `assets/main.css`: `@theme` tokens (`brand-*`, `surface-*`) and
  component classes `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`,
  `.badge-*`, `.nav-link`, `.skeleton`, `.page-wrapper`. Dark mode is class-based (`.dark`).
* Shared components already available: `LoadingSpinner`, `EmptyState`, `Pagination`, `SectionHeader`.

### 1.4 Findings and how this module responds

| # | Finding | Response |
| --- | --- | --- |
| 1 | Authorisation is a single `role === 'admin'` bit — no manager/author tiers, no granular checks. | RBAC layer: code-defined permission catalogue, DB-backed roles, `requirePermission()` middleware. |
| 2 | `adminRouter`'s generic `crud()` helper casts Kysely to `Record<string, unknown>` and writes any validated body to any table — no ownership checks, no auditing. | CMS routes go through services that scope by ownership and write audit entries. The legacy `/admin` routes stay for backward compatibility. |
| 3 | No audit trail: role changes, publishing and entitlement grants leave no record. | `audit_logs` table plus `AuditService`, written in the same transaction as the change where it matters. |
| 4 | Publishing is a single `is_published` boolean — no draft/review workflow, no version history. | `status` workflow column (kept in sync with `is_published`) plus `content_versions` snapshots. |
| 5 | Reviews are published instantly with no moderation or reporting. | `reviews.status` plus `review_reports`; public listing and rating aggregation count published reviews only. |
| 6 | Sliders have no scheduling or audience rules. | `starts_at` / `ends_at` / `audience` / `placement` columns, enforced in the public query. |
| 7 | No settings store — branding, SEO and feature toggles are hard-coded or absent. | `settings` table with a public subset served at `GET /api/v1/settings`. |
| 8 | Rating aggregation (`EngagementService.refreshRating`) counts every review row. | Counts `status = 'published'` rows only. |
| 9 | `articles.content` is raw HTML rendered by the SPA; only the client sanitises it. | Server-side sanitisation on write (`lib/sanitize.ts`) in addition to the existing DOMPurify render path. |

### 1.5 Constraints accepted

* **Backward compatibility.** No existing table is renamed or dropped and no existing column changes
  meaning. `is_published` remains the flag the public catalogue filters on; `status` is the richer
  workflow state the CMS maintains alongside it.
* **No new runtime dependencies.** Charts are hand-rolled inline SVG, PDF export uses the browser's
  print pipeline with a print stylesheet, CSV export is built in the client. `dompurify` (already a
  web dependency) sanitises rich text in the browser; the server sanitises with an allow-list.

---

## 2. CMS architecture (Phase 2)

```
                    +------------------- packages/web --------------------+
  browser --------->|  /cms/*   CmsLayout -> pages -> cms stores          |
                    |           PermissionGate / usePermissions           |
                    +------------------------+----------------------------+
                                             | @loikmon/api (cms.*, typed)
                    +------------------------v-- packages/backend --------+
                    | /api/v1/cms   requirePermission() + ownership scope  |
                    | --------------------------------------------------- |
                    | services/cms/*  content, coupons, feedback,          |
                    |                 policies, settings, analytics        |
                    | services/rbac.ts   roles -> permissions (cached)     |
                    | services/audit.ts  append-only audit_logs            |
                    | --------------------------------------------------- |
                    | Kysely / MySQL 8         MinIO (public + private)    |
                    +-----------------------------------------------------+
```

### 2.1 Permission model

Permissions are **code-defined** (`src/domain/permissions.ts`) so they can be type-checked and
refactored; the **role to permission** mapping is **data** (`role_permissions`) so an admin can create
custom roles at runtime. Effective permissions are the union over every role assigned to the user.

```
users --< user_roles >-- roles --< role_permissions
  |                        |
  +- role (denormalised primary role key, kept for backward compatibility)
```

`users.role` keeps working exactly as before (`'admin'` still means admin) and is maintained by
`RbacService` as the highest-precedence assigned role (`admin > manager > author > user`).

### 2.2 Ownership (authors)

`authors.user_id` already links an author profile to an account. A user holding the `author` role may
only touch rows whose `author_id` is one of *their* author profiles. This is enforced at four layers:

| Layer | Mechanism |
| --- | --- |
| Database | `coupons.author_id` FK, `books.author_id` / `articles.author_id` FK, unique keys |
| Service | `CmsActor.ownedAuthorIds` resolved once per request; every service method takes the actor and adds the `where` clause |
| API | `requirePermission()` plus `loadCmsActor()` middleware on `/api/v1/cms/*` |
| UI | `usePermissions()` and `<PermissionGate>` hide actions the session cannot perform |

### 2.3 Module map

| Module | Backend route | Frontend route | Key permissions |
| --- | --- | --- | --- |
| Dashboard | `GET /cms/analytics/*` | `/cms` | `analytics.view`, `analytics.own.view` |
| Users | `/cms/users` | `/cms/users` | `users.*` |
| Roles and permissions | `/cms/roles` | `/cms/roles` | `roles.manage` |
| Authors | `/cms/authors` | `/cms/authors` | `authors.*` |
| Books | `/cms/books` | `/cms/books` | `books.*`, `own_content.*` |
| Audiobooks | `/cms/books/:id/chapters` | `/cms/audiobooks` | `audiobooks.*` |
| Articles | `/cms/articles` | `/cms/articles` | `articles.*`, `own_content.*` |
| Categories | `/cms/categories` | `/cms/categories` | `categories.*` |
| Collections | `/cms/collections` | `/cms/collections` | `collections.*` |
| Plans and subscriptions | `/cms/plans`, `/cms/subscriptions` | `/cms/subscriptions` | `plans.*`, `subscriptions.*` |
| Coupons | `/cms/coupons` | `/cms/coupons` | `coupons.*`, `author.coupons.*` |
| Reviews | `/cms/reviews` | `/cms/reviews` | `reviews.*` |
| Feedback | `/cms/feedback` | `/cms/feedback` | `feedback.*` |
| Policies and terms | `/cms/policies` | `/cms/policies` | `policies.*` |
| Sliders | `/cms/sliders` | `/cms/sliders` | `sliders.*` |
| Settings | `/cms/settings` | `/cms/settings` | `settings.manage` |
| Audit log | `/cms/audit-logs` | `/cms/audit` | `audit.view` |

---

## 3. Delivery order

1. `0003_cms.ts` migration plus `db/types.ts` additions.
2. `domain/permissions.ts`, `services/rbac.ts`, `services/audit.ts`, permission middleware, container wiring.
3. CMS services (content, coupons, feedback, policies, settings, analytics).
4. `/api/v1/cms` routers plus public `/settings` and `/policies` endpoints.
5. `@loikmon/api` CMS endpoints and types.
6. Web CMS shell (layout, guard, design primitives), then one page per module.
7. Tests: unit (permissions, coupons, analytics, sanitiser), integration (RBAC, ownership, workflow,
   coupons), web store/component tests.
8. Documentation: `docs/CMS-MODULE.md` (design, security review, deployment and rollback).
