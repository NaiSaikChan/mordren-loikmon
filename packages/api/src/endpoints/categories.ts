import type { ApiResponse } from '../types.js'
import { getClient } from '../client.js'

export interface Category {
  id: string | number
  name: string
  icon?: string
  books_count?: number
}

export const categories = {
  fetchCategories: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ categories: Category[] }>>('fetchcategories', params ?? {}),

  getCategoryBooks: (categoryId: string | number) =>
    getClient().post<ApiResponse<{ books: any[] }>>('getcategorybooks', { category_id: categoryId }),
}
