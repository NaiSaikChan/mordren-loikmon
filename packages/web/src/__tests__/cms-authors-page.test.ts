/**
 * Authors page: the "Linked account" field is a picker over the users that
 * hold the author role, not a free-text uuid box. The list is fetched once the
 * modal is first opened, needs `users.view`, and keeps showing an account a
 * profile is already linked to even after that account loses the role.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CmsSession } from '@loikmon/api'

const api = vi.hoisted(() => ({ authorsList: vi.fn(), usersList: vi.fn() }))

vi.mock('@loikmon/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@loikmon/api')>()),
  cms: {
    authors: { list: api.authorsList, create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    users: { list: api.usersList },
    media: { resolve: vi.fn().mockResolvedValue({ data: { items: [] } }), list: vi.fn(), signedUrl: vi.fn() },
  },
}))

import AuthorsPage from '../cms/pages/AuthorsPage.vue'
import { useCmsSessionStore } from '../cms/stores/session'

const pagination = { page: 1, limit: 20, total: 1, total_pages: 1, has_more: false }

const author = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Mi Chan',
  bio: null,
  avatar_key: null,
  user_id: null,
  user_email: null,
  website: null,
  facebook: null,
  youtube: null,
  instagram: null,
  verification_status: 'verified',
  books_count: 2,
  articles_count: 0,
  followers_count: 10,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...extra,
})

const user = (id: string, email: string, name: string | null) => ({
  id,
  email,
  name,
  role: 'author',
  email_verified: true,
  phone: null,
  created_at: '2026-09-01T00:00:00Z',
  role_keys: ['author'],
  author_id: null,
})

function seedSession(permissions: string[]) {
  const store = useCmsSessionStore()
  store.session = {
    status: 'ok',
    can_access: true,
    user: { id: 'admin-1', email: 'admin@loikmon.org', primary_role: 'admin' },
    roles: [{ id: 1, role_key: 'admin', name: 'Admin', scope: 'all' }],
    scope: 'all',
    permissions,
    author_profiles: [],
    permission_groups: [],
  } as CmsSession
  return store
}

const ALL = ['authors.view', 'authors.create', 'authors.edit', 'users.view']

/**
 * Mount, wait for the list, then open the modal — `New author` by default, or
 * the row's `Edit` button, which is what pre-fills an existing link.
 */
async function openModal({ permissions = ALL, rows = [author()], edit = false } = {}) {
  api.authorsList.mockResolvedValue({ data: { authors: rows, pagination } })
  seedSession(permissions)
  // The dialog teleports to <body>; stubbing it keeps the fields in the wrapper.
  const wrapper = mount(AuthorsPage, { global: { stubs: { teleport: true } } })
  await flushPromises()
  await clickButton(wrapper, edit ? /^edit$/i : /^new author$/i)
  await flushPromises()
  return wrapper
}

function clickButton(wrapper: ReturnType<typeof mount>, label: RegExp) {
  const button = wrapper.findAll('button').find((b) => label.test(b.text()))
  if (!button) throw new Error(`no button matching ${label}`)
  return button.trigger('click')
}

/** The linked-account field, identified by its "not linked" placeholder option. */
const linkedSelect = (wrapper: ReturnType<typeof mount>) => {
  const select = wrapper.findAll('select').find((s) => s.text().includes('Not linked'))
  if (!select) throw new Error('linked account select not rendered')
  return select
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.authorsList.mockReset()
  api.usersList.mockReset().mockResolvedValue({
    data: { users: [user('u-1', 'oreo@loikmon.local', 'Oreo'), user('u-2', 'nameless@loikmon.local', null)], pagination },
  })
})

describe('AuthorsPage linked account picker', () => {
  it('offers the author-role users as options instead of a uuid text box', async () => {
    const wrapper = await openModal()
    expect(api.usersList).toHaveBeenCalledWith({ role: 'author', limit: 100 })
    const options = linkedSelect(wrapper).findAll('option')
    expect(options.map((o) => o.text())).toEqual(['— Not linked —', 'Oreo (oreo@loikmon.local)', 'nameless@loikmon.local'])
    expect(options.map((o) => o.attributes('value'))).toEqual(['', 'u-1', 'u-2'])
    expect(wrapper.find('input[placeholder="uuid"]').exists()).toBe(false)
  })

  it('binds the chosen account id to the form', async () => {
    const wrapper = await openModal()
    const select = linkedSelect(wrapper)
    await select.setValue('u-2')
    expect((select.element as HTMLSelectElement).value).toBe('u-2')
  })

  it('fetches the accounts once, however often the modal is opened', async () => {
    const wrapper = await openModal()
    await clickButton(wrapper, /cancel/i)
    await clickButton(wrapper, /^new author$/i)
    await flushPromises()
    expect(api.usersList).toHaveBeenCalledTimes(1)
  })

  it('keeps showing a linked account that has since lost the author role', async () => {
    const wrapper = await openModal({ rows: [author({ user_id: 'u-gone', user_email: 'former@loikmon.local' })], edit: true })
    const options = linkedSelect(wrapper).findAll('option')
    expect(options.map((o) => o.attributes('value'))).toContain('u-gone')
    expect(wrapper.text()).toContain('former@loikmon.local')
    expect((linkedSelect(wrapper).element as HTMLSelectElement).value).toBe('u-gone')
  })

  it('does not request accounts without the users.view permission', async () => {
    await openModal({ permissions: ['authors.view', 'authors.create', 'authors.edit'] })
    expect(api.usersList).not.toHaveBeenCalled()
  })
})
