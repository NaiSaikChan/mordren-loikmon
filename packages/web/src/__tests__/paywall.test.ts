/**
 * Access gating: the server decides, the UI shows the right call to action.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { activeEntitlement, apiError, makeArticle, makeArticleDetail, makeBook, makeUser, mountWithApp, response } from './helpers'

const mockGetArticle = vi.fn()
const mockGetBook = vi.fn()
const mockGetFileUrl = vi.fn()
const mockMe = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  const ok = () => Promise.resolve({ data: { status: 'ok' } })
  return {
    ...actual,
    articles: {
      ...actual.articles,
      getArticle: (...a: unknown[]) => mockGetArticle(...a),
      updateArticleTotalViews: ok,
    },
    books: {
      ...actual.books,
      getBook: (...a: unknown[]) => mockGetBook(...a),
      getFileUrl: (...a: unknown[]) => mockGetFileUrl(...a),
      updateTotalViews: ok,
      relatedBooks: () => Promise.resolve({ data: { status: 'ok', books: [] } }),
      fetchBooks: () => Promise.resolve({ data: { status: 'ok', books: [], total: 0, pagination: null } }),
    },
    reviews: {
      ...actual.reviews,
      loadReviews: () => Promise.resolve({ data: { status: 'ok', reviews: [], user_review: null, summary: { average: 0, count: 0 } } }),
    },
    auth: { ...actual.auth, me: (...a: unknown[]) => mockMe(...a) },
  }
})

vi.mock('@/components/shared/EpubReader.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { __esModule: true, default: defineComponent({ props: ['url', 'bookId', 'refreshUrl'], setup: (p) => () => h('div', { 'data-testid': 'epub-stub', 'data-url': p.url }) }) }
})

import Paywall from '@/components/shared/Paywall.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import BookReaderPage from '@/pages/BookReaderPage.vue'
import BookDetailPage from '@/pages/BookDetailPage.vue'
import ArticleDetailPage from '@/pages/ArticleDetailPage.vue'
import { useAuthStore } from '@/stores/auth'
import { usePaywallStore } from '@/stores/paywall'

describe('Paywall component', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('LOGIN_REQUIRED → sign-in link that comes back to the current page', async () => {
    const { wrapper } = await mountWithApp(Paywall, { props: { reason: 'login_required' }, path: '/books/7/read?format=epub' })

    const link = wrapper.find('[data-testid="paywall-login"]')
    expect(link.exists()).toBe(true)
    expect(decodeURIComponent(link.attributes('href')!)).toBe('/auth?redirect=/books/7/read?format=epub')
    expect(wrapper.text()).toContain('Sign in to continue')
  })

  it('SUBSCRIPTION_REQUIRED → subscription page and the mobile-app hint', async () => {
    const { wrapper } = await mountWithApp(Paywall, { props: { reason: 'subscription_required' } })

    expect(wrapper.find('[data-testid="paywall-subscribe"]').attributes('href')).toBe('/subscription')
    expect(wrapper.text()).toContain('Premium content')
    expect(wrapper.text()).toContain('Google Play or the App Store')
  })

  it('"Already subscribed? Refresh" reloads the entitlement and emits unlocked', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore(pinia)
    auth.token = 'tok-1'
    auth.user = makeUser()
    mockMe.mockReturnValueOnce(response({ status: 'ok', user: makeUser(), entitlement: activeEntitlement() }))

    const { wrapper } = await mountWithApp(Paywall, { props: { reason: 'subscription_required' }, pinia })
    const refresh = wrapper.findAll('button').find((b) => b.text().includes('Refresh'))!
    await refresh.trigger('click')
    await flushPromises()

    expect(mockMe).toHaveBeenCalled()
    expect(wrapper.emitted('unlocked')).toHaveLength(1)
  })
})

describe('BookReaderPage gating', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockGetBook.mockReturnValue(response({ status: 'ok', book: makeBook({ access: { granted: false, reason: 'subscription_required' } }) }))
  })

  it('shows the subscription paywall when getFileUrl answers SUBSCRIPTION_REQUIRED', async () => {
    mockGetFileUrl.mockRejectedValue(apiError(403, 'SUBSCRIPTION_REQUIRED'))

    const { wrapper } = await mountWithApp(BookReaderPage, { props: { id: '7' }, path: '/books/7/read?format=pdf' })

    expect(mockGetFileUrl).toHaveBeenCalledWith('7', 'pdf')
    const paywall = wrapper.find('[data-testid="paywall"]')
    expect(paywall.exists()).toBe(true)
    expect(paywall.attributes('data-reason')).toBe('subscription_required')
    expect(wrapper.find('[data-testid="reader-epub"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the sign-in paywall when getFileUrl answers LOGIN_REQUIRED', async () => {
    mockGetFileUrl.mockRejectedValue(apiError(401, 'LOGIN_REQUIRED'))

    const { wrapper } = await mountWithApp(BookReaderPage, { props: { id: '7' }, path: '/books/7/read' })

    expect(mockGetFileUrl).toHaveBeenCalledWith('7', undefined)
    expect(wrapper.find('[data-testid="paywall"]').attributes('data-reason')).toBe('login_required')
    expect(wrapper.find('[data-testid="paywall-login"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('BookDetailPage gating', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('hides the read buttons and shows the paywall when access is not granted', async () => {
    mockGetBook.mockReturnValue(response({ status: 'ok', book: makeBook({ access: { granted: false, reason: 'subscription_required' } }) }))

    const { wrapper } = await mountWithApp(BookDetailPage, { props: { id: '7' }, path: '/books/7' })

    expect(wrapper.find('[data-testid="read-epub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="paywall"]').attributes('data-reason')).toBe('subscription_required')
  })

  it('shows one read button per available format when access is granted', async () => {
    mockGetBook.mockReturnValue(response({ status: 'ok', book: makeBook({ formats: ['pdf'], has_epub: false, has_pdf: true }) }))

    const { wrapper } = await mountWithApp(BookDetailPage, { props: { id: '7' }, path: '/books/7' })

    expect(wrapper.find('[data-testid="read-epub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="read-pdf"]').attributes('href')).toBe('/books/7/read?format=pdf')
    expect(wrapper.find('[data-testid="paywall"]').exists()).toBe(false)
  })
})

describe('ArticleDetailPage gating', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders the excerpt with a paywall when the article is locked', async () => {
    mockGetArticle.mockReturnValue(response({
      status: 'ok',
      article: makeArticleDetail({ locked: true, content: null, access: { granted: false, reason: 'subscription_required' }, excerpt: 'Only the beginning…' }),
    }))

    const { wrapper } = await mountWithApp(ArticleDetailPage, { props: { id: '11' }, path: '/articles/11' })

    expect(wrapper.find('[data-testid="article-excerpt"]').text()).toBe('Only the beginning…')
    expect(wrapper.find('[data-testid="paywall"]').attributes('data-reason')).toBe('subscription_required')
    expect(wrapper.find('[data-testid="article-content"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders the content when the server includes it', async () => {
    mockGetArticle.mockReturnValue(response({ status: 'ok', article: makeArticleDetail({ content: '<p>Full body</p>' }) }))

    const { wrapper } = await mountWithApp(ArticleDetailPage, { props: { id: '11' }, path: '/articles/11' })

    expect(wrapper.find('[data-testid="article-content"]').html()).toContain('<p>Full body</p>')
    expect(wrapper.find('[data-testid="paywall"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ArticleCard listen button', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('fetches the article and opens the paywall when the audio is locked', async () => {
    mockGetArticle.mockReturnValue(response({
      status: 'ok',
      article: makeArticleDetail({ has_audio: true, locked: true, content: null, audio_url: null, access: { granted: false, reason: 'login_required' } }),
    }))
    const played = vi.fn()
    window.addEventListener('loikmon:playAudioTrack', played)

    const { wrapper, pinia } = await mountWithApp(ArticleCard, { props: { article: makeArticle({ has_audio: true }) } })
    await wrapper.find('[data-testid="article-listen"]').trigger('click')
    await flushPromises()

    expect(mockGetArticle).toHaveBeenCalledWith(11)
    expect(usePaywallStore(pinia).reason).toBe('login_required')
    expect(played).not.toHaveBeenCalled()
    window.removeEventListener('loikmon:playAudioTrack', played)
  })

  it('plays the signed audio_url when the viewer has access', async () => {
    mockGetArticle.mockReturnValue(response({
      status: 'ok',
      article: makeArticleDetail({ has_audio: true, audio_url: 'https://storage.loikmon.org/audio/11.mp3?sig=abc' }),
    }))
    const played = vi.fn()
    window.addEventListener('loikmon:playAudioTrack', played)

    const { wrapper, pinia } = await mountWithApp(ArticleCard, { props: { article: makeArticle({ has_audio: true }) } })
    await wrapper.find('[data-testid="article-listen"]').trigger('click')
    await flushPromises()

    expect(played).toHaveBeenCalledTimes(1)
    expect((played.mock.calls[0][0] as CustomEvent).detail.track.url).toBe('https://storage.loikmon.org/audio/11.mp3?sig=abc')
    expect(usePaywallStore(pinia).reason).toBeNull()
    window.removeEventListener('loikmon:playAudioTrack', played)
  })

  it('has no listen button for articles without audio', async () => {
    const { wrapper } = await mountWithApp(ArticleCard, { props: { article: makeArticle({ has_audio: false }) } })
    expect(wrapper.find('[data-testid="article-listen"]').exists()).toBe(false)
  })

  it('shows Free / locked Premium badges from is_free and the entitlement', async () => {
    const free = await mountWithApp(ArticleCard, { props: { article: makeArticle({ is_free: true }) } })
    expect(free.wrapper.find('[data-testid="badge-free"]').exists()).toBe(true)

    const locked = await mountWithApp(ArticleCard, { props: { article: makeArticle({ is_free: false }) } })
    expect(locked.wrapper.find('[data-testid="badge-premium"]').attributes('data-locked')).toBe('true')

    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore(pinia).entitlement = activeEntitlement()
    const unlocked = await mountWithApp(ArticleCard, { props: { article: makeArticle({ is_free: false }) }, pinia })
    expect(unlocked.wrapper.find('[data-testid="badge-premium"]').attributes('data-locked')).toBe('false')
  })
})
