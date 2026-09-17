# @loikmon/mobile

Loikmon eBook & Audio mobile app — **Expo SDK 57 + expo-router + React Native + TypeScript**.

> ⚠️ This package is a **standalone Expo app** with its own `package-lock.json`.
> It is **not** part of the root npm workspace, on purpose. Run `npm`/`npx`
> commands from inside this directory.

## Features

- 🔐 Auth — sign in, sign up (with email verification), forgot password, change password, delete account
- 💎 Loikmon Premium — auto-renewing subscriptions ($4 / month, $10 / 3 months, $20 / 6 months, $45 / year)
  bought with **Apple In-App Purchase (StoreKit 2)** and **Google Play Billing** via [`expo-iap`](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap).
  An active subscription unlocks every book, article and audiobook.
- 📚 eBooks — browse and read PDF/EPUB (short-lived signed file URLs)
- 🎵 Audio — audiobooks with preview chapters and a global mini player
- 📰 Articles — full text and narration for subscribers, excerpt for everyone
- 👤 Authors (follow/unfollow) · 🔍 Search · 📁 Library bookmarks (offline, AsyncStorage)
- 🌙 Dark mode · 🌐 English & Mon (ဘာသာမန်) · 🖥️ Responsive grids for phones & tablets

## Architecture

```
packages/mobile/
├─ app/                     # expo-router (file-based navigation)
│  ├─ _layout.tsx           # providers: theme, i18n, typography, auth, subscription, library, audio
│  ├─ (auth)/               # login / register / forgot-password (modal stack)
│  ├─ (tabs)/               # Home · Books · Articles · Categories · Library (+ hidden Search)
│  ├─ book/[id].tsx         # book detail, access-gated Read/Listen, reviews, related
│  ├─ articles/[id].tsx     # article (content/audio when unlocked, excerpt + paywall otherwise)
│  ├─ audiobook/[id].tsx    # audiobook player (locked chapters never play)
│  ├─ reader.tsx            # PDF/EPUB reader — takes `id` + `format`, fetches a signed URL
│  ├─ subscribe.tsx         # paywall: plans, status, restore, manage, store disclosures
│  └─ settings.tsx          # theme, language, typography, account
└─ src/
   ├─ services/api.ts       # configures @loikmon/api (base URL, bearer token, sign-out on 401)
   ├─ context/              # Auth · Subscription (owns the single useIAP) · Theme · I18n · Audio · Library
   ├─ hooks/                # data hooks (1-based pagination via usePaginatedList)
   ├─ lib/                  # pure, unit-tested helpers (iap, access, pagination, url, audio, ...)
   ├─ components/           # UI (cards, PaywallCard, Reviews, DocumentReader, MiniPlayer, ...)
   └─ i18n/                 # en / mon locale JSON (same key set, enforced by a test)
```

**Data flow:** screens → hooks → `@loikmon/api` (shared axios client, `/api/v1`) →
typed responses. The **server decides access**: book details carry `access`,
files come from `books.getFileUrl()` (signed, short-lived), chapters and article
bodies are returned without media URLs when locked. List badges use `isLocked()`
for display only.

## Setup

```bash
cd packages/mobile
npm install --legacy-peer-deps   # the dependency tree has pre-existing optional peer conflicts
```

### Development build (required)

In-app purchases use native StoreKit / Play Billing code, so **Expo Go cannot run
this app**. Use a development build (`expo-dev-client` is installed):

```bash
# Local builds (Xcode / Android Studio required)
npx expo prebuild --clean        # regenerate android/ & ios/ after adding native modules (expo-iap)
npx expo run:android             # or: npm run android
npx expo run:ios                 # or: npm run ios   (macOS only)

# Then start Metro for the dev client
npx expo start --dev-client
```

Or build in the cloud with EAS:

```bash
npm i -g eas-cli
eas build:configure              # creates eas.json (not committed yet)
eas build --profile development --platform android   # installable dev client (APK)
eas build --profile development --platform ios       # device build (needs an Apple developer account)
```

> `android/` is a gitignored prebuild output. If it already exists from before
> `expo-iap` was added, run `npx expo prebuild --clean` — `expo run:android`
> does not re-apply config plugins to an existing native project.

### API base URL

Resolution order: `EXPO_PUBLIC_API_BASE` → `app.json` `expo.extra.apiBaseUrl` →
`https://api.loikmon.org/api/v1`. Copy `.env.example` to `.env.local` to override.

Local backend (`packages/backend`, port 4001):

| Target                            | `EXPO_PUBLIC_API_BASE`              |
| --------------------------------- | ----------------------------------- |
| Android emulator / USB device     | `http://localhost:4001/api/v1` + `npm run android:reverse` |
| iOS simulator                     | `http://localhost:4001/api/v1`      |

