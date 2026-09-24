import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import BookCarousel from '@/components/shared/BookCarousel.vue'
import ScrollCarousel from '@/components/shared/ScrollCarousel.vue'
import type { Book } from '@loikmon/api'
import { createTestI18n, makeBook } from './helpers'

const sampleBooks: Book[] = [
  makeBook({ id: 1, title: 'Book One', authorname: 'Author A', is_free: true }),
  makeBook({ id: 2, title: 'Book Two', authorname: 'Author B', is_free: false }),
  makeBook({ id: 3, title: 'Book Three', authorname: 'Author C', is_free: false }),
]

let plugins: unknown[] = []

describe('BookCarousel.vue', () => {
  beforeEach(() => {
    plugins = [createPinia(), createTestI18n()]
  })

  it('renders nothing when books array is empty', () => {
    const wrapper = mount(BookCarousel, {
      props: {
        books: [],
        title: 'More Books',
      },
    })
    expect(wrapper.findComponent(ScrollCarousel).exists()).toBe(false)
  })

  it('renders section title and list of books', () => {
    const wrapper = mount(BookCarousel, {
      props: {
        books: sampleBooks,
        title: 'More Books by This Author',
      },
      global: {
        plugins: plugins as any,
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('More Books by This Author')
    expect(wrapper.text()).toContain('Book One')
    expect(wrapper.text()).toContain('Book Two')
    expect(wrapper.text()).toContain('Book Three')
    // Free / Premium badges replace the old coin prices.
    expect(wrapper.text()).toContain('Free')
    expect(wrapper.text()).toContain('Premium')
    expect(wrapper.text()).not.toContain('🪙')
  })

  it('renders custom item slot if provided', () => {
    const wrapper = mount(BookCarousel, {
      props: {
        books: sampleBooks,
        title: 'Featured',
      },
      slots: {
        item: '<template #item="{ book }"><div class="custom-item">{{ book.title }} - Custom</div></template>',
      },
      global: {
        plugins: plugins as any,
        stubs: {
          RouterLink: true,
        },
      },
    })

    const customItems = wrapper.findAll('.custom-item')
    expect(customItems.length).toBe(3)
    expect(customItems[0].text()).toBe('Book One - Custom')
  })
})
