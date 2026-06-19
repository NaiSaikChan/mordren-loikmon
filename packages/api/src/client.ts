import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

let _instance: AxiosInstance | null = null

export function getClient(baseURL?: string): AxiosInstance {
  if (_instance) return _instance

  _instance = axios.create({
    baseURL: baseURL ?? 'http://localhost:4000/api', // BFF proxy
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })

  // Attach auth token if available
  _instance.interceptors.request.use((config) => {
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  })

  // Unwrap { data: ... } response envelope
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
