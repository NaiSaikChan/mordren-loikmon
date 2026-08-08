import { getCategoryIcon } from '@/lib/categoryIcons'

describe('getCategoryIcon', () => {
  it('returns correct emoji for known category IDs', () => {
    expect(getCategoryIcon('29')).toBe('🎭') // ဇာတ်
    expect(getCategoryIcon('33')).toBe('🎓') // ပညာစိုတ်
    expect(getCategoryIcon('38')).toBe('📜') // ဝၚ်
    expect(getCategoryIcon('51')).toBe('🌿') // ပွဳပွူသဘာဝ
    expect(getCategoryIcon('34')).toBe('⚖️') // သၞောဝ်ဥပဒေ
  })

  it('accepts numeric IDs', () => {
    expect(getCategoryIcon(29)).toBe('🎭')
    expect(getCategoryIcon(24)).toBe('🏛️')
  })

  it('returns 📂 for unknown IDs', () => {
    expect(getCategoryIcon('999')).toBe('📂')
    expect(getCategoryIcon(0)).toBe('📂')
    expect(getCategoryIcon('')).toBe('📂')
  })

  it('covers all 13 mapped categories', () => {
    const ids = [24, 29, 30, 31, 32, 33, 34, 35, 38, 43, 44, 46, 51]
    for (const id of ids) {
      expect(getCategoryIcon(id)).not.toBe('📂')
    }
  })
})
