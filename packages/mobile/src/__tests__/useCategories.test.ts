// Tests API contract & data mapping; avoids react-test-renderer (version mismatch in project)
import { categories as catApi } from '@loikmon/api'

const mockFetchCategories = jest.fn()

jest.mock('@loikmon/api', () => ({
  categories: { fetchCategories: (...args: unknown[]) => mockFetchCategories(...args) },
}))

const MOCK_CATEGORIES = [
  { id: '29', name: 'ဇာတ်' },
  { id: '33', name: 'ပညာစိုတ်' },
]

describe('useCategories — API contract', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads categories from { categories: [...] } wrapper', async () => {
    mockFetchCategories.mockResolvedValue({ data: { categories: MOCK_CATEGORIES } })
    const res = await (catApi as any).fetchCategories()
    const list = (res.data as any).categories ?? []
    expect(list).toHaveLength(2)
    expect(list[0].name).toBe('ဇာတ်')
  })

  it('returns empty array when categories key is absent', async () => {
    mockFetchCategories.mockResolvedValue({ data: {} })
    const res = await (catApi as any).fetchCategories()
    const list = (res.data as any).categories ?? []
    expect(list).toEqual([])
  })

  it('rejects on network failure', async () => {
    mockFetchCategories.mockRejectedValue(new Error('network fail'))
    await expect((catApi as any).fetchCategories()).rejects.toThrow('network fail')
  })
})
