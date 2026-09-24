/**
 * Site footer — its link groups and landmark structure, plus the route `meta.footer`
 * flag that decides which pages in the app shell render it.
 */
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { RouterLink, type RouteRecordRaw } from 'vue-router'
import AppFooter from '@/components/layout/AppFooter.vue'
import { routes } from '@/router'
import { createTestI18n, createTestRouter } from './helpers'

/** Every page the footer is expected to appear on, by route name. */
const FOOTER_ROUTES = ['home', 'books', 'articles', 'authors', 'library', 'subscription', 'collections']

function appShellChildren(): RouteRecordRaw[] {
  const shell = routes.find((route) => route.path === '/' && route.children?.length)
  expect(shell, 'app shell route not found').toBeTruthy()
  return shell!.children!
}

async function mountFooter() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = await createTestRouter('/')
  const wrapper = mount(AppFooter, {
    global: { plugins: [pinia, router, createTestI18n()] },
  })
  await flushPromises()
  return wrapper
}

describe('route meta.footer', () => {
  const children = appShellChildren()
  const named = new Map(children.filter((r) => r.name).map((r) => [String(r.name), r]))

  for (const name of FOOTER_ROUTES) {
    it(`is set on [${name}]`, () => {
      expect(named.get(name)?.meta?.footer, `${name} should render the footer`).toBe(true)
    })
  }

  it('is not set on immersive or detail views', () => {
    const withFooter = children.filter((r) => r.meta?.footer).map((r) => String(r.name))
    expect(withFooter.sort()).toEqual([...FOOTER_ROUTES].sort())
  })

  it('keeps the existing auth guard on [library]', () => {
    expect(named.get('library')?.meta?.requiresAuth).toBe(true)
  })
})

describe('AppFooter', () => {
  it('renders a contentinfo landmark with labelled link groups', async () => {
    const wrapper = await mountFooter()

    expect(wrapper.find('footer').exists()).toBe(true)

    // Each group is its own navigation landmark, named by its visible heading.
    for (const group of ['discover', 'account', 'support']) {
      const nav = wrapper.find(`nav[aria-labelledby="footer-group-${group}"]`)
      expect(nav.exists(), `missing nav for ${group}`).toBe(true)
      expect(wrapper.find(`h2#footer-group-${group}`).text()).not.toBe('')
    }
    expect(wrapper.find('nav[aria-labelledby="footer-legal-label"]').exists()).toBe(true)
  })

  it('links to every primary section with in-app router links', async () => {
    const wrapper = await mountFooter()
    const targets = wrapper.findAllComponents(RouterLink).map((link) => String(link.props('to')))

    for (const path of ['/', '/books', '/audiobooks', '/articles', '/authors', '/collections', '/categories', '/library', '/subscription', '/inbox', '/settings', '/search']) {
      expect(targets, `missing footer link to ${path}`).toContain(path)
    }
  })

  it('opens external legal and contact links safely', async () => {
    const wrapper = await mountFooter()
    const external = wrapper.findAll('a[href^="http"]')
    expect(external.length).toBeGreaterThan(0)
    for (const link of external) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
    }

    // mailto:/tel: must stay in-place — no target/rel.
    const mail = wrapper.find('a[href^="mailto:"]')
    expect(mail.exists()).toBe(true)
    expect(mail.attributes('target')).toBeUndefined()
    expect(wrapper.find('a[href^="tel:"]').attributes('href')).not.toMatch(/\s/)
  })

  it('shows the current year in the copyright line', async () => {
    const wrapper = await mountFooter()
    expect(wrapper.text()).toContain(`© ${new Date().getFullYear()}`)
  })
})
