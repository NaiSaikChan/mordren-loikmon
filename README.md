# Mordren Loikmon (Modern Loikmon)

> Rebuild of the [loikmon-zcro](https://github.com/NaiSaikChan/loikmon-zcro) Flutter app as a modern web + mobile stack
> with its own backend and a subscription model.

## Stack

| Platform | Tech |
|---|---|
| Backend | Node.js 22 + Express 5 + TypeScript, MySQL 8 (Kysely), Better Auth — [`packages/backend`](packages/backend/README.md) |
| Storage | MinIO (covers, PDF/EPUB, audio) |
| Payments | Google Play Billing (Android) & Apple In-App Purchase (iOS) via `expo-iap`, verified server-side |
| Web Frontend | Vue 3 + Vite + Tailwind CSS v4, Pinia |
| Mobile | React Native / Expo (development build) |
| API client | `@loikmon/api` (shared by web and mobile) |
| Deployment | Docker Compose on a VPS behind Traefik — [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| i18n | English + Mon (လိက်မန်) |

## Subscriptions

| Plan | Price |
|---|---|
| Monthly | $4 |
| 3 months | $10 |
| 6 months | $20 |
| Yearly | $45 |

An active subscription unlocks every book, audiobook and article. Subscriptions
are bought in the Android/iOS apps and apply to the account on the web too.

## Monorepo Structure

```
packages/
  backend/  — Core API: auth, catalogue, subscriptions, MinIO (@loikmon/backend)
  api/      — Shared TypeScript API client (@loikmon/api)
  web/      — Vue 3 web app (@loikmon/web)
  mobile/   — Expo React Native app (@loikmon/mobile) — npm/npx only, own lockfile
  server/   — Legacy BFF proxy to the old PHP API (no longer deployed)
```

## Getting Started

```bash
npm install
docker compose up -d mysql minio                       # local MySQL + MinIO
cp packages/backend/.env.example packages/backend/.env
npm run dev:backend                                     # http://localhost:4001
npm run db:seed -w @loikmon/backend                     # sample data + admin@loikmon.local
npm run dev:web                                         # http://localhost:5173 (proxies /api)
```

### Tests

```bash
npm run test -w @loikmon/backend                        # unit
npm run test:integration -w @loikmon/backend            # needs TEST_DB_* (MySQL)
npm run test -w @loikmon/api
npm run test -w @loikmon/web
```

### Mobile (Expo, standalone)

The mobile app has its own `package-lock.json` and is **not** part of the root
npm workspace. In-app purchases need a development build (not Expo Go). See
[`packages/mobile/README.md`](packages/mobile/README.md).

```bash
cd packages/mobile
npm install
npx expo run:android   # or: npx expo run:ios
```

## Features

- 📚 eBooks — Browse and read PDF/EPUB (signed, short-lived file URLs)
- 🎵 Audio — Audiobooks with preview chapters and mini player
- 📰 Articles — News & articles with categories
- 👤 Authors — Author profiles, follow
- 🔍 Search — Books, articles and authors (Mon script supported)
- 📁 Library — Saved items synced across devices, reading progress
- 👑 Subscriptions — Google Play / App Store billing, restore purchases
- 🌙 Dark Mode — System-aware with manual override
- 🌐 i18n — English & Mon language support
- 🖥️ Responsive layout
