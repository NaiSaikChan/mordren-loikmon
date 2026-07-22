# @loikmon/mobile

Loikmon eBook & Audio mobile app — **Expo (managed) + React Native + TypeScript**.

> ⚠️ This package is a **standalone Expo app** with its own `package-lock.json`.
> It is **not** part of the root npm workspace, on purpose. Run `npm`/`npx`
> commands from inside this directory.

## Features

- 🔐 Auth — login, sign up, forgot password (session persisted in SecureStore)
- 📚 eBooks — browse, purchase (coins) and read PDF/EPUB
- 🎵 Audio — audiobooks with a global mini player
- 📰 Articles — news & articles with categories
- 👤 Authors — profiles and catalogs
- 🔍 Search — full-text search across books + articles
- 📁 Library — personal bookshelf & bookmarks (offline, AsyncStorage)
- 🛒 Purchases — coin balance, packages, coupons
- 🌙 Dark mode — system-aware with manual override
- 🌐 i18n — English & Mon (ဘာသာမန်)
- 🖥️ Responsive — auto-column grids for phones & tablets

## Architecture

```
packages/mobile/
├─ app/                     # expo-router (file-based navigation)
│  ├─ _layout.tsx           # providers (theme, i18n, auth, audio, library)
│  ├─ (auth)/               # login / register / forgot-password (modal stack)
│  ├─ (tabs)/               # Home · Books · Articles · Search · Library
│  ├─ book/[id].tsx         # book detail + purchase + chapters + related
│  ├─ article/[id].tsx      # article reader
│  ├─ author/[id].tsx       # author profile + catalog
│  ├─ authors.tsx           # authors list
│  ├─ audio.tsx             # audiobooks list
│  ├─ purchases.tsx         # coins, packages, coupons, purchased items
│  ├─ settings.tsx          # theme + language + account
│  └─ reader.tsx            # PDF/EPUB WebView reader
└─ src/
   ├─ services/             # api client config + storage (AsyncStorage/SecureStore)
   ├─ lib/                  # pure helpers (url, normalize, user, audio, format) — unit-tested
   ├─ context/              # Auth · Theme · I18n · Audio · Library providers
   ├─ hooks/                # data hooks (books, articles, authors, search, purchases)
   ├─ components/           # reusable UI (cards, grid, forms, mini player, reader)
   └─ i18n/                 # en/mon locale JSON + translate()
```

**Data flow:** screens → hooks → `@loikmon/api` (shared axios client, reused from
the web app) → normalizers in `src/lib/normalize.ts` → typed models. State is kept
in React Context (auth/theme/i18n/audio/library); server data lives in per-screen
hooks. **Styling** uses NativeWind (Tailwind CSS) with a shared `brand`/`surface`
palette and class-based dark mode.

## Setup (npm / npx only)

```bash
cd packages/mobile
npm install
npx expo start            # then press i (iOS), a (Android), or scan the QR in Expo Go
# or:
npm run ios
npm run android
npm run web
```

Optional API override — copy `.env.example` to `.env.local` and set
`EXPO_PUBLIC_API_BASE`. Defaults to `https://loikmon.org/webapis/`.

## Validation

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest (pure logic: url, normalize, user, audio, format, i18n)
npm run lint        # expo lint
```

## Notes

- The shared `@loikmon/api` client sends POST bodies as `text/plain` wrapped in a
  `{ data: … }` envelope; this is reused verbatim so mobile and web hit the API
  identically. Metro is configured (see `metro.config.js`) to resolve the
  workspace package from the repo root.
- The reader renders PDFs natively in the WebView (iOS) / via Google Docs viewer
  (Android) and EPUBs with epub.js inside the WebView.
