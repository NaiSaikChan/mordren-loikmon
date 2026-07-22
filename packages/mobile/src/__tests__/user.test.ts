import { normaliseUser, makeSessionKey } from '@/lib/user'

describe('normaliseUser', () => {
  it('computes a display name from firstname + lastname', () => {
    const u = normaliseUser({ id: 1, firstname: 'Nai', lastname: 'Saik', email: 'a@b.com' })
    expect(u.name).toBe('Nai Saik')
  })

  it('falls back to username then email prefix', () => {
    expect(normaliseUser({ id: 1, username: 'monreader', email: 'a@b.com' }).name).toBe(
      'monreader',
    )
    expect(normaliseUser({ id: 1, email: 'reader@b.com' }).name).toBe('reader')
  })

  it('normalises avatar from thumbnail and coerces coins to a number', () => {
    const u = normaliseUser({ id: 1, email: 'a@b.com', thumbnail: 'x.jpg', coins: '150' })
    expect(u.avatar).toBe('x.jpg')
    expect(u.coins).toBe(150)
  })

  it('defaults coins to 0 when absent', () => {
    expect(normaliseUser({ id: 1, email: 'a@b.com' }).coins).toBe(0)
  })
})

describe('makeSessionKey', () => {
  it('derives a stable key from the user id', () => {
    expect(makeSessionKey({ id: 42 })).toBe('user_42')
  })
})
