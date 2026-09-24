import type { Logger } from '../lib/logger.js'

export interface LegacyProfile {
  firstname: string | null
  lastname: string | null
  name: string
  phone: string | null
}

/**
 * Just-in-time migration of accounts from the legacy PHP API.
 *
 * Password hashes cannot be exported through the old API, so when someone
 * signs in with an email that does not exist locally we check the credentials
 * against `loginapp` once. On success the account is created locally with the
 * same password and the legacy server is never consulted for that user again.
 */
export class LegacyAuthService {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verifyCredentials(email: string, password: string): Promise<LegacyProfile | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/loginapp`, {
        method: 'POST',
        // The legacy server expects a {data: ...} envelope sent as text/plain.
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ data: { email, password } }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return null
      const body = (await res.json()) as { status?: string; user?: Record<string, unknown> }
      if (body.status !== 'ok' || !body.user) return null
      const user = body.user
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
      const legacyEmail = str(user.email)
      if (legacyEmail && legacyEmail.toLowerCase() !== email.toLowerCase()) return null
      const firstname = str(user.firstname)
      const lastname = str(user.lastname)
      const name = [firstname, lastname].filter(Boolean).join(' ') || str(user.username) || email.split('@')[0]!
      return { firstname, lastname, name, phone: str(user.phone) }
    } catch (err) {
      this.logger.warn({ err }, 'legacy credential check failed')
      return null
    }
  }
}
