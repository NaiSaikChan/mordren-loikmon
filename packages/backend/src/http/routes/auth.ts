import { IMAGE_STANDARDS } from '@loikmon/media-standards'
import { fromNodeHeaders } from 'better-auth/node'
import { isAPIError } from 'better-auth/api'
import { Router, type Request } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { errors } from '../../lib/errors.js'
import type { AppContext } from '../context.js'
import { getEntitlement, requireAuth, requireUser, toAuthUser, type SessionUser } from '../middleware/auth.js'
import type { createRateLimiters } from '../middleware/rateLimit.js'
import { serializeUser } from '../serializers.js'
import { parse } from '../validate.js'

const email = z.string().trim().toLowerCase().email().max(255)
const password = z.string().min(8, 'Password must be at least 8 characters').max(128)

const RegisterBody = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(120).optional(),
  firstname: z.string().trim().max(60).optional(),
  lastname: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(32).optional(),
})

const LoginBody = z.object({ email, password: z.string().min(1).max(128) })

const ProfileBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    firstname: z.string().trim().max(60).nullable(),
    lastname: z.string().trim().max(60).nullable(),
    phone: z.string().trim().max(32).nullable(),
  })
  .partial()

/**
 * `/api/v1/auth` — JSON wrappers around Better Auth that return a bearer
 * token plus the user and entitlement in one response, the shape both apps
 * consume. Better Auth's own routes stay mounted at `/api/auth/*` for email
 * verification and password-reset links.
 */
