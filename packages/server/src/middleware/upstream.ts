import axios, { type AxiosRequestConfig } from 'axios'
import type { Request, Response } from 'express'

const BASE = process.env.LOIKMON_API_BASE ?? 'https://loikmon.org/webapis'

function getAuthHeader(req: Request): Record<string, string> {
  const token = req.headers.authorization
  return token ? { Authorization: token } : {}
}

export async function proxyGet(
  req: Request,
  res: Response,
  endpoint: string,
  extra?: AxiosRequestConfig,
): Promise<void> {
  try {
    const { data } = await axios.get(`${BASE}/${endpoint}`, {
      params: req.query,
      headers: getAuthHeader(req),
      ...extra,
    })
    res.json(data)
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown }; message: string }
    res.status(e.response?.status ?? 502).json(
      e.response?.data ?? { error: e.message },
    )
  }
}

export async function proxyPost(
  req: Request,
  res: Response,
  endpoint: string,
  extra?: AxiosRequestConfig,
): Promise<void> {
  try {
    const { data } = await axios.post(`${BASE}/${endpoint}`, req.body, {
      headers: { ...getAuthHeader(req), 'Content-Type': 'application/json' },
      ...extra,
    })
    res.json(data)
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown }; message: string }
    res.status(e.response?.status ?? 502).json(
      e.response?.data ?? { error: e.message },
    )
  }
}
