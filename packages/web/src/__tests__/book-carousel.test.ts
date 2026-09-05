import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookCarousel from '@/components/shared/BookCarousel.vue'
import ScrollCarousel from '@/components/shared/ScrollCarousel.vue'
import type { Book } from '@loikmon/api'

const sampleBooks: Book[] = [
  { id: 1, title: 'Book One', authorname: 'Author A', price: 0, is_free: true } as Book,
  { id: 2, title: 'Book Two', authorname: 'Author B', price: 100, is_free: false } as Book,
  { id: 3, title: 'Book Three', authorname: 'Author C', price: 50, is_free: false } as Book,
]

describe('BookCarousel.vue', () => {
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
