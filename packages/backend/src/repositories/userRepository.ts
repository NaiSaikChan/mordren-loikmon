import { pool, queryOne } from '../database/pool.js'

export interface UserRow {
  id: string
  email: string
  name: string | null
  password_hash: string | null
  auth_provider: string
  is_admin: number
  email_verified: number
  created_at: string
  updated_at: string
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()])
}

export async function findById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
}

export async function createUser(input: {
  email: string
  name?: string | null
  passwordHash?: string | null
  authProvider?: string
}): Promise<UserRow> {
  await pool.query(
    `INSERT INTO users (email, name, password_hash, auth_provider)
     VALUES (?, ?, ?, ?)`,
    [input.email.toLowerCase(), input.name ?? null, input.passwordHash ?? null, input.authProvider ?? 'password'],
  )
  const user = await findByEmail(input.email)
  if (!user) throw new Error('User creation failed')
  return user
}
