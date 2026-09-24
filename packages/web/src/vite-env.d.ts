/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_PLAY_STORE_URL?: string
  readonly VITE_APP_STORE_URL?: string
  readonly VITE_TERMS_URL?: string
  readonly VITE_PRIVACY_URL?: string
  readonly BASE_URL: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
