import axios, { type AxiosInstance } from 'axios'

let _instance: AxiosInstance | null = null

// Production: call loikmon.org directly (CORS allow-origin: *)
// Dev: proxy through local BFF on :4000 to avoid cert issues
const DEFAULT_BASE = 'https://loikmon.org/webapis/'

export function getClient(baseURL?: string): AxiosInstance {
  if (_instance) return _instance

  _instance = axios.create({
    baseURL: baseURL ?? DEFAULT_BASE,
    timeout: 15000,
    // NOTE: Content-Type omitted here — the server expects
    // the body as plain JSON without explicit Content-Type header
    // (mirrors how Flutter http package sends it)
  })

  // Attach auth token if available
  _instance.interceptors.request.use((config) => {
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // Wrap POST/PUT body in { data: ... } envelope that loikmon.org expects
    if ((config.method === 'post' || config.method === 'put') && config.data !== undefined) {
      // Only wrap if not already wrapped
      if (
        config.data !== null &&
        typeof config.data === 'object' &&
        !('data' in config.data)
      ) {
        config.data = { data: config.data }
      }
    }

    return config
  })

  _instance.interceptors.response.use(
    (res) => res,
    (err) => Promise.reject(err),
  )

  return _instance
}

/** Replace with a custom Axios instance (useful in SSR or testing) */
export function setClient(instance: AxiosInstance): void {
  _instance = instance
}
