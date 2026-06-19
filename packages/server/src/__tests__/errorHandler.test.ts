import { describe, it, expect, vi } from 'vitest'
import { errorHandler } from '../middleware/errorHandler.js'
import type { Request, Response, NextFunction } from 'express'

function fakeRes() {
  const res: any = {
    _status: 200,
    _json: undefined,
    status(c: number) { this._status = c; return this },
    json(d: unknown) { this._json = d; return this },
  }
  return res
}

const req = {} as Request
const next = vi.fn() as unknown as NextFunction

describe('BFF — errorHandler middleware', () => {

  it('uses err.status when present', () => {
    const res = fakeRes()
    const err = Object.assign(new Error('Not found'), { status: 404 })
    errorHandler(err as any, req, res, next)
    expect(res._status).toBe(404)
  })

  it('defaults to 500 when no err.status', () => {
    const res = fakeRes()
    errorHandler(new Error('Unexpected'), req, res, next)
    expect(res._status).toBe(500)
  })

  it('puts error message in JSON body', () => {
    const res = fakeRes()
    errorHandler(new Error('DB connection refused'), req, res, next)
    expect((res._json as any).error).toBe('DB connection refused')
  })

  it('includes err.code when present', () => {
    const res = fakeRes()
    const err = Object.assign(new Error('Duplicate key'), { code: 'SQLITE_UNIQUE' })
    errorHandler(err as any, req, res, next)
    expect((res._json as any).code).toBe('SQLITE_UNIQUE')
  })

  it('code is undefined when not set', () => {
    const res = fakeRes()
    errorHandler(new Error('Generic'), req, res, next)
    expect((res._json as any).code).toBeUndefined()
  })
})