export function authRouter(ctx: AppContext, limiters: ReturnType<typeof createRateLimiters>) {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMAGE_STANDARDS.user_avatar.maxBytes, files: 1 } })

  const headersOf = (req: Request) => fromNodeHeaders(req.headers)

  async function sessionPayload(req: Request, token: string | null, rawUser: SessionUser) {
    const user = toAuthUser(rawUser)
    const entitlement = await ctx.services.subscriptions.getEntitlement(user.id, user.role)
    return { status: 'ok' as const, token, user: serializeUser(user, ctx.storage), entitlement }
  }

  router.post('/register', limiters.auth, async (req, res) => {
    const body = parse(RegisterBody, req.body)
    const name = body.name ?? ([body.firstname, body.lastname].filter(Boolean).join(' ') || body.email.split('@')[0]!)
    const { headers, response } = await ctx.auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name,
        firstname: body.firstname,
        lastname: body.lastname,
        phone: body.phone,
        // Where the email-verification link lands after confirming.
        callbackURL: `${ctx.config.appWebUrl}/auth?verified=1`,
      },
      headers: headersOf(req),
      returnHeaders: true,
    })
    const token = headers.get('set-auth-token') ?? response.token ?? null
    res.status(201).json({
      ...(await sessionPayload(req, token, response.user as SessionUser)),
      requires_email_verification: !token,
    })
  })

  router.post('/login', limiters.auth, async (req, res) => {
    const body = parse(LoginBody, req.body)
    const signIn = () =>
      ctx.auth.api.signInEmail({ body: { email: body.email, password: body.password }, headers: headersOf(req), returnHeaders: true })

    let result: Awaited<ReturnType<typeof signIn>>
    try {
      result = await signIn()
    } catch (err) {
      if (!(await migrateLegacyAccount(err, body.email, body.password))) throw err
      result = await signIn()
    }
    const token = result.headers.get('set-auth-token') ?? result.response.token
    res.json(await sessionPayload(req, token, result.response.user as SessionUser))
  })

  /** Returns true when a legacy account was imported and sign-in should be retried. */
  async function migrateLegacyAccount(err: unknown, userEmail: string, userPassword: string): Promise<boolean> {
    if (!ctx.legacyAuth || !isAPIError(err)) return false
    if ((err.body as { code?: string } | undefined)?.code !== 'INVALID_EMAIL_OR_PASSWORD') return false
    const existing = await ctx.db.selectFrom('users').select('id').where('email', '=', userEmail).executeTakeFirst()
    if (existing) return false
    const profile = await ctx.legacyAuth.verifyCredentials(userEmail, userPassword)
    if (!profile) return false

    const authContext = await ctx.auth.$context
    const hash = await authContext.password.hash(userPassword)
    const user = await authContext.internalAdapter.createUser(
      {
        email: userEmail,
        name: profile.name,
        emailVerified: true,
        firstname: profile.firstname,
        lastname: profile.lastname,
        phone: profile.phone,
      },
      { method: 'email-password' },
    )
    await authContext.internalAdapter.linkAccount({ userId: user.id, providerId: 'credential', accountId: user.id, password: hash })
    ctx.logger.info({ userId: user.id }, 'migrated legacy account on first sign-in')
    return true
  }

  router.post('/logout', requireAuth, async (req, res) => {
    await ctx.auth.api.signOut({ headers: headersOf(req) })
    res.json({ status: 'ok' })
  })

  router.get('/me', requireAuth, async (req, res) => {
    const user = requireUser(req)
    res.json({ status: 'ok', user: serializeUser(user, ctx.storage), entitlement: await getEntitlement(ctx, req) })
  })

  router.patch('/me', requireAuth, async (req, res) => {
    const body = parse(ProfileBody, req.body)
    const update: Record<string, unknown> = { ...body }
    if (!body.name && (body.firstname !== undefined || body.lastname !== undefined)) {
      const current = requireUser(req)
      const first = body.firstname !== undefined ? body.firstname : current.firstname
      const last = body.lastname !== undefined ? body.lastname : current.lastname
      const combined = [first, last].filter(Boolean).join(' ')
      if (combined) update.name = combined
    }
    await ctx.auth.api.updateUser({ body: update, headers: headersOf(req) })
    const session = await ctx.auth.api.getSession({ headers: headersOf(req), query: { disableCookieCache: true } })
    if (!session) throw errors.unauthorized()
    res.json({ status: 'ok', user: serializeUser(toAuthUser(session.user as SessionUser), ctx.storage) })
  })

  router.post('/me/avatar', requireAuth, upload.single('file'), async (req, res) => {
    const file = req.file
    if (!file) throw errors.validation([{ path: 'file', message: 'An image file is required' }])
    const user = requireUser(req)
    // Same standard, validation and variants as CMS uploads — but not a library asset.
    const { key } = await ctx.services.media.upload(
      { id: user.id, email: user.email, role: user.role, ip: req.ip ?? null },
      { assetType: 'user_avatar', buffer: file.buffer, mimeType: file.mimetype, originalName: file.originalname, register: false },
    )
    await ctx.auth.api.updateUser({ body: { image: key }, headers: headersOf(req) })
    if (user.image && !ctx.storage.isAbsoluteUrl(user.image)) {
      await ctx.storage.removeObject(user.image).catch((err: unknown) => ctx.logger.warn({ err }, 'failed to delete old avatar'))
    }
    res.json({ status: 'ok', user: serializeUser({ ...user, image: key }, ctx.storage) })
  })

  router.post('/password/forgot', limiters.auth, async (req, res) => {
    const body = parse(z.object({ email }), req.body)
    try {
      await ctx.auth.api.requestPasswordReset({ body: { email: body.email, redirectTo: `${ctx.config.appWebUrl}/auth/reset-password` } })
    } catch (err) {
      // Never reveal whether the email exists.
      ctx.logger.warn({ err }, 'password reset request failed')
    }
    res.json({ status: 'ok', message: 'If an account exists for this email, a reset link has been sent.' })
  })

  router.post('/password/reset', limiters.auth, async (req, res) => {
    const body = parse(z.object({ token: z.string().min(1), new_password: password }), req.body)
    await ctx.auth.api.resetPassword({ body: { token: body.token, newPassword: body.new_password } })
    res.json({ status: 'ok' })
  })

  router.post('/password/change', requireAuth, async (req, res) => {
    const body = parse(
      z.object({ current_password: z.string().min(1), new_password: password, revoke_other_sessions: z.boolean().default(true) }),
      req.body,
    )
    const { headers, response } = await ctx.auth.api.changePassword({
      body: { currentPassword: body.current_password, newPassword: body.new_password, revokeOtherSessions: body.revoke_other_sessions },
      headers: headersOf(req),
      returnHeaders: true,
    })
    res.json({ status: 'ok', token: headers.get('set-auth-token') ?? response.token ?? null })
  })

  router.post('/email/resend-verification', limiters.auth, async (req, res) => {
    const body = parse(z.object({ email }), req.body)
    try {
      await ctx.auth.api.sendVerificationEmail({ body: { email: body.email, callbackURL: `${ctx.config.appWebUrl}/auth?verified=1` } })
    } catch (err) {
      ctx.logger.warn({ err }, 'resend verification failed')
    }
    res.json({ status: 'ok' })
  })

  /**
   * Account deletion (required by the App Store). Store subscriptions are not
   * cancelled by deleting the account — the response tells the app to send
   * the user to the store's subscription settings when one is still renewing.
   */
  router.delete('/me', requireAuth, async (req, res) => {
    const body = parse(z.object({ password: z.string().min(1) }), req.body ?? {})
    const user = requireUser(req)
    const entitlement = await getEntitlement(ctx, req)
    await ctx.auth.api.deleteUser({ body: { password: body.password }, headers: headersOf(req) })
    ctx.logger.info({ userId: user.id }, 'account deleted')
    res.json({
      status: 'ok',
      manage_store_subscription: entitlement?.subscription?.auto_renew ? entitlement.subscription.platform : null,
    })
  })

  return router
}
