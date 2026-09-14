import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import type { AuthUser } from '../types/index.js'

interface TokenPayload {
  sub: string
  email: string
  is_admin: boolean
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, is_admin: user.is_admin }
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn as any })
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, config.auth.jwtSecret) as TokenPayload
  return { id: decoded.sub, email: decoded.email, is_admin: decoded.is_admin }
}
