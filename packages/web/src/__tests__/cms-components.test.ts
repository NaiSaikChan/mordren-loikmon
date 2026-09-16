/**
 * CMS component library: the table, the permission-aware helpers and the
 * export/formatting utilities every page relies on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DataTable from '../cms/components/DataTable.vue'
import StatusBadge from '../cms/components/StatusBadge.vue'
import PagerBar from '../cms/components/PagerBar.vue'
import TagInput from '../cms/components/TagInput.vue'
import {
  downloadCsv,
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  fromLocalInput,
  toLocalInput,
  useConfirm,
} from '../cms/composables/useCmsUi'
import { useToastStore } from '../cms/stores/toast'
import { apiError } from './helpers'

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
]
const rows = [
  { id: 1, title: 'First', status: 'published' },
  { id: 2, title: 'Second', status: 'draft' },
]

describe('DataTable', () => {
  it('renders one row per record with the column labels as headers', () => {
    const wrapper = mount(DataTable, { props: { rows, columns } })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual(['Title', 'Status'])
  })

  it('labels every cell for the stacked phone layout', () => {
    const wrapper = mount(DataTable, { props: { rows, columns } })
    const cells = wrapper.findAll('tbody td')
    expect(cells[0].attributes('data-label')).toBe('Title')
    expect(cells[1].attributes('data-label')).toBe('Status')
  })

  it('shows skeletons while loading an empty table', () => {
    const wrapper = mount(DataTable, { props: { rows: [], columns, loading: true } })
    expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0)
  })

  it('shows the empty state with its call to action', () => {
    const wrapper = mount(DataTable, {
      props: { rows: [], columns, emptyTitle: 'Nothing here', emptyMessage: 'Add the first one' },
      slots: { 'empty-action': '<button>Create</button>' },
    })
    expect(wrapper.text()).toContain('Nothing here')
    expect(wrapper.text()).toContain('Add the first one')
    expect(wrapper.find('button').text()).toBe('Create')
  })

  it('offers a retry when loading failed', async () => {
    const wrapper = mount(DataTable, { props: { rows: [], columns, error: 'Network down' } })
    expect(wrapper.text()).toContain('Network down')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('emits selection events from the checkboxes', async () => {
    const wrapper = mount(DataTable, {
      props: { rows, columns, selectable: true, selection: new Set<number>(), allSelected: false },
    })
    const boxes = wrapper.findAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(3) // header + two rows

    await boxes[0].trigger('change')
    expect(wrapper.emitted('toggleAll')).toHaveLength(1)

    await boxes[1].trigger('change')
    expect(wrapper.emitted('toggle')?.[0]).toEqual([1])
  })

  it('lets a page override a cell through a slot', () => {
    const wrapper = mount(DataTable, {
      props: { rows, columns },
      slots: { 'cell-title': '<strong>{{ params.row.title }}</strong>' },
    })
    expect(wrapper.find('strong').exists()).toBe(true)
  })
})

describe('StatusBadge', () => {
  it('labels a status readably', () => {
    expect(mount(StatusBadge, { props: { status: 'in_review' } }).text()).toBe('in review')
    expect(mount(StatusBadge, { props: { status: 'published' } }).text()).toBe('published')
  })

  it('accepts an explicit label', () => {
    expect(mount(StatusBadge, { props: { status: 'draft', label: 'Not live' } }).text()).toBe('Not live')
  })

  it('falls back gracefully for an unknown status', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'something-new' } })
    expect(wrapper.text()).toBe('something-new')
  })
})

describe('PagerBar', () => {
  const pagination = { page: 3, limit: 20, total: 100, total_pages: 5, has_more: true }

  it('describes the visible range', () => {
    const wrapper = mount(PagerBar, { props: { pagination, limit: 20 } })
    expect(wrapper.text()).toContain('41–60')
    expect(wrapper.text()).toContain('100')
  })

  it('emits page changes', async () => {
    const wrapper = mount(PagerBar, { props: { pagination, limit: 20 } })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click') // previous
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
  })

  it('disables previous on the first page', () => {
    const wrapper = mount(PagerBar, { props: { pagination: { ...pagination, page: 1 }, limit: 20 } })
    expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined()
  })

  it('reports an empty result set honestly', () => {
    const wrapper = mount(PagerBar, { props: { pagination: { page: 1, limit: 20, total: 0, total_pages: 1, has_more: false }, limit: 20 } })
    expect(wrapper.text()).toContain('No results')
  })
})

describe('TagInput', () => {
  it('adds a tag on Enter and ignores duplicates', async () => {
    const wrapper = mount(TagInput, { props: { modelValue: [] } })
    const input = wrapper.find('input')

    await input.setValue('history')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['history']])

    await wrapper.setProps({ modelValue: ['history'] })
    await input.setValue('history')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })

  it('removes the last tag on Backspace in an empty box', async () => {
    const wrapper = mount(TagInput, { props: { modelValue: ['a', 'b'] } })
    await wrapper.find('input').trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['a']])
  })

  it('stops accepting tags at the limit', async () => {
    const wrapper = mount(TagInput, { props: { modelValue: ['a', 'b'], max: 2 } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })
})

describe('toast store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('explains a missing permission instead of showing a bare 403', () => {
    const toasts = useToastStore()
    const err = apiError(403, 'PERMISSION_DENIED', 'You do not have permission to perform this action')
    Object.assign(err, { details: { required: ['settings.manage'] } })

    toasts.failure(err)

    expect(toasts.toasts[0]).toMatchObject({ kind: 'error', detail: 'Requires: settings.manage' })
  })

  it('lists validation problems', () => {
    const toasts = useToastStore()
    const err = apiError(400, 'VALIDATION_ERROR', 'Request validation failed')
    Object.assign(err, { details: [{ path: 'discount_value', message: 'must be between 1 and 100' }] })

    toasts.failure(err)

    expect(toasts.toasts[0].detail).toContain('discount_value: must be between 1 and 100')
  })

  it('dismisses by id', () => {
    const toasts = useToastStore()
    const id = toasts.success('Saved')
    expect(toasts.toasts).toHaveLength(1)
    toasts.dismiss(id)
    expect(toasts.toasts).toHaveLength(0)
  })
})

describe('useConfirm', () => {
  it('resolves true when confirmed and false when cancelled', async () => {
    const { confirm, answer, pending } = useConfirm()

    const first = confirm({ title: 'Delete?', message: 'Sure?' })
    expect(pending.value?.title).toBe('Delete?')
    answer(true)
    await expect(first).resolves.toBe(true)

    const second = confirm({ title: 'Again?', message: 'Sure?' })
    answer(false)
    await expect(second).resolves.toBe(false)
    expect(pending.value).toBeNull()
  })

  it('cancels a dialog that is replaced by another', async () => {
    const { confirm, answer } = useConfirm()
    const first = confirm({ title: 'One', message: 'x' })
    const second = confirm({ title: 'Two', message: 'y' })
    await expect(first).resolves.toBe(false)
    answer(true)
    await expect(second).resolves.toBe(true)
  })
})

describe('formatting helpers', () => {
  it('formats money from cents', () => {
    expect(formatMoney(450)).toBe('$4.50')
    expect(formatMoney(0)).toBe('$0.00')
  })

  it('formats large numbers with separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats durations as h:mm:ss or m:ss', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(formatDuration(null)).toBe('—')
  })

  it('shows a dash rather than "Invalid Date"', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })

  it('round-trips a datetime-local value', () => {
    const iso = '2026-05-04T09:30:00.000Z'
    const local = toLocalInput(iso)
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(fromLocalInput(local)).toBe(iso)
  })

  it('treats an empty datetime-local value as null', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(toLocalInput(null)).toBe('')
  })
})

describe('downloadCsv', () => {
  it('quotes cells containing commas, quotes or newlines', () => {
    const chunks: string[] = []
    const createObjectURL = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: string[]) {
          chunks.push(parts.join(''))
        }
      },
    )
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ click, remove: vi.fn(), set href(_v: string) {}, set download(_v: string) {} } as never)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)

    downloadCsv(
      'test.csv',
      [
        { key: 'name', label: 'Name' },
        { key: 'note', label: 'Note' },
      ],
      [{ name: 'Mon, Nai', note: 'He said "hello"' }],
    )

    expect(click).toHaveBeenCalled()
    expect(chunks[0]).toContain('"Mon, Nai"')
    expect(chunks[0]).toContain('"He said ""hello"""')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})