### Images, PDF, EPUB and audio (MinIO)

The backend returns media URLs on its `MINIO_PUBLIC_URL`: public URLs for covers
and avatars, and presigned URLs for PDF, EPUB and audio. **A presigned
signature covers the host**, so the device must fetch the URL exactly as issued.
Do not point `MINIO_PUBLIC_URL`/`MEDIA_CDN_URL` at `10.0.2.2`: the web app
cannot reach that address, and rewriting the host makes MinIO answer 403.

- **Local (Docker `loikmon-dev`, `MINIO_PUBLIC_URL=http://localhost:9000`):** run
  `npm run android:reverse`. It forwards the device's `localhost:4001` and
  `localhost:9000` to your computer. `npm run android` runs it automatically.
  Re-run it after the emulator restarts. Plain HTTP only works in debug builds.
- **Production:** `MINIO_PUBLIC_URL=https://<STORAGE_DOMAIN>` (docker-compose.prod.yml),
  a public HTTPS host every phone can reach. No app-side configuration is needed.

## Subscriptions (expo-iap)

- `SubscriptionProvider` (`src/context/SubscriptionContext.tsx`) owns the **only**
  `useIAP` instance and therefore the only purchase listener.
- Plans come from `subscriptions.fetchPlans()`; store products are loaded with
  `fetchProducts({ skus: storeSkus(plans, platform), type: 'subs' })` and the
  localised store price is shown (fallback: `formatPlanPrice`).
- **Purchase:** sign-in required → `account_token` from `subscriptions.getStatus()` →
  `requestPurchase` with `appAccountToken` (iOS) / `obfuscatedAccountId` (Android)
  → purchase event → `processPurchase()` verifies the proof with the backend
  (`purchaseToken` = StoreKit 2 JWS on iOS; product id + token on Android) →
  **only after a successful verification** `finishTransaction({ isConsumable: false })`.
- **Retry:** if verification fails transiently (network, `STORE_UNAVAILABLE`, 5xx,
  not signed in yet) the transaction stays unfinished and its key is persisted;
  on the next launch and every return to the foreground the app re-verifies
  (iOS re-delivers unfinished transactions; Android queries unacknowledged purchases).
- **Restore purchases:** `getAvailablePurchases()` → `subscriptions.restore(proofs)` → refresh.
- `PURCHASE_ALREADY_LINKED` shows a clear message (the store account's subscription
  belongs to another Loikmon account). User-cancelled purchases are silent.

### Store setup checklist

**App Store Connect** (`org.loikmon.mobile`)
1. Agreements, Tax and Banking: accept the Paid Apps agreement.
2. Create one subscription group (e.g. *Loikmon Premium*) with four auto-renewable
   subscriptions matching the backend plans' `apple_product_id`s
   (`org.loikmon.mobile.premium.monthly`, `…quarterly`, `…semiannual`, `…yearly`):
   durations 1 / 3 / 6 / 12 months, prices $4 / $10 / $20 / $45, localisations,
   review screenshot. Rank them in the group.
3. Enable App Store Server Notifications V2 pointing at the backend webhook, and
   configure the backend's App Store Server API key.
4. Add Sandbox testers (Users and Access → Sandbox) and sign in on the device
   under Settings → App Store → Sandbox Account.
5. App Privacy + the Terms of Use / Privacy Policy links (the paywall links
   `https://loikmon.org/terms` and `https://loikmon.org/privacy`).

**Google Play Console** (`org.loikmon.mobile`)
1. Upload a build containing the Billing permission (added by the `expo-iap`
   plugin) to an internal testing track — products can only be created after that.
2. Monetize → Subscriptions → create product **`loikmon_premium`** with four
   **auto-renewing** base plans: `monthly` (P1M, $4), `quarterly` (P3M, $10),
   `semiannual` (P6M, $20), `yearly` (P1Y, $45). Activate them.
3. Configure Real-time developer notifications (Pub/Sub) and the service account
   the backend uses for the Play Developer API.
4. Setup → License testing: add tester Google accounts (test cards, fast renewals),
   and add them to the internal testing track; install the app from the Play test link.

## Validation

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest (pure logic: iap, access, pagination, url, audio, i18n, ...)
npx expo config --type public   # config plugins resolve
npm run lint        # expo lint
```

## Notes

- Metro is configured (`metro.config.js`) to resolve the TypeScript source of
  `@loikmon/api` (`file:../api`, ESM-style `.js` specifiers).
- The reader renders PDFs natively in the WebView (iOS) / via the Google Docs
  viewer with a fully encoded signed URL (Android), and EPUBs with epub.js. EPUBs
  are cached per book id + format, and a signed URL that expired is re-requested once.
