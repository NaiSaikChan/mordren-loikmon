# Mordren Loikmon (Modern Loikmon)

> Rebuild of the [loikmon-zcro](https://github.com/NaiSaikChan/loikmon-zcro) Flutter app as a modern web + mobile stack.
> API Document: [loikmon-API](https://github.com/NaiSaikChan/loikmon-zcro/blob/main/API_ENDPOINTS_SUMMARY.md)

## Stack

| Platform | Tech |
|---|---|
| Web Frontend | Vue 3 + Vite + Tailwind CSS v4 |
| Backend / BFF | Node.js 20 + Express 5 |
| State (web) | Pinia |
| Mobile | React Native / Expo (Phase 4) |
| API | `https://loikmon.org/webapis/` |
| i18n | English + Mon (လိက်မန်) |

## Monorepo Structure

```
packages/
  api/      — Shared TypeScript API client (@loikmon/api)
  server/   — Node.js Express BFF (@loikmon/server)
  web/      — Vue 3 web app (@loikmon/web)
  mobile/   — Expo React Native app (@loikmon/mobile) — npm/npx only
```

## Getting Started

```bash
pnpm install
pnpm dev:web     # Start Vue dev server
pnpm dev:server  # Start Express BFF
```

### Mobile (Expo, npm only)

The mobile app is managed with **npm/npx only** and is excluded from the pnpm
workspace. See [`packages/mobile/README.md`](packages/mobile/README.md).

```bash
cd packages/mobile
npm install
npx expo start
```

## Features

- 📚 eBooks — Browse, purchase, read PDF/EPUB
- 🎵 Audio — Audiobooks with mini player
- 📰 Articles — News & articles with categories
- 👤 Authors — Author profiles and catalogs
- 🔍 Search — Full-text search (books + articles)
- 📁 Library — Personal bookshelf & bookmarks
- 🛒 Purchases — Coins, bank transfer, coupons
- 🌙 Dark Mode — System-aware with manual override
- 🌐 i18n — English & Mon language support
- 🖥️ auto layout responsive design
