import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt)
const KEYLEN = 64

/** Hash a password using scrypt with a random salt. Format: scrypt$<salt>$<hash>. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(plain, salt, KEYLEN)) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

/** Verify a plaintext password against a stored scrypt hash (constant-time). */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hashHex] = parts
  const derived = (await scrypt(plain, salt, KEYLEN)) as Buffer
  const expected = Buffer.from(hashHex, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}
