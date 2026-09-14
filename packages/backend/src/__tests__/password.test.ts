import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../auth/password.js'

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('s3cret-pass')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('s3cret-pass', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword('wrong-horse', hash)).toBe(false)
  })

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('x', 'bcrypt$salt$hash')).toBe(false)
  })

  it('produces unique salts (different hashes for same input)', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
  })
})
