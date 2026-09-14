import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler.js'
import { sensitiveLimiter } from '../middleware/rateLimit.js'
import { requireAuth } from '../middleware/auth.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { signToken } from '../auth/jwt.js'
import { createUser, findByEmail, findById } from '../repositories/userRepository.js'
import { ConflictError, UnauthorizedError } from '../utils/errors.js'
import type { AuthUser } from '../types/index.js'

const router = Router()

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(255).optional(),
})

function toAuthUser(row: { id: string; email: string; is_admin: number }): AuthUser {
  return { id: row.id, email: row.email, is_admin: !!row.is_admin }
}

// POST /api/auth/register
router.post(
  '/register',
  sensitiveLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name } = credsSchema.parse(req.body)
    if (await findByEmail(email)) throw new ConflictError('Email already registered')
    const passwordHash = await hashPassword(password)
    const user = await createUser({ email, name, passwordHash, authProvider: 'password' })
    const authUser = toAuthUser(user)
    res.status(201).json({ token: signToken(authUser), user: authUser })
  }),
)

// POST /api/auth/login
router.post(
  '/login',
  sensitiveLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = credsSchema.parse(req.body)
    const user = await findByEmail(email)
    if (!user || !user.password_hash) throw new UnauthorizedError('Invalid credentials')
    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) throw new UnauthorizedError('Invalid credentials')
    const authUser = toAuthUser(user)
    res.json({ token: signToken(authUser), user: authUser })
  }),
)

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findById(req.user!.id)
    if (!user) throw new UnauthorizedError()
    res.json({
      user: { id: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin },
    })
  }),
)

export default router
