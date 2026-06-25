import axios, { type AxiosInstance } from 'axios'

let _instance: AxiosInstance | null = null

// loikmon.org CORS: allow-origin:* but no Access-Control-Allow-Headers
// → application/json triggers a preflight that returns 404 (no ACAO-Headers)
// → browser blocks the request entirely
//
// Fix: send POST body as text/plain — this is a CORS "simple request"
// (no preflight needed). The server parses it as JSON regardless.
// This mirrors exactly how the Flutter http package sends requests.
const DEFAULT_BASE = 'https://loikmon.org/webapis/'

export function getClient(baseURL?: string): AxiosInstance {
  if (_instance) return _instance

  _instance = axios.create({
    baseURL: baseURL ?? DEFAULT_BASE,
    timeout: 15000,
    // No default Content-Type — we set it per-request type below
  })

  _instance.interceptors.request.use((config) => {
    // Auth token
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // POST/PUT: wrap in {data:...} and send as text/plain to avoid CORS preflight
    if ((config.method === 'post' || config.method === 'put') && config.data !== undefined) {
      // Wrap payload in { data: ... } envelope (required by loikmon.org)
      const wrapped =
        config.data !== null &&
        typeof config.data === 'object' &&
        !('data' in config.data)
          ? { data: config.data }
          : config.data

      // Serialize to JSON string but declare as text/plain
      // → browser treats this as a simple request (no preflight)
      config.data = JSON.stringify(wrapped)
      config.headers = config.headers ?? {}
      config.headers['Content-Type'] = 'text/plain'
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
