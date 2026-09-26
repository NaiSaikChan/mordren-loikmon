import { DEFAULT_BASE_URL } from '@loikmon/api'

/** Base URL of the Loikmon backend (`/api/v1` behind nginx / the Vite dev proxy). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE || DEFAULT_BASE_URL

/** Store listings of the Loikmon app — subscriptions can only be purchased there. */
export const PLAY_STORE_URL =
  import.meta.env.VITE_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.loikmon.mobile'

export const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || 'https://apps.apple.com/search?term=loikmon'

// Terms and privacy are published live in the CMS at these internal routes
// by default; operators can still point either at an external legal page
// via the env vars.
export const TERMS_URL = import.meta.env.VITE_TERMS_URL || '/policies/terms'
export const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || '/policies/privacy'

/** Fallback "manage subscription" links when the status response is not available. */
export const STORE_MANAGE_URLS = {
  app_store: 'https://apps.apple.com/account/subscriptions',
  google_play: 'https://play.google.com/store/account/subscriptions',
} as const

/** localStorage key of the bearer token. */
export const TOKEN_STORAGE_KEY = 'token'

/** Public contact + web presence, surfaced in the app footer. */
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://loikmon.org'
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'info@loikmon.org'
export const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || '+66 955070956'
