import { normaliseUser } from '@/lib/user'

describe('normaliseUser', () => {
  it('keeps the backend name and exposes a string id', () => {
    const u = normaliseUser({ id: 'b7d0', name: 'Nai Saik', firstname: 'Nai', lastname: 'Saik', email: 'a@b.com' })
    expect(u.name).toBe('Nai Saik')
    expect(u.id).toBe('b7d0')
  })

  it('computes a display name from firstname + lastname, then email prefix', () => {
    expect(normaliseUser({ id: '1', firstname: 'Nai', lastname: 'Saik', email: 'a@b.com' }).name).toBe('Nai Saik')
    expect(normaliseUser({ id: '1', email: 'reader@b.com' }).name).toBe('reader')
  })

  it('normalises the avatar and drops unknown legacy fields', () => {
    const u = normaliseUser({ id: '1', email: 'a@b.com', thumbnail: 'x.jpg', balance: '150' })
    expect(u.avatar).toBe('x.jpg')
    expect(u).not.toHaveProperty('balance')
  })

  it('fills defaults for missing fields', () => {
    const u = normaliseUser({ id: '1', email: 'a@b.com' })
    expect(u).toMatchObject({ role: 'user', is_admin: false, phone: null, avatar: null })
  })
})
