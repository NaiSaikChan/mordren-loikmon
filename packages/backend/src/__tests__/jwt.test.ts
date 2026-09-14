import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../auth/jwt.js'

describe('jwt', () => {
  const user = { id: 'u-123', email: 'a@b.com', is_admin: false }

  it('round-trips a signed token', () => {
    const token = signToken(user)
    const decoded = verifyToken(token)
    expect(decoded).toEqual(user)
  })

  it('throws on a tampered token', () => {
    const token = signToken(user)
    expect(() => verifyToken(token + 'x')).toThrow()
  })

  it('preserves admin flag', () => {
    const token = signToken({ ...user, is_admin: true })
    expect(verifyToken(token).is_admin).toBe(true)
  })
})
